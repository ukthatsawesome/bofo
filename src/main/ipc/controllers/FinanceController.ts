import { IpcMainInvokeEvent } from 'electron';
import { IController } from '../router';
import { FinanceModel } from '../../models/finance';
import { ForecastEngine } from '../../utils/forecast';

export class FinanceController implements IController {
  
  registerRoutes() {
    return {
      'get-summary-stats': this.getSummaryStats.bind(this),
      'calculate-forecast': this.calculateForecast.bind(this),
      // We can also move 'get-accounts', 'get-categories', etc. here later
      // For now, focusing on analytics
    };
  }

  /**
   * Calculates financial totals directly from the database for accuracy.
   */
  async getSummaryStats(event: IpcMainInvokeEvent) {
    try {
      // 1. Get Accounts for Net Worth (Assets - Liabilities)
      const accounts = await FinanceModel.getAllAccounts();
      const assets = accounts.filter(a => ['bank', 'wallet', 'investment'].includes((a.type || '').toLowerCase()))
                             .reduce((sum, a) => sum + (a.balance || 0), 0);
      const liabilities = accounts.filter(a => !['bank', 'wallet', 'investment'].includes((a.type || '').toLowerCase()))
                                  .reduce((sum, a) => sum + (a.balance || 0), 0);

      const netWorth = assets - liabilities; // Assuming balance is positive for liability accounts implies debt size

      // 2. Get Income/Expense for "Current Month"
      // We need a custom SQL query for this as FinanceModel might not expose a "sum by date range" efficiently
      // But for now, we can rely on FinanceModel's internal helpers if we expose a method,
      // or simply perform a lightweight specialized query.
      
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      // We'll add a helper to FinanceModel for this specific aggregation to avoid raw SQL here
      const monthlyStats = await FinanceModel.getMonthlyTotals(firstDay, lastDay);

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
      console.error('Failed to calculate summary stats:', err);
      return { netWorth: 0, totalBalance: 0, monthIncome: 0, monthExpense: 0, savingsRate: 0 };
    }
  }

  /**
   * Generates a forecast based on FULL database history.
   * Ignores the 'transactions' array passed from UI.
   */
  async calculateForecast(event: IpcMainInvokeEvent, data: any) {
    try {
        // Fetch all data from DB
        const transactions = await FinanceModel.getAll('transaction', { orderBy: 'start_date DESC' }); 
        const accounts = await FinanceModel.getAllAccounts();
        const recurringCharges = await FinanceModel.getAllRecurringCharges();
        const settings = await FinanceModel.getAllSettings();

        const engine = new ForecastEngine(
            transactions as any[],
            accounts as any[],
            settings as any,
            recurringCharges as any[]
        );

        return engine.generateForecast(data.months || 6);

    } catch (e) {
      console.error('Forecast error:', e);
      return { timeline: [], summary: {}, insights: [] };
    }
  }
}
