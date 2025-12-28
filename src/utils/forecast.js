/**
 * Core Forecast Engine
 * Simulates financial position over time.
 */

class ForecastEngine {
    constructor(transactions, settings = {}) {
        this.transactions = transactions;
        this.settings = settings;
    }

    /**
     * Generate daily forecast for N months
     * @param {number} months - Number of months to forecast
     * @returns {Array} - Array of daily snapshots
     */
    generateForecast(months) {
        const forecastHorizon = months || parseInt(this.settings.forecast_horizon || 6);
        const inflationEnabled = this.settings.forecast_inflation_enabled === 'true';
        const annualInflation = parseFloat(this.settings.forecast_inflation_rate || 2.5) / 100;
        const dailyInflation = Math.pow(1 + annualInflation, 1 / 365);

        const today = new Date();
        const endDate = new Date(today);
        endDate.setMonth(today.getMonth() + forecastHorizon);

        const timeline = [];
        let currentDate = new Date(today);

        const initialAssets = this.getInitialAssets();
        const initialLiabilities = this.getInitialLiabilities();
        const initialCash = this.getInitialCash();

        let currentCash = initialCash;
        let totalProjectedIncome = 0;
        let totalProjectedExpense = 0;

        // Loop day by day
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];

            let dailyIncome = 0;
            let dailyExpense = 0;

            this.transactions.forEach(t => {
                if (!t.is_active) return;
                if (t.type !== 'income' && t.type !== 'expense') return;

                const startDate = new Date(t.start_date);
                const tEndDate = t.end_date ? new Date(t.end_date) : null;

                if (currentDate < startDate) return;
                if (tEndDate && currentDate > tEndDate) return;

                if (this.isDue(t, startDate, currentDate)) {
                    let amount = t.amount;
                    if (inflationEnabled && t.type === 'expense') {
                        const daysSinceStart = Math.floor((currentDate - today) / (1000 * 60 * 60 * 24));
                        if (daysSinceStart > 0) {
                            amount = amount * Math.pow(dailyInflation, daysSinceStart);
                        }
                    }

                    if (t.type === 'income') dailyIncome += amount;
                    if (t.type === 'expense') dailyExpense += amount;
                }
            });

            currentCash += (dailyIncome - dailyExpense);
            totalProjectedIncome += dailyIncome;
            totalProjectedExpense += dailyExpense;

            timeline.push({
                date: dateStr,
                balance: currentCash,
                netWorth: currentCash + (initialAssets - initialCash) - initialLiabilities,
                income: dailyIncome,
                expense: dailyExpense
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }

        const netSavings = totalProjectedIncome - totalProjectedExpense;
        const avgMonthlyExpense = totalProjectedExpense / forecastHorizon;
        const runway = avgMonthlyExpense > 0 ? (currentCash / avgMonthlyExpense) : Infinity;

        return {
            timeline,
            summary: {
                totalIncome: totalProjectedIncome,
                totalExpense: totalProjectedExpense,
                netSavings: netSavings,
                endBalance: currentCash,
                monthlyAvgSavings: netSavings / forecastHorizon,
                runway: runway
            },
            insights: this.generateInsights(timeline, netSavings, runway)
        };
    }

    generateInsights(timeline, netSavings, runway) {
        const insights = [];

        if (netSavings < 0) {
            insights.push({
                type: 'danger',
                title: 'Negative Cash Flow',
                message: `You are projected to spend ${Math.abs(netSavings).toLocaleString()} more than you earn over this period. Consider reducing expenses.`
            });
        } else {
            insights.push({
                type: 'success',
                title: 'Wealth Growth',
                message: `You are on track to save ${netSavings.toLocaleString()} in the next ${timeline.length / 30 | 0} months.`
            });
        }

        if (runway < 3 && runway !== Infinity) {
            insights.push({
                type: 'warning',
                title: 'Low Runway',
                message: `Your current liquid assets only cover ${runway.toFixed(1)} months of projected expenses.`
            });
        }

        // Find zero balance date
        const zeroBalance = timeline.find(day => day.balance < 0);
        if (zeroBalance) {
            insights.push({
                type: 'danger',
                title: 'Projected Deficit',
                message: `Warning: Your balance is projected to drop below zero on ${zeroBalance.date}.`
            });
        }

        return insights;
    }

    getInitialAssets() {
        return this.transactions
            .filter(t => t.type === 'asset' && t.is_active)
            .reduce((sum, t) => sum + t.amount, 0);
    }

    getInitialLiabilities() {
        return this.transactions
            .filter(t => t.type === 'liability' && t.is_active)
            .reduce((sum, t) => sum + t.amount, 0);
    }

    getInitialCash() {
        const liquidCategories = ['Cash', 'Bank', 'Savings', 'Checking'];
        let cash = 0;
        this.transactions.forEach(t => {
            if (t.type === 'asset' && (liquidCategories.includes(t.category) || (t.tags && t.tags.includes('liquid')))) {
                cash += t.amount;
            }
        });
        return cash;
    }

    isDue(transaction, startDate, currentDate) {
        const freq = transaction.frequency;

        // Exact date match for 'once'
        if (freq === 'once') {
            return startDate.toDateString() === currentDate.toDateString();
        }

        const diffTime = Math.abs(currentDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Simple approximations for MVP
        // Better to use library like date-fns but avoiding deps for "beginner friendly" constraint unless needed

        const sDate = startDate.getDate();
        const cDate = currentDate.getDate();
        const sMonth = startDate.getMonth();
        const cMonth = currentDate.getMonth();
        const sDay = startDate.getDay(); // 0-6
        const cDay = currentDate.getDay();

        if (freq === 'weekly') {
            return sDay === cDay;
        }
        if (freq === 'monthly') {
            // Handle end of month edge cases? Simplified: just match Day of Month
            return sDate === cDate;
        }
        if (freq === 'yearly') {
            return sDate === cDate && sMonth === cMonth;
        }
        return false;
    }
}

module.exports = ForecastEngine;
