/**
 * ForecastEngine
 * --------------------
 * Simulates historical + future financial position day-by-day
 */

class ForecastEngine {
    constructor(transactions, accounts = [], settings = {}, recurringCharges = []) {
        this.transactions = transactions || [];
        this.accounts = accounts || [];
        this.settings = settings || {};
        this.recurringCharges = recurringCharges || [];
    }

    /* ==================== PUBLIC API ==================== */

    generateForecast(months = null) {
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

        // Back-calculate cash at history start
        let cash = this._calculateHistoricalCash(initialCash, historyStart, today);

        let totalFutureIncome = 0;
        let totalFutureExpense = 0;

        const timeline = [];
        let cursor = new Date(historyStart);

        while (cursor <= forecastEnd) {
            const dateStr = this._toDateString(cursor);
            const isFuture = cursor >= today;

            let dailyIncome = 0;
            let dailyExpense = 0;

            // Process regular transactions
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

            // Process recurring charges (Only for future dates)
            if (isFuture) {
                this.recurringCharges.forEach(charge => {
                    if (!charge.is_active) return;
                    if (!this._recurringChargeApplies(charge, cursor)) return;

                    let amount = charge.amount;
                    if (inflationEnabled) {
                        const daysAhead = this._daysBetween(today, cursor);
                        amount *= Math.pow(dailyInflationRate, daysAhead);
                    }

                    dailyExpense += amount;
                });
            }

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
        const runway =
            avgMonthlyExpense > 0 ? initialCash / avgMonthlyExpense : Infinity;

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

    /* ==================== INSIGHTS ==================== */

    _generateInsights(futureTimeline, netSavings, runway) {
        const insights = [];

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

    /* ==================== CASH CALCULATION ==================== */

    _calculateHistoricalCash(todayCash, historyStart, today) {
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

    /* ==================== TRANSACTION LOGIC ==================== */

    _transactionApplies(tx, date, isFuture) {
        const start = this._startOfDay(new Date(tx.start_date));
        const end = tx.end_date ? this._startOfDay(new Date(tx.end_date)) : null;

        if (date < start) return false;
        if (end && date > end) return false;

        if (!isFuture) {
            return this._toDateString(start) === this._toDateString(date);
        }

        return this._isDue(tx.frequency, start, date);
    }

    _isDue(freq, start, date) {
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

    _recurringChargeApplies(charge, date) {
        const freq = charge.frequency;
        const dueDay = charge.due_day || 1;

        if (freq === 'weekly') {
            // For weekly recurring charges, we assume it's the same day of week as creation
            const start = this._startOfDay(new Date(charge.created_at || Date.now()));
            return start.getDay() === date.getDay();
        }

        if (freq === 'monthly') {
            const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
            const triggerDay = Math.min(dueDay, lastDayOfMonth);
            return date.getDate() === triggerDay;
        }

        if (freq === 'yearly') {
            // For yearly, we use the month of creation and the due_day
            const start = this._startOfDay(new Date(charge.created_at || Date.now()));
            const monthOfStart = start.getMonth();
            if (date.getMonth() !== monthOfStart) return false;

            const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
            const triggerDay = Math.min(dueDay, lastDayOfMonth);
            return date.getDate() === triggerDay;
        }

        return false;
    }

    /* ==================== INITIAL VALUES ==================== */

    _getInitialAssets() {
        return this.accounts
            .filter(a => ['bank', 'wallet', 'investment', 'asset'].includes(a.type))
            .reduce((sum, a) => sum + a.balance, 0);
    }

    _getInitialLiabilities() {
        return this.accounts
            .filter(a => ['credit_card', 'loan', 'liability'].includes(a.type))
            .reduce((sum, a) => sum + a.balance, 0);
    }

    _getInitialCash() {
        return this.accounts
            .filter(a => ['bank', 'wallet'].includes(a.type))
            .reduce((sum, a) => sum + a.balance, 0);
    }

    /* ==================== DATE HELPERS ==================== */

    _startOfDay(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    _toDateString(date) {
        return date.toISOString().split('T')[0];
    }

    _addMonths(date, months) {
        const d = new Date(date);
        d.setMonth(d.getMonth() + months);
        return d;
    }

    _daysBetween(a, b) {
        return Math.max(
            0,
            Math.floor((b - a) / (1000 * 60 * 60 * 24))
        );
    }
}

module.exports = ForecastEngine;
