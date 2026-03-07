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

      const accounts = await FinanceModel.getAccountsWithConvertedBalances(baseCurrency);
      const assets = accounts
        .filter((a) => ['bank', 'wallet', 'investment'].includes((a.type || '').toLowerCase()))
        .reduce((sum, a) => sum + (a.converted_balance ?? 0), 0);
      const liabilities = accounts
        .filter((a) => !['bank', 'wallet', 'investment'].includes((a.type || '').toLowerCase()))
        .reduce((sum, a) => sum + Math.abs(a.converted_balance ?? 0), 0);

      const netWorth = assets - liabilities;

      const { start: firstDay, end: lastDay } = DateUtils.getMonthBoundaries();

      const monthlyStats = await FinanceModel.getMonthlyTotals(firstDay, lastDay, baseCurrency);

      return {
        netWorth,
        totalBalance: assets, // Liquid assets usually shown as "Current Balance"
        monthIncome: monthlyStats.income,
        monthExpense: monthlyStats.expense,
        savingsRate:
          monthlyStats.income > 0
            ? ((monthlyStats.income - monthlyStats.expense) / monthlyStats.income) * 100
            : 0,
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
      const settings = await FinanceModel.getAllSettings();
      const baseCurrency = settings[SETTING_KEYS.CURRENCY.BASE] || DEFAULT_CURRENCY;

      const transactions =
        data.transactions ||
        (await FinanceModel.getAll('transaction', { orderBy: 'start_date DESC' }));
      const recurringCharges =
        data.recurringCharges || (await FinanceModel.getAllRecurringCharges());

      let accountsRaw = data.accounts;
      if (!accountsRaw) {
        accountsRaw = await FinanceModel.getAllAccounts();
      }

      const accountsConverted = await FinanceModel.getAccountsWithConvertedBalances(baseCurrency);
      const normalizedAccounts = accountsConverted.map((a) => ({
        ...a,
        balance: a.converted_balance || 0, // Use converted balance for forecasting
      }));

      const monthsToForecast = Math.min(Math.max(1, data.months || 6), 60);

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
