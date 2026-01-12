/**
 * ForecastEngine
 * --------------------
 * Simulates historical + future financial position day-by-day
 */

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
    forecast_horizon?: string | number;
    forecast_inflation_enabled?: string;
    forecast_inflation_rate?: string | number;
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

export class ForecastEngine {
    private transactions: Transaction[];
    private accounts: Account[];
    private settings: ForecastSettings;

    constructor(transactions: Transaction[], accounts: Account[] = [], settings: ForecastSettings = {}) {
        this.transactions = transactions || [];
        this.accounts = accounts || [];
        this.settings = settings || {};
    }

    generateForecast(months: number | null = null): ForecastResult {
        const horizonMonths = months ?? Number(this.settings.forecast_horizon ?? 6);
        const inflationEnabled = this.settings.forecast_inflation_enabled === 'true';
        const annualInflationRate = Number(this.settings.forecast_inflation_rate ?? 2.5) / 100;
        const dailyInflationRate = Math.pow(1 + annualInflationRate, 1 / 365);

        const today = this._startOfDay(new Date());
        const historyStart = this._addMonths(today, -3);
        const forecastEnd = this._addMonths(today, horizonMonths);

        const initialAssets = this._getInitialAssets();
        const initialLiabilities = this._getInitialLiabilities();
        const initialCash = this._getInitialCash();

        let cash = this._calculateHistoricalCash(initialCash, historyStart, today);

        let totalFutureIncome = 0;
        let totalFutureExpense = 0;

        const timeline: TimelinePoint[] = [];
        const cursor = new Date(historyStart);

        while (cursor <= forecastEnd) {
            const dateStr = this._toDateString(cursor);
            const isFuture = cursor >= today;

            let dailyIncome = 0;
            let dailyExpense = 0;

            this.transactions.forEach(tx => {
                if (!tx.is_active) return;
                if (tx.type !== 'income' && tx.type !== 'expense') return;

                if (!this._transactionApplies(tx, cursor, isFuture)) return;

                let amount = tx.amount;

                if (isFuture && inflationEnabled && tx.type === 'expense') {
                    const daysAhead = this._daysBetween(today, cursor);
                    amount *= Math.pow(dailyInflationRate, daysAhead);
                }

                if (tx.type === 'income') dailyIncome += amount;
                if (tx.type === 'expense') dailyExpense += amount;
            });

            cash += dailyIncome - dailyExpense;

            if (isFuture) {
                totalFutureIncome += dailyIncome;
                totalFutureExpense += dailyExpense;
            }

            timeline.push({
                date: dateStr,
                balance: cash,
                netWorth: cash + (initialAssets - initialCash) - initialLiabilities,
                income: dailyIncome,
                expense: dailyExpense,
                isFuture
            });

            cursor.setDate(cursor.getDate() + 1);
        }

        const netSavings = totalFutureIncome - totalFutureExpense;
        const avgMonthlyExpense = totalFutureExpense / horizonMonths;
        const runway = avgMonthlyExpense > 0 ? initialCash / avgMonthlyExpense : Infinity;

        return {
            timeline,
            summary: {
                totalIncome: totalFutureIncome,
                totalExpense: totalFutureExpense,
                netSavings,
                endBalance: cash,
                monthlyAvgSavings: netSavings / horizonMonths,
                runway
            },
            insights: this._generateInsights(
                timeline.filter(d => d.isFuture),
                netSavings,
                runway
            )
        };
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
                message: `You are projected to spend ${Math.abs(netSavings).toLocaleString()} more than you earn.`
            });
        } else {
            insights.push({
                type: 'success',
                title: 'Wealth Growth',
                message: `You are on track to save ${netSavings.toLocaleString()} over this period.`
            });
        }

        if (runway !== Infinity && runway < 3) {
            insights.push({
                type: 'warning',
                title: 'Low Runway',
                message: `Your liquid assets cover only ${runway.toFixed(1)} months of expenses.`
            });
        }

        const deficitDay = futureTimeline.find(d => d.balance < 0);
        if (deficitDay) {
            insights.push({
                type: 'danger',
                title: 'Projected Deficit',
                message: `Your balance is projected to drop below zero on ${deficitDay.date}.`
            });
        }

        return insights;
    }

    private _calculateHistoricalCash(todayCash: number, historyStart: Date, today: Date): number {
        let cash = todayCash;

        this.transactions.forEach(tx => {
            if (!tx.is_active) return;
            if (tx.type !== 'income' && tx.type !== 'expense') return;

            const txDate = this._startOfDay(new Date(tx.start_date));
            if (txDate >= historyStart && txDate < today) {
                if (tx.type === 'income') cash -= tx.amount;
                if (tx.type === 'expense') cash += tx.amount;
            }
        });

        return cash;
    }

    private _transactionApplies(tx: Transaction, date: Date, isFuture: boolean): boolean {
        const start = this._startOfDay(new Date(tx.start_date));
        const end = tx.end_date ? this._startOfDay(new Date(tx.end_date)) : null;

        if (date < start) return false;
        if (end && date > end) return false;

        if (!isFuture) {
            return this._toDateString(start) === this._toDateString(date);
        }

        return this._isDue(tx.frequency, start, date);
    }

    private _isDue(freq: string, start: Date, date: Date): boolean {
        if (freq === 'once') {
            return this._toDateString(start) === this._toDateString(date);
        }

        if (freq === 'weekly') {
            return start.getDay() === date.getDay();
        }

        if (freq === 'monthly') {
            const dayOfStart = start.getDate();
            const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
            const triggerDay = Math.min(dayOfStart, lastDayOfMonth);
            return date.getDate() === triggerDay;
        }

        if (freq === 'yearly') {
            const dayOfStart = start.getDate();
            const monthOfStart = start.getMonth();
            if (date.getMonth() !== monthOfStart) return false;

            const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
            const triggerDay = Math.min(dayOfStart, lastDayOfMonth);
            return date.getDate() === triggerDay;
        }

        return false;
    }

    private _getInitialAssets(): number {
        return this.accounts
            .filter(a => ['bank', 'wallet', 'investment', 'asset'].includes(a.type))
            .reduce((sum, a) => sum + a.balance, 0);
    }

    private _getInitialLiabilities(): number {
        return this.accounts
            .filter(a => ['credit_card', 'loan', 'liability'].includes(a.type))
            .reduce((sum, a) => sum + a.balance, 0);
    }

    private _getInitialCash(): number {
        return this.accounts
            .filter(a => ['bank', 'wallet'].includes(a.type))
            .reduce((sum, a) => sum + a.balance, 0);
    }

    private _startOfDay(date: Date): Date {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    private _toDateString(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    private _addMonths(date: Date, months: number): Date {
        const d = new Date(date);
        d.setMonth(d.getMonth() + months);
        return d;
    }

    private _daysBetween(a: Date, b: Date): number {
        return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
    }
}
