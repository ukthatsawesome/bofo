import { IpcMainInvokeEvent } from 'electron';
import { Logger } from '../../utils/logger';
import { IController } from '../router';
import { FinanceModel } from '../../models/finance';
import { ForecastEngine } from '../../utils/forecast';
import { DateUtils } from '../../../shared/utils/dateUtils';
import { SETTING_KEYS } from '../../../shared/settings/keys';
import { DEFAULT_CURRENCY } from '../../../shared/settings/defaults';

export class FinanceController implements IController {

  registerRoutes() {
    return {
      'get-summary-stats': this.getSummaryStats.bind(this),
      'get-dashboard-data': this.getDashboardData.bind(this),
      'get-category-spending': this.getCategorySpending.bind(this),
      'calculate-forecast': this.calculateForecast.bind(this),
      'recalculate-all-balances': this.recalculateAllBalances.bind(this),
    };
  }

  /**
   * Recalculate all account balances.
   * Used to fix balances after removing triggers or correcting duplicate calculations.
   */
  async recalculateAllBalances(event: IpcMainInvokeEvent) {
    try {
      const results = await FinanceModel.recalculateAllBalances();
      Logger.info(`[BalanceRecalc] Recalculated ${results.length} accounts`);
      return { success: true, results };
    } catch (err: any) {
      Logger.error('[BalanceRecalc] Failed:', err);
      return { success: false, error: err.message };
    }
  }

  async getDashboardData(event: IpcMainInvokeEvent, months: number) {
    return await FinanceModel.getDashboardData(months);
  }

  async getCategorySpending(event: IpcMainInvokeEvent, { startDate, endDate }: any) {
    return await FinanceModel.getCategorySpending(startDate, endDate);
  }

  /**
   * Calculates financial totals directly from the database for accuracy.
   */
  async getSummaryStats(event: IpcMainInvokeEvent) {
    try {
      const settings = await FinanceModel.getAllSettings();
      const baseCurrency = settings[SETTING_KEYS.CURRENCY.BASE] || DEFAULT_CURRENCY;

      // 1. Get Accounts for Net Worth (Assets - Liabilities)
      const accounts = await FinanceModel.getAccountsWithConvertedBalances(baseCurrency);
      const assets = accounts.filter(a => ['bank', 'wallet', 'investment'].includes((a.type || '').toLowerCase()))
        .reduce((sum, a) => sum + (a.converted_balance ?? 0), 0);
      const liabilities = accounts.filter(a => !['bank', 'wallet', 'investment'].includes((a.type || '').toLowerCase()))
        .reduce((sum, a) => sum + Math.abs(a.converted_balance ?? 0), 0);

      const netWorth = assets - liabilities; // Assuming balance is positive for liability accounts implies debt size

      // 2. Get Income/Expense for "Current Month"
      const { start: firstDay, end: lastDay } = DateUtils.getMonthBoundaries();

      // We'll add a helper to FinanceModel for this specific aggregation to avoid raw SQL here
      const monthlyStats = await FinanceModel.getMonthlyTotals(firstDay, lastDay, baseCurrency);

      return {
        netWorth,
        totalBalance: assets, // Liquid assets usually shown as "Current Balance"
        monthIncome: monthlyStats.income,
        monthExpense: monthlyStats.expense,
        savingsRate: monthlyStats.income > 0
          ? ((monthlyStats.income - monthlyStats.expense) / monthlyStats.income * 100)
          : 0
      };
    } catch (err: any) {
      Logger.error('Failed to calculate summary stats:', err);
      return { netWorth: 0, totalBalance: 0, monthIncome: 0, monthExpense: 0, savingsRate: 0 };
    }
  }

  /**
   * Generates a forecast based on FULL database history.
   * Ignores the 'transactions' array passed from UI.
   * Converts all amounts to base currency for accurate multi-currency forecasting.
   */
  async calculateForecast(event: IpcMainInvokeEvent, data: any) {
    try {
      // Get base currency from settings
      const settings = await FinanceModel.getAllSettings();
      const baseCurrency = settings[SETTING_KEYS.CURRENCY.BASE] || DEFAULT_CURRENCY;

      // Use provided data or fetch from DB
      const transactions = data.transactions || await FinanceModel.getAll('transaction', { orderBy: 'start_date DESC' });
      const recurringCharges = data.recurringCharges || await FinanceModel.getAllRecurringCharges();

      // Get accounts (if passed from UI, they might need balance conversion logic, 
      // but UI usually sends raw accounts. Better to fetch fresh or rely on UI passing correct current balances)
      // For consistency with currency conversion, we'll fetch from DB if not provided, 
      // OR we expect UI to send us the active state. 
      // Given the complexity of currency conversion, fetching accounts from DB is safer for "current balance" 
      // unless we trust the UI's "accounts" array.
      // However, to fix the "ignore UI data" issue, we optionally use data.accounts.
      let accountsRaw = data.accounts;
      if (!accountsRaw) {
        accountsRaw = await FinanceModel.getAllAccounts();
      }

      // We need to normalize balances. If accounts came from UI, they might not have 'converted_balance'.
      // We will re-calculate converted balance if needed or assume UI handled it? 
      // The safest path for multi-currency is to rely on the Model helper for Accounts 
      // OR re-implement the conversion here.
      // Let's stick to the Model helper if data.accounts is missing, otherwise use simple mapping.
      // BUT: The existing code used `FinanceModel.getAccountsWithConvertedBalances(baseCurrency)`.
      // If we use UI data, we miss that conversion. 
      // COMPROMISE: We will refetch Accounts from DB to ensure accurate Balance + Currency conversion 
      // because Account balances don't change as often as "what-if" transactions in a forecast.
      // Actually, if the user added an internal transaction in the UI store but didn't save it, 
      // we want that reflected. But `calculateForecast` is usually for saved data + potential future.
      // Let's use DB for accounts to guarantee accuracy of "Current Net Worth".

      const accountsConverted = await FinanceModel.getAccountsWithConvertedBalances(baseCurrency);
      const normalizedAccounts = accountsConverted.map(a => ({
        ...a,
        balance: a.converted_balance || 0, // Use converted balance for forecasting
      }));

      // Cap months to prevent memory exhaustion
      const monthsToForecast = Math.min(Math.max(1, data.months || 6), 60); // Max 5 years

      // Convert transaction amounts to base currency for accurate forecasting
      const normalizedTransactions = [];
      for (const tx of transactions as any[]) {
        const txCurrency = tx.currency || DEFAULT_CURRENCY;
        let convertedAmount = tx.amount;
        if (txCurrency !== baseCurrency) {
          const rate = await FinanceModel.getExchangeRate(txCurrency, baseCurrency);
          convertedAmount = rate ? tx.amount * rate : tx.amount;
        }
        normalizedTransactions.push({
          ...tx,
          // Ensure amounts are numbers
          amount: Number(convertedAmount),
          currency: baseCurrency,
        });
      }

      const engine = new ForecastEngine(
        normalizedTransactions,
        normalizedAccounts as any[],
        settings as any,
        recurringCharges as any[]
      );

      return engine.generateForecast(monthsToForecast);

    } catch (e) {
      Logger.error('Forecast error:', e);
      return { timeline: [], summary: {}, insights: [] };
    }
  }
}
