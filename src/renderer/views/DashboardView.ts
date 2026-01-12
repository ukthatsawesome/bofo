import { BaseView } from './BaseView';
import { $, UIUtils } from '../core/dom';
import { StatCard } from '../components/common/StatCard';
import { ProgressBar } from '../components/common/ProgressBar';
import { InsightCard } from '../components/common/InsightCard';
import { Card } from '../components/common/Card';
import { ListItem } from '../components/common/ListItem';
import { ViewHeader } from '../components/common/ViewHeader';
import type { App } from '../core/app';

export class DashboardView extends BaseView {
    private quickTxType: string = 'expense';

    constructor(app: App) {
        super(app, 'dashboard');
    }

    async onShow(): Promise<void> {
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

    renderBaseTemplate(): void {
        if (!this.element) return;
        this.element.innerHTML = `
            ${ViewHeader({
            title: 'Financial Dashboard',
            subtitle: "Welcome back, here's your financial overview"
        })}

            <div id="dashboard-stats-container" class="stats-grid mb-6"></div>

            <div id="dashboard-insight-container" class="mb-6"></div>

            <div class="dashboard-grid">
                <div class="dashboard-main-col">
                    ${Card({
            title: 'Net Worth & Cash Flow',
            icon: 'line-chart',
            variant: 'default',
            className: 'h-full flex flex-col',
            bodyClass: 'flex-1 flex flex-col pt-0',
            content: `
                            <div class="chart-container flex-1 relative min-h-[350px]">
                                <canvas id="mainChart"></canvas>
                            </div>
                        `
        })}
                </div>
                <div class="dashboard-side-col">
                    <div id="quick-transaction-widget"></div>
                </div>
            </div>

            <div id="dashboard-insights-grid" class="dashboard-insights-grid mt-6"></div>
        `;
        this.refreshIcons();
    }

    async loadAIInsight(): Promise<void> {
        const container = $('#dashboard-insight-container');
        if (!container) return;

        // Always show insight container
        UIUtils.setHidden('#dashboard-insight-container', false);

        // Prepare summary data
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

        const topCategory = this.getTopCategory(monthStart);
        const topCategoryAmount = this._getTopCategoryAmount();

        const summary = {
            balance: totalBalance,
            monthIncome: mStats.income,
            monthExpense: mStats.expense,
            savingsRate: mStats.income > 0 ? ((mStats.income - mStats.expense) / mStats.income * 100).toFixed(1) : 0,
            topCategory,
            topCategoryAmount
        };

        // Try to get cached insight first (show immediately if available)
        const cachedInsight = this.app.aiCache.getCached('dashboard', summary);
        if (cachedInsight) {
            container.innerHTML = InsightCard({
                title: cachedInsight.title,
                message: cachedInsight.text,
                icon: cachedInsight.icon
            });
            this.refreshIcons(container);
            return;
        }

        // Show loading state
        const settings = await window.api.getAISettings();
        container.innerHTML = InsightCard({
            title: settings.enabled ? 'AI Financial Insight' : 'Financial Insight',
            message: '<span class="loading-pulse">Analyzing your latest data...</span>',
            icon: settings.enabled ? 'sparkles' : 'lightbulb'
        });
        this.refreshIcons(container);

        // Fetch insight using cache system
        try {
            const insight = await this.app.aiCache.fetchInsight(
                'dashboard',
                summary,
                async (data: any) => await window.api.getAIInsight(data),
                (data: any) => (this.app as any).fallbackGenerator.generateDashboardInsight(data),
                {
                    aiTitle: 'AI Financial Insight',
                    fallbackTitle: 'Financial Insight',
                    ttl: 24 * 60 * 60 * 1000 // 24 hours
                }
            );

            container.innerHTML = InsightCard({
                title: insight.title,
                message: insight.text,
                icon: insight.icon
            });
            this.refreshIcons(container);
        } catch (err) {
            console.error('Failed to load insight:', err);
            // Show fallback on error
            const fallbackText = (this.app as any).fallbackGenerator.generateDashboardInsight(summary);
            container.innerHTML = InsightCard({
                title: 'Financial Insight',
                message: fallbackText,
                icon: 'lightbulb'
            });
            this.refreshIcons(container);
        }
    }

    _getTopCategoryAmount(): number {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const counts: Record<string, number> = {};
        this.state.transactions.forEach(t => {
            if (t.type === 'expense' && new Date(t.start_date) >= monthStart) {
                counts[t.category] = (counts[t.category] || 0) + t.amount;
            }
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return sorted.length > 0 ? sorted[0][1] : 0;
    }

    getTopCategory(sinceDate: Date): string {
        const counts: Record<string, number> = {};
        this.state.transactions.forEach(t => {
            if (t.type === 'expense' && new Date(t.start_date) >= sinceDate) {
                counts[t.category] = (counts[t.category] || 0) + t.amount;
            }
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return sorted.length > 0 ? sorted[0][0] : 'None';
    }

    async render(): Promise<void> {
        // Load exchange rates for currency conversion
        await this.formatter.loadExchangeRates();

        const baseCurrency = this.state.getBaseCurrency();
        let liquidBalance = 0, totalAssets = 0, totalLiabilities = 0;

        // Calculate balances with currency conversion to base currency
        this.state.accounts.forEach(acc => {
            const isLiquid = acc.type === 'bank' || acc.type === 'wallet';
            const isAsset = isLiquid || acc.type === 'investment';

            // Convert balance to base currency
            const convertedBalance = this.formatter.toBase(acc.balance, acc.currency || baseCurrency);

            if (isLiquid) liquidBalance += convertedBalance;
            if (isAsset) totalAssets += convertedBalance;
            else totalLiabilities += convertedBalance;
        });

        const netWorth = totalAssets - totalLiabilities;
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const recentTxs = this.state.transactions.filter(t => new Date(t.start_date) >= threeMonthsAgo);

        let totalIncome = 0, totalExpense = 0;
        recentTxs.forEach(t => {
            // Convert transaction amounts to base currency
            const txCurrency = t.currency || baseCurrency;
            const convertedAmount = this.formatter.toBase(t.amount, txCurrency);

            if (t.type === 'income') totalIncome += convertedAmount;
            else if (t.type === 'expense') totalExpense += convertedAmount;
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
                ${Card({
                title: 'Growth Highlights',
                icon: 'trending-up',
                variant: 'panel',
                content: '<div id="growth-list" class="flex flex-col gap-4"></div>'
            })}
                ${Card({
                title: 'Top Categories',
                icon: 'pie-chart',
                variant: 'panel',
                content: '<div id="category-distribution" class="flex flex-col gap-4"></div>'
            })}
                ${Card({
                title: 'Current Budget',
                icon: 'target',
                variant: 'panel',
                content: '<div id="dashboard-budget-content" class="flex flex-col gap-4 min-h-[120px] justify-center"></div>'
            })}
            `;
        }

        this.renderGrowthHighlights();
        this.renderCategoryDistribution();
        this.renderBudgetSummary();
        this.renderQuickTransaction();

        this.chartManager.renderDashboardChart('mainChart', this.prepareChartData(6));
        // Targeted refresh after sub-renders
        this.refreshIcons('#dashboard-stats-container');
        this.refreshIcons('#dashboard-insights-grid');
    }

    renderQuickTransaction(): void {
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
                        <div class="form-group mb-0">
                            <label class="text-[10px] font-bold uppercase text-text-muted mb-1">Frequency</label>
                            <select id="quick-tx-frequency" class="form-control sm">
                                <option value="once" selected>Once</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="yearly">Yearly</option>
                            </select>
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
        this.refreshIcons(container);
    }

    populateQuickTxDropdowns(): void {
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

    setupQuickTxListeners(): void {
        // Type Toggles
        document.querySelectorAll('#quick-tx-type-toggle .segment').forEach(btn => {
            btn.addEventListener('click', () => {
                this.quickTxType = (btn as HTMLElement).dataset.type || 'expense';
                this.renderQuickTransaction();
            });
        });

        // Save Button
        const btnSave = $('#btn-quick-save');
        if (btnSave) {
            btnSave.addEventListener('click', () => this.handleQuickSave());
        }
    }

    /**
     * Validates the quick transaction amount input
     */
    _validateQuickTxAmount(): { valid: boolean, amount: number } {
        const input = $('#quick-tx-amount') as HTMLInputElement;
        const amount = parseFloat(input.value);
        if (isNaN(amount) || amount <= 0) {
            this.app.notifications.toast('Error', 'Please enter a valid amount', 'error');
            return { valid: false, amount: 0 };
        }
        return { valid: true, amount };
    }

    /**
     * Builds a transaction object from quick transaction form inputs
     */
    _buildQuickTransaction(amount: number, type: string): { tx: any, valid: boolean } {
        const accInput = $('#quick-tx-account') as HTMLSelectElement;
        const accountId = parseInt(accInput.value);
        const account = this.state.accounts.find(a => a.id === accountId);

        // Validate sufficient balance for expenses and transfers
        if ((type === 'expense' || type === 'transfer') && account) {
            if (amount > account.balance) {
                this.app.notifications.toast(
                    'Insufficient Balance',
                    `Account "${account.name}" only has ${this.formatter.formatCurrency(account.balance)} available`,
                    'error'
                );
                return { tx: null, valid: false };
            }
        }

        const dateInput = $('#quick-tx-date') as HTMLInputElement;
        const catInput = $('#quick-tx-category') as HTMLSelectElement;
        const descInput = $('#quick-tx-desc') as HTMLInputElement;
        const freqInput = $('#quick-tx-frequency') as HTMLSelectElement;

        const tx: any = {
            start_date: dateInput.value,
            category: type === 'transfer' ? 'Transfer' : catInput.value,
            account_id: accountId,
            description: descInput.value || (type === 'transfer' ? 'Internal Transfer' : 'Quick entry'),
            amount,
            type,
            frequency: freqInput?.value || 'once'
        };

        if (type === 'transfer') {
            const toAccInput = $('#quick-tx-to-account') as HTMLSelectElement;
            tx.to_account_id = parseInt(toAccInput.value);
            if (tx.account_id === tx.to_account_id) {
                this.app.notifications.toast('Error', 'Source and destination accounts must be different', 'error');
                return { tx: null, valid: false };
            }
        }

        return { tx, valid: true };
    }

    async handleQuickSave(): Promise<void> {
        // Validate amount
        const { valid: amountValid, amount } = this._validateQuickTxAmount();
        if (!amountValid) return;

        // Build transaction
        const type = this.quickTxType || 'expense';
        const { tx, valid: txValid } = this._buildQuickTransaction(amount, type);
        if (!txValid) return;

        // Save and refresh
        try {
            await window.api.addTransaction(tx);
            this.app.notifications.toast('Success', 'Transaction recorded', 'success');

            const inputAmount = $('#quick-tx-amount') as HTMLInputElement;
            const inputDesc = $('#quick-tx-desc') as HTMLInputElement;
            if (inputAmount) inputAmount.value = '';
            if (inputDesc) inputDesc.value = '';

            await this.app.state.loadTransactions();
            await this.app.state.loadAccounts();
            this.render();
        } catch (err: any) {
            console.error('Quick save failed:', err.message);
            this.app.notifications.toast('Error', 'Failed to save transaction', 'error');
        }
    }

    prepareChartData(monthsCount: number): any {
        const { state } = this.app;
        const labels: string[] = [];
        const income: number[] = [];
        const expenses: number[] = [];
        const netWorth: number[] = [];

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

    renderGrowthHighlights(): void {
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        const items: any[] = [];
        const getSalary = (start: Date, end?: Date) => this.state.transactions
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

    renderCategoryDistribution(): void {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const expenseMap: Record<string, number> = {};
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

    renderBudgetSummary(): void {
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
