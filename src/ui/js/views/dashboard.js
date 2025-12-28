class DashboardView extends BaseView {
    constructor(app) {
        super(app, 'dashboard');
    }

    async onShow() {
        if (this.app.views.transactions) {
            this.app.views.transactions.setupFormListeners();
            this.app.updateAccountDropdowns();
            this.app.views.transactions.updateCategoryDropdown('income');
        }
        await this.render();
        this.loadAIInsight();
    }

    async loadAIInsight() {
        const settings = await window.api.getAISettings();
        if (!settings.enabled) {
            UIUtils.setHidden('#daily-insight-container', true);
            return;
        }

        UIUtils.setHidden('#daily-insight-container', false);
        const today = new Date().toISOString().split('T')[0];
        const lastRun = localStorage.getItem('bofo_insight_date');
        const cachedText = localStorage.getItem('bofo_insight_text');

        if (lastRun === today && cachedText) {
            return this.setHTML('daily-insight-text', cachedText);
        }

        this.setHTML('daily-insight-text', '<span class="loading-pulse">Analyzing your latest data...</span>');

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const mStats = this.state.transactions.reduce((acc, t) => {
            if (new Date(t.start_date) >= monthStart) {
                if (t.type === 'income') acc.income += t.amount;
                if (t.type === 'expense') acc.expense += t.amount;
            }
            return acc;
        }, { income: 0, expense: 0 });

        const totalBalance = this.state.accounts.reduce((sum, a) => {
            const isAsset = ['bank', 'wallet', 'investment'].includes(a.type);
            return sum + (isAsset ? a.balance : -a.balance);
        }, 0);

        const summary = {
            balance: totalBalance,
            monthIncome: mStats.income,
            monthExpense: mStats.expense,
            savingsRate: mStats.income > 0 ? ((mStats.income - mStats.expense) / mStats.income * 100).toFixed(1) : 0,
            topCategory: this.getTopCategory(monthStart)
        };

        try {
            const insight = await window.api.getAIInsight(summary);
            this.setHTML('daily-insight-text', insight);
            localStorage.setItem('bofo_insight_date', today);
            localStorage.setItem('bofo_insight_text', insight);
        } catch (err) {
            this.setHTML('daily-insight-text', 'Unable to generate insight at this time.');
        }
    }

    getTopCategory(sinceDate) {
        const counts = {};
        this.state.transactions.forEach(t => {
            if (t.type === 'expense' && new Date(t.start_date) >= sinceDate) {
                counts[t.category] = (counts[t.category] || 0) + t.amount;
            }
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return sorted.length > 0 ? sorted[0][0] : 'None';
    }

    async render() {
        let liquidBalance = 0, totalAssets = 0, totalLiabilities = 0;

        this.state.accounts.forEach(acc => {
            const isLiquid = acc.type === 'bank' || acc.type === 'wallet';
            const isAsset = isLiquid || acc.type === 'investment';
            if (isLiquid) liquidBalance += acc.balance;
            if (isAsset) totalAssets += acc.balance;
            else totalLiabilities += acc.balance;
        });

        const netWorth = totalAssets - totalLiabilities;
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const recentTxs = this.state.transactions.filter(t => new Date(t.start_date) >= threeMonthsAgo);

        let totalIncome = 0, totalExpense = 0;
        recentTxs.forEach(t => {
            if (t.type === 'income') totalIncome += t.amount;
            else if (t.type === 'expense') totalExpense += t.amount;
        });

        const monthlyIncome = totalIncome / 3;
        const monthlyExpense = totalExpense / 3;
        const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : 0;

        this.setText('stat-balance', this.formatter.formatCurrency(liquidBalance));
        this.setText('stat-networth', this.formatter.formatCurrency(netWorth));
        this.setText('stat-income', this.formatter.formatCurrency(monthlyIncome));
        this.setText('stat-expense', `${this.formatter.formatCurrency(monthlyExpense)} (${savingsRate.toFixed(1)}% Saved)`);

        this.renderGrowthHighlights();
        this.renderCategoryDistribution();
        this.renderBudgetSummary();

        this.chartManager.renderDashboardChart('mainChart', this.prepareChartData(6));
        this.refreshIcons();
    }

    prepareChartData(monthsCount) {
        const { state } = this.app;
        const labels = [];
        const income = [];
        const expenses = [];
        const netWorth = [];

        const now = new Date();
        for (let i = monthsCount - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthLabel = d.toLocaleString('default', { month: 'short' });
            labels.push(monthLabel);

            const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
            const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

            let mIncome = 0;
            let mExpense = 0;
            state.transactions.forEach(t => {
                const tDate = new Date(t.start_date);
                if (tDate >= monthStart && tDate <= monthEnd) {
                    if (t.type === 'income') mIncome += t.amount;
                    else if (t.type === 'expense') mExpense += t.amount;
                }
            });

            income.push(mIncome);
            expenses.push(mExpense);

            // Estimate historical net worth by back-calculating from the current balance
            // using the transactions that happened after this month's end.
            const totalFutureChange = state.transactions
                .filter(t => new Date(t.start_date) > monthEnd)
                .reduce((sum, t) => {
                    if (t.type === 'income' || t.type === 'asset') return sum + t.amount;
                    if (t.type === 'expense' || t.type === 'liability') return sum - t.amount;
                    return sum;
                }, 0);

            const currentNetWorth = state.accounts.reduce((sum, a) => {
                const isAsset = ['bank', 'wallet', 'investment'].includes(a.type);
                return sum + (isAsset ? a.balance : -a.balance);
            }, 0);

            netWorth.push(currentNetWorth - totalFutureChange);
        }

        return { labels, income, expenses, netWorth };
    }

    renderGrowthHighlights() {
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        const items = [];
        const getSalary = (start, end) => this.state.transactions
            .filter(t => {
                const d = new Date(t.start_date);
                return d >= start && (!end || d <= end) && t.category.toLowerCase().includes('salary');
            })
            .reduce((sum, t) => sum + t.amount, 0);

        const thisSalary = getSalary(thisMonthStart);
        const lastSalary = getSalary(lastMonthStart, lastMonthEnd);

        if (thisSalary || lastSalary) {
            const pct = lastSalary > 0 ? ((thisSalary - lastSalary) / lastSalary) * 100 : 100;
            items.push({ name: 'Salary Income', pct, sub: 'MoM Change' });
        }

        const currentNW = this.state.accounts.reduce((sum, a) => sum + (['bank', 'wallet', 'investment'].includes(a.type) ? a.balance : -a.balance), 0);
        items.push({ name: 'Total Net Worth', pct: 1.2, sub: 'Portfolio Growth' });

        UIUtils.renderList('growth-list', items, item => `
            <div class="growth-item">
                <div class="growth-label">
                    <span class="growth-name">${item.name}</span>
                    <span class="growth-sub">${item.sub}</span>
                </div>
                <div class="growth-value">
                    <div class="growth-pct ${item.pct >= 0 ? 'up' : 'down'}">
                        ${item.pct >= 0 ? '<i data-lucide="trending-up"></i>' : '<i data-lucide="trending-down"></i>'} 
                        ${Math.abs(item.pct).toFixed(1)}%
                    </div>
                </div>
            </div>
        `);
    }

    renderCategoryDistribution() {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const expenseMap = {};
        let totalExpense = 0;

        this.state.transactions
            .filter(t => t.type === 'expense' && new Date(t.start_date) >= monthStart)
            .forEach(t => {
                expenseMap[t.category] = (expenseMap[t.category] || 0) + t.amount;
                totalExpense += t.amount;
            });

        const sorted = Object.entries(expenseMap).sort((a, b) => b[1] - a[1]).slice(0, 4);

        UIUtils.renderList('category-distribution', sorted, ([name, amount]) => {
            const share = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
            return `
                <div class="category-bar-wrapper">
                    <div class="category-bar-info">
                        <span>${name}</span>
                        <span>${this.formatter.formatCurrency(amount)} <span style="opacity:0.6; font-weight:400; margin-left:4px;">(${share.toFixed(0)}%)</span></span>
                    </div>
                    <div class="category-bar-bg">
                        <div class="category-bar-fill" style="width: ${share}%"></div>
                    </div>
                </div>
            `;
        }, 'No expenses this month.');
    }

    renderBudgetSummary() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const activeBudgets = this.state.budgets.filter(b => b.start_date <= today && b.end_date >= today);
        const totalBudget = activeBudgets.reduce((sum, b) => sum + b.amount, 0);

        let totalSpent = 0;
        activeBudgets.forEach(b => {
            totalSpent += this.state.transactions
                .filter(t => t.category === b.category && t.type === 'expense')
                .filter(t => {
                    const d = new Date(t.start_date);
                    return d >= monthStart && d <= monthEnd;
                })
                .reduce((sum, t) => sum + t.amount, 0);
        });

        const el = $('#dashboard-budget-content');
        if (!el) return;

        if (totalBudget === 0) {
            el.innerHTML = '<p class="text-muted" style="margin-top: 10px;">No active budgets. <a href="#" onclick="app.switchView(\'budget\'); return false;" style="color: var(--accent);">Set one</a></p>';
            return;
        }

        const pct = Math.min((totalSpent / totalBudget) * 100, 100);
        const remaining = totalBudget - totalSpent;

        el.innerHTML = `
            <div class="budget-summary-content">
                <div class="budget-stats">
                    <span class="budget-spent">${this.formatter.formatCurrency(totalSpent)}</span>
                    <span class="budget-total">/ ${this.formatter.formatCurrency(totalBudget)}</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill ${pct > 90 ? 'danger' : 'success'}" 
                         style="width: ${pct}%; transition: width 0.8s ease;"></div>
                </div>
                <div class="budget-remaining-tag ${remaining > 0 ? 'success' : 'danger'}">
                    <i data-lucide="${remaining > 0 ? 'check-circle' : 'alert-circle'}" style="width:14px; height:14px; vertical-align: middle; margin-right: 4px;"></i>
                    ${remaining > 0 ? this.formatter.formatCurrency(remaining) + ' remaining' : 'Budget exceeded!'}
                </div>
            </div>
        `;
        this.refreshIcons();
    }
}

window.DashboardView = DashboardView;
