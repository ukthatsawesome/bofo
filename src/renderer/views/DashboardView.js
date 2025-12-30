import { BaseView } from './BaseView.js';
import { $, UIUtils } from '../core/dom.js';
import { StatCard } from '../components/common/StatCard.js';
import { ProgressBar } from '../components/common/ProgressBar.js';
import { InsightCard } from '../components/common/InsightCard.js';
import { GridCard } from '../components/common/GridCard.js';
import { ListItem } from '../components/common/ListItem.js';

export class DashboardView extends BaseView {
    constructor(app) {
        super(app, 'dashboard');
    }

    async onShow() {
        if (!this.isInitialized) {
            this.renderBaseTemplate();
            this.isInitialized = true;
        }

        if (this.app.updateAccountDropdowns) {
            this.app.updateAccountDropdowns();
        }
        await this.render();
        this.loadAIInsight();
    }

    renderBaseTemplate() {
        this.element.innerHTML = `
            <div class="view-header">
                <div class="header-main">
                    <h1>Financial Dashboard</h1>
                    <p class="text-muted">Welcome back, here's your financial overview</p>
                </div>
                <div class="header-actions">
                    <!-- Global Actions Removed -->
                </div>
            </div>

            <div id="dashboard-stats-container" class="stats-grid mb-6"></div>

            <div id="dashboard-insight-container" class="mb-6"></div>

            <div class="dashboard-grid">
                <div class="dashboard-main-col">
                    <div class="card h-full flex flex-col">
                        <div class="card-header">
                            <h3><i data-lucide="line-chart"></i> Net Worth & Cash Flow</h3>
                        </div>
                        <div class="card-body flex-1 flex flex-col pt-0">
                            <div class="chart-container flex-1 relative min-h-[350px]">
                                <canvas id="mainChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="dashboard-side-col">
                    <div id="quick-transaction-widget"></div>
                </div>
            </div>

            <div id="dashboard-insights-grid" class="dashboard-insights-grid mt-6"></div>
        `;
        this.refreshIcons();
    }

    async loadAIInsight() {
        const settings = await window.api.getAISettings();
        const container = $('#dashboard-insight-container');
        if (!container) return;

        if (!settings.enabled) {
            UIUtils.setHidden('#dashboard-insight-container', true);
            return;
        }

        UIUtils.setHidden('#dashboard-insight-container', false);
        const today = new Date().toISOString().split('T')[0];
        const lastRun = localStorage.getItem('bofo_insight_date');
        const cachedText = localStorage.getItem('bofo_insight_text');

        if (lastRun === today && cachedText) {
            container.innerHTML = InsightCard({
                title: "Bofo's Insight",
                message: cachedText
            });
            this.refreshIcons();
            return;
        }

        container.innerHTML = InsightCard({
            title: "Bofo's Insight",
            message: '<span class="loading-pulse">Analyzing your latest data...</span>'
        });
        this.refreshIcons();

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
            const text = await window.api.getAIInsight(mStats);
            localStorage.setItem('bofo_insight_date', today);
            localStorage.setItem('bofo_insight_text', text);
            container.innerHTML = InsightCard({
                title: "Bofo's Insight",
                message: text
            });
        } catch (err) {
            container.innerHTML = InsightCard({
                title: "Bofo's Insight",
                message: "I couldn't analyze your data right now. Let's try again later."
            });
        }
        this.refreshIcons();
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

        // Render stats using components
        const statsContainer = $('#dashboard-stats-container');
        if (statsContainer) {
            statsContainer.innerHTML = `
                ${StatCard({
                label: 'Current Balance',
                value: this.formatter.formatCurrency(liquidBalance),
                icon: 'landmark'
            })}
                ${StatCard({
                label: 'Net Worth',
                value: this.formatter.formatCurrency(netWorth),
                icon: 'gem'
            })}
                ${StatCard({
                label: 'Average Income',
                value: this.formatter.formatCurrency(monthlyIncome),
                icon: 'wallet'
            })}
                ${StatCard({
                label: 'Average Expenses',
                value: this.formatter.formatCurrency(monthlyExpense),
                icon: 'trending-down',
                trend: { type: savingsRate >= 20 ? 'up' : 'down', value: `${savingsRate.toFixed(1)}% Saved` }
            })}
            `;
        }

        // Render Insights Grid using Components
        const gridContainer = $('#dashboard-insights-grid');
        if (gridContainer) {
            gridContainer.innerHTML = `
                ${GridCard({
                title: 'Growth Highlights',
                icon: 'trending-up',
                content: '<div id="growth-list" class="flex flex-col gap-4"></div>'
            })}
                ${GridCard({
                title: 'Top Categories',
                icon: 'pie-chart',
                content: '<div id="category-distribution" class="flex flex-col gap-4"></div>'
            })}
                ${GridCard({
                title: 'Current Budget',
                icon: 'target',
                content: '<div id="dashboard-budget-content" class="flex flex-col gap-4 min-h-[120px] justify-center"></div>'
            })}
            `;
        }

        this.renderGrowthHighlights();
        this.renderCategoryDistribution();
        this.renderBudgetSummary();
        this.renderQuickTransaction();

        this.chartManager.renderDashboardChart('mainChart', this.prepareChartData(6));
        // Global refresh after all sub-renders
        this.refreshIcons();
    }

    renderQuickTransaction() {
        const container = $('#quick-transaction-widget');
        if (!container) return;

        const { state } = this.app;
        const currentType = this.quickTxType || 'expense';

        container.innerHTML = `
            <div class="card quick-tx-card h-full">
                <div class="card-header flex-row justify-between align-center py-3">
                    <h3 class="text-sm font-bold uppercase tracking-wider text-text-muted">Quick Record</h3>
                    <div class="tx-type-toggle-sm" id="quick-tx-type-toggle">
                        <button class="segment icon-btn ${currentType === 'income' ? 'active' : ''}" data-type="income" title="Income">
                            <i data-lucide="trending-up" class="w-4 h-4"></i>
                        </button>
                        <button class="segment icon-btn ${currentType === 'expense' ? 'active' : ''}" data-type="expense" title="Expense">
                            <i data-lucide="trending-down" class="w-4 h-4"></i>
                        </button>
                        <button class="segment icon-btn ${currentType === 'transfer' ? 'active' : ''}" data-type="transfer" title="Transfer">
                            <i data-lucide="arrow-right-left" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body flex-col gap-4">
                    <div class="quick-tx-amount-container">
                        <span class="currency-prefix text-text-muted">$</span>
                        <input type="number" id="quick-tx-amount" placeholder="0.00" step="0.01" class="amount-input">
                    </div>

                    <div class="form-grid-condensed">
                        <div class="form-group mb-0">
                            <label class="text-[10px] font-bold uppercase text-text-muted mb-1">Account</label>
                            <select id="quick-tx-account" class="form-control sm"></select>
                        </div>
                        <div class="form-group mb-0 ${currentType === 'transfer' ? '' : 'hidden'}" id="quick-tx-to-account-group">
                            <label class="text-[10px] font-bold uppercase text-text-muted mb-1">To Account</label>
                            <select id="quick-tx-to-account" class="form-control sm"></select>
                        </div>
                        <div class="form-group mb-0 ${currentType === 'transfer' ? 'hidden' : ''}" id="quick-tx-category-group">
                            <label class="text-[10px] font-bold uppercase text-text-muted mb-1">Category</label>
                            <select id="quick-tx-category" class="form-control sm"></select>
                        </div>
                        <div class="form-group mb-0">
                            <label class="text-[10px] font-bold uppercase text-text-muted mb-1">Date</label>
                            <input type="date" id="quick-tx-date" class="form-control sm" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                    </div>

                    <div class="form-group mb-0">
                        <label class="text-[10px] font-bold uppercase text-text-muted mb-1">Description</label>
                        <input type="text" id="quick-tx-desc" placeholder="Notes..." class="form-control sm">
                    </div>

                    <button class="btn secondary w-full py-3 font-bold mt-2" id="btn-quick-save">
                        Record Transaction
                    </button>
                </div>
            </div>
        `;

        this.populateQuickTxDropdowns();
        this.setupQuickTxListeners();
        // Crucial: Refresh icons after dynamic widget update
        this.refreshIcons();
    }

    populateQuickTxDropdowns() {
        const { state } = this.app;
        const currentType = this.quickTxType || 'expense';

        // Account dropdowns
        const accHtml = state.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
        const accSelect = $('#quick-tx-account');
        const toAccSelect = $('#quick-tx-to-account');
        if (accSelect) accSelect.innerHTML = accHtml;
        if (toAccSelect) toAccSelect.innerHTML = accHtml;

        // Category dropdown
        const categories = state.categories.filter(c => c.type === (currentType === 'income' ? 'income' : 'expense'));
        const catHtml = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        const catSelect = $('#quick-tx-category');
        if (catSelect) catSelect.innerHTML = catHtml;
    }

    setupQuickTxListeners() {
        // Type Toggles
        document.querySelectorAll('#quick-tx-type-toggle .segment').forEach(btn => {
            btn.addEventListener('click', () => {
                this.quickTxType = btn.dataset.type;
                this.renderQuickTransaction();
            });
        });

        // Save Button
        $('#btn-quick-save')?.addEventListener('click', () => this.handleQuickSave());
    }

    async handleQuickSave() {
        const amount = parseFloat($('#quick-tx-amount').value);
        if (isNaN(amount) || amount <= 0) {
            this.app.notifications.toast('Error', 'Please enter a valid amount', 'error');
            return;
        }

        const type = this.quickTxType || 'expense';
        const tx = {
            start_date: $('#quick-tx-date').value,
            category: type === 'transfer' ? 'Transfer' : $('#quick-tx-category').value,
            account_id: parseInt($('#quick-tx-account').value),
            description: $('#quick-tx-desc').value || (type === 'transfer' ? 'Internal Transfer' : 'Quick entry'),
            amount: amount,
            type: type
        };

        if (type === 'transfer') {
            tx.to_account_id = parseInt($('#quick-tx-to-account').value);
            if (tx.account_id === tx.to_account_id) {
                this.app.notifications.toast('Error', 'Source and destination accounts must be different', 'error');
                return;
            }
        }

        try {
            await window.api.saveTransaction(tx);
            this.app.notifications.toast('Success', 'Transaction recorded', 'success');

            // Clear or Refresh
            $('#quick-tx-amount').value = '';
            $('#quick-tx-desc').value = '';

            // Refresh dashboard data
            await this.app.state.loadTransactions();
            await this.app.state.loadAccounts();
            this.render();
        } catch (err) {
            this.app.notifications.toast('Error', 'Failed to save transaction', 'error');
        }
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

        UIUtils.renderList('growth-list', items, item => ListItem({
            label: item.name,
            sublabel: item.sub,
            value: `${Math.abs(item.pct).toFixed(1)}%`,
            trendType: item.pct >= 0 ? 'up' : 'down'
        }));
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
            return ProgressBar({
                label: name,
                value: this.formatter.formatCurrency(amount),
                percent: share
            });
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

        const share = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
        el.innerHTML = ProgressBar({
            label: 'Monthly Spending',
            value: `${this.formatter.formatCurrency(totalSpent)} of ${this.formatter.formatCurrency(totalBudget)}`,
            percent: Math.min(share, 100),
            color: share > 100 ? 'var(--expense)' : (share > 85 ? 'var(--warning)' : 'var(--income)')
        });
    }
}

window.DashboardView = DashboardView;
