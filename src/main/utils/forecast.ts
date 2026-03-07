/**
 * ForecastEngine
 * --------------------
 * Simulates historical + future financial position day-by-day
 */

import { DateUtils } from '../../shared/utils/dateUtils';
import { SETTING_KEYS } from '../../shared/settings/keys';

export interface Transaction {
  id?: number;
  type: string;
  category: string;
  amount: number;
  start_date: string;
  end_date?: string | null;
  frequency: string;
  is_active: boolean;
  [key: string]: unknown;
}

export interface Account {
  id?: number;
  name: string;
  type: string;
  balance: number;
  [key: string]: unknown;
}

export interface ForecastSettings {
  [key: string]: unknown;
}

export interface TimelinePoint {
  date: string;
  balance: number;
  netWorth: number;
  income: number;
  expense: number;
  isFuture: boolean;
}

export interface ForecastInsight {
  type: 'success' | 'warning' | 'danger';
  title: string;
  message: string;
}

export interface ForecastSummary {
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  endBalance: number;
  monthlyAvgSavings: number;
  runway: number;
}

export interface ForecastResult {
  timeline: TimelinePoint[];
  summary: ForecastSummary;
  insights: ForecastInsight[];
}

export interface RecurringCharge {
  id?: number;
  name: string;
  amount: number;
  category: string;
  frequency: string;
  next_due_date?: string | null;
  is_active: boolean;
  [key: string]: unknown;
}

export class ForecastEngine {
  private transactions: Transaction[];
  private accounts: Account[];
  private recurringCharges: RecurringCharge[];
  private settings: ForecastSettings;

  constructor(
    transactions: Transaction[],
    accounts: Account[] = [],
    settings: ForecastSettings = {},
    recurringCharges: RecurringCharge[] = []
  ) {
    this.transactions = transactions || [];
    this.accounts = accounts || [];
    this.settings = settings || {};
    this.recurringCharges = recurringCharges || [];
  }

  /**
   * Merges recurring charges as virtual transactions into the main list.
   * Prevents modifying history by clamping start dates to today.
   */
  private _mergeRecurringIntoTransactions(): Transaction[] {
    if (!this.recurringCharges.length) return this.transactions;

    const todayStr = this._toDateString(new Date());

    const derived: Transaction[] = this.recurringCharges
      .filter((rc) => rc.is_active)
      .map((rc) => {
        const nextDue = rc.next_due_date || todayStr;
        const start = nextDue < todayStr ? todayStr : nextDue;

        return {
          type: 'expense', // Recurring charges default to expense
          category: rc.category,
          amount: rc.amount,
          start_date: start,
          frequency: rc.frequency,
          is_active: true,
          description: `Recurring: ${rc.name}`,
        };
      });

    return [...this.transactions, ...derived];
  }

  public generateForecast(months: number | null = null): ForecastResult {
    const horizonMonths = months ?? Number(this.settings[SETTING_KEYS.FORECAST.HORIZON] ?? 6);
    const inflationEnabled = this.settings[SETTING_KEYS.FORECAST.INFLATION_ENABLED] === 'true';
    const annualInflationRate =
      Number(this.settings[SETTING_KEYS.FORECAST.INFLATION_RATE] ?? 2.5) / 100;

    const dailyInflationMultiplier = Math.pow(1 + annualInflationRate, 1 / 365);

    const today = this._startOfDay(new Date());

    const historyStart = this._addMonths(today, -3);
    const forecastEnd = this._addMonths(today, horizonMonths);

    const initialAssets = this._sumAccounts(['bank', 'wallet', 'investment', 'asset']);
    const initialLiabilities = this._sumAccounts(['credit_card', 'loan', 'liability']);
    const initialCash = this._sumAccounts(['bank', 'wallet']);

    const allTransactions = this._mergeRecurringIntoTransactions();
    const { oneTimeMap, recurringList } = this._partitionTransactions(allTransactions);

    const timeline: TimelinePoint[] = [];
    let currentCash = this._calculateHistoricalCash(
      initialCash,
      historyStart,
      today,
      oneTimeMap,
      recurringList
    );

    let totalFutureIncome = 0;
    let totalFutureExpense = 0;
    let inflationFactor = 1.0;

    const cursor = new Date(historyStart);

    const todayTime = today.getTime();
    const endTime = forecastEnd.getTime();

    while (cursor.getTime() <= endTime) {
      const isFuture = cursor.getTime() >= todayTime;
      const dateStr = this._toDateString(cursor);

      let dailyIncome = 0;
      let dailyExpense = 0;

      const todaysOneTime = oneTimeMap.get(dateStr);
      if (todaysOneTime) {
        for (const tx of todaysOneTime) {
          const amt = this._applyInflation(tx, isFuture, inflationEnabled, inflationFactor);
          if (tx.type === 'income') dailyIncome += amt;
          else dailyExpense += amt;
        }
      }

      for (const tx of recurringList) {
        if (this._isDue(tx, cursor)) {
          if (!this._isWithinDateRange(tx, cursor)) continue;

          const amt = this._applyInflation(tx, isFuture, inflationEnabled, inflationFactor);
          if (tx.type === 'income') dailyIncome += amt;
          else dailyExpense += amt;
        }
      }

      currentCash += dailyIncome - dailyExpense;

      if (isFuture) {
        totalFutureIncome += dailyIncome;
        totalFutureExpense += dailyExpense;

        if (inflationEnabled) inflationFactor *= dailyInflationMultiplier;
      }

      timeline.push({
        date: dateStr,
        balance: currentCash,
        netWorth: currentCash + (initialAssets - initialCash) - initialLiabilities,
        income: dailyIncome,
        expense: dailyExpense,
        isFuture,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    const netSavings = totalFutureIncome - totalFutureExpense;
    const avgMonthlyExpense = horizonMonths > 0 ? totalFutureExpense / horizonMonths : 0;
    const runway = avgMonthlyExpense > 0 ? initialCash / avgMonthlyExpense : Infinity;

    return {
      timeline,
      summary: {
        totalIncome: totalFutureIncome,
        totalExpense: totalFutureExpense,
        netSavings,
        endBalance: currentCash,
        monthlyAvgSavings: horizonMonths > 0 ? netSavings / horizonMonths : 0,
        runway,
      },
      insights: this._generateInsights(
        timeline.filter((t) => t.isFuture),
        netSavings,
        runway
      ),
    };
  }

  /**
   * partitions transactions into efficient lookups.
   * O(N) complexity.
   */
  private _partitionTransactions(transactions: Transaction[]) {
    const oneTimeMap = new Map<string, Transaction[]>();
    const recurringList: Transaction[] = [];

    for (const tx of transactions) {
      if (!tx.is_active) continue;
      if (tx.type !== 'income' && tx.type !== 'expense') continue;

      if (tx.frequency === 'once') {
        const dateKey = tx.start_date.split('T')[0];
        const list = oneTimeMap.get(dateKey) || [];
        list.push(tx);
        oneTimeMap.set(dateKey, list);
      } else {
        recurringList.push(tx);
      }
    }

    return { oneTimeMap, recurringList };
  }

  /**
   * Calculates cash flow for the historical period (start -> today).
   * Reuses the partitioned data structures for efficiency.
   */
  private _calculateHistoricalCash(
    initialCash: number,
    start: Date,
    end: Date,
    oneTimeMap: Map<string, Transaction[]>,
    recurringList: Transaction[]
  ): number {
    let cash = initialCash;
    const cursor = new Date(start);
    const endTime = end.getTime();

    while (cursor.getTime() < endTime) {
      const dateStr = this._toDateString(cursor);

      const ones = oneTimeMap.get(dateStr);
      if (ones) {
        for (const tx of ones) {
          if (tx.type === 'income') cash -= tx.amount;

          if (tx.type === 'income') cash -= tx.amount;
          else cash += tx.amount;
        }
      }

      for (const tx of recurringList) {
        if (this._isDue(tx, cursor) && this._isWithinDateRange(tx, cursor)) {
          if (tx.type === 'income') cash -= tx.amount;
          else cash += tx.amount;
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }
    return cash;
  }

  private _applyInflation(
    tx: Transaction,
    isFuture: boolean,
    enabled: boolean,
    factor: number
  ): number {
    if (isFuture && enabled && tx.type === 'expense') {
      return tx.amount * factor;
    }
    return tx.amount;
  }

  private _isWithinDateRange(tx: Transaction, date: Date): boolean {
    const txStartStr = tx.start_date;
    const dateStr = this._toDateString(date);

    if (dateStr < txStartStr) return false;

    if (tx.end_date) {
      if (dateStr > tx.end_date) return false;
    }
    return true;
  }

  private _isDue(tx: Transaction, date: Date): boolean {
    if (tx.frequency === 'once') {
      return tx.start_date === this._toDateString(date);
    }

    const d = date.getDate();
    const day = date.getDay();
    const m = date.getMonth();

    const start = new Date(tx.start_date);

    if (tx.frequency === 'weekly') {
      return start.getDay() === day;
    }

    if (tx.frequency === 'monthly') {
      const startDay = start.getDate();

      const lastDayOfMonth = new Date(date.getFullYear(), m + 1, 0).getDate();
      const triggerDay = Math.min(startDay, lastDayOfMonth);
      return d === triggerDay;
    }

    if (tx.frequency === 'yearly') {
      const startDay = start.getDate();
      const startMonth = start.getMonth();
      if (m !== startMonth) return false;

      const lastDayOfMonth = new Date(date.getFullYear(), m + 1, 0).getDate();
      const triggerDay = Math.min(startDay, lastDayOfMonth);
      return d === triggerDay;
    }

    return false;
  }

  private _generateInsights(
    futureTimeline: TimelinePoint[],
    netSavings: number,
    runway: number
  ): ForecastInsight[] {
    const insights: ForecastInsight[] = [];

    if (netSavings < 0) {
      insights.push({
        type: 'danger',
        title: 'Negative Cash Flow',
        message: `You are projected to spend ${Math.abs(netSavings).toLocaleString()} more than you earn.`,
      });
    } else {
      insights.push({
        type: 'success',
        title: 'Wealth Growth',
        message: `You are on track to save ${netSavings.toLocaleString()} over this period.`,
      });
    }

    if (runway !== Infinity && runway < 3) {
      insights.push({
        type: 'warning',
        title: 'Low Runway',
        message: `Your liquid assets cover only ${runway.toFixed(1)} months of expenses.`,
      });
    }

    const deficitDay = futureTimeline.find((d) => d.balance < 0);
    if (deficitDay) {
      insights.push({
        type: 'danger',
        title: 'Projected Deficit',
        message: `Your balance is projected to drop below zero on ${deficitDay.date}.`,
      });
    }

    return insights;
  }

  private _sumAccounts(types: string[]): number {
    return this.accounts
      .filter((a) => types.includes(a.type))
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  }

  private _startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private _toDateString(date: Date): string {
    return DateUtils.toISODateString(date);
  }

  private _addMonths(date: Date, months: number): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  }
}
