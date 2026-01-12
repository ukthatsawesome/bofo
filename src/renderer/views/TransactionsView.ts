import { BaseView } from './BaseView';
import { $, $$, UIUtils } from '../core/dom';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { SortableHeader } from '../components/tables/SortableHeader';
import { TransactionRow } from '../components/tables/TransactionRow';
import { EmptyState } from '../components/common/EmptyState';
import { ProgressBar } from '../components/common/ProgressBar';
import { InsightCard } from '../components/common/InsightCard';
import { StatCard } from '../components/common/StatCard';
import { ViewHeader } from '../components/common/ViewHeader';
import type { App } from '../core/app';

interface TransactionSummary {
    income: string;
    expense: string;
    netFlow: string;
    netFlowPositive: boolean;
    savingsRate: string;
    transactionCount: number;
    topCategories: { category: string; amount: number; percent: string }[];
    yoyChange: string | null;
    incomeRaw: number;
    expenseRaw: number;
}

export class TransactionsView extends BaseView {
    private selectedTxType: string = 'income';
    private editingTxId: number | string | null = null;
    protected insightsLoaded: boolean = false;

    constructor(app: App) {
        super(app, 'transactions');
    }

    async onShow(): Promise<void> {
        if (!this.isInitialized) {
            this.renderBaseTemplate();
            this.setupHistoryListeners();
            this.setupModalListeners();
            this.isInitialized = true;
        }

        this.render();
        this.loadInsights();
    }

    renderBaseTemplate(): void {
        if (!this.element) return;
        this.element.innerHTML = `
            ${ViewHeader({
            title: 'Transactions',
            subtitle: 'Manage your income, expenses, and transfers',
            actions: `
                    <div class="filter-group">
                        <label>Month</label>
                        <input type="month" id="tx-month-filter" class="form-control sm">
                    </div>
                `
        })}

            <!-- Transaction Stats -->
            <div id="tx-stats-container" class="stats-grid mb-6"></div>

            <!-- Period Insights (Month/Year in Review) -->
            <div id="tx-insight-container" class="mb-6"></div>

            <div class="tx-history-container">
                <div class="card h-full">
                    <div class="card-header flex-row justify-between align-center">
                        <h3><i data-lucide="history"></i> History</h3>
                        <div id="tx-filter-container"></div>
                    </div>
                    <div class="table-container">
                        <table class="data-table">
                            <thead id="tx-table-head"></thead>
                            <tbody id="tx-table-body"></tbody>
                        </table>
                    </div>
                    <div class="card-footer flex-row justify-between align-center">
                        <span class="text-muted" id="tx-page-info">Page 1 of 1</span>
                        <div class="pagination">
                            <button class="btn-icon" id="prev-tx" title="Previous"><i data-lucide="chevron-left"></i></button>
                            <button class="btn-icon" id="next-tx" title="Next"><i data-lucide="chevron-right"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.refreshIcons();
    }

    /* -------------------- LISTENERS -------------------- */

    setupHistoryListeners(): void {
        $('#tx-month-filter')?.addEventListener('change', (e: Event) => {
            const target = e.target as HTMLInputElement;
            this.state.txMonthFilter = target.value;
            this.state.txHistoryPage = 1;
            this.render();
        });

        // Pagination
        $('#prev-tx')?.addEventListener('click', () => this.changePage(-1));
        $('#next-tx')?.addEventListener('click', () => this.changePage(1));
    }

    setupModalListeners(): void {
        $('#close-transaction-modal')?.addEventListener('click', () => UIUtils.setHidden('#transaction-modal', true));
        $('#modal-tx-cancel')?.addEventListener('click', () => UIUtils.setHidden('#transaction-modal', true));
        $('#modal-tx-save')?.addEventListener('click', () => this.handleUpdate());

        $$('.tx-type-toggle-modal .segment').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.tx-type-toggle-modal .segment').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const type = (btn as HTMLElement).dataset.type || 'expense';
                UIUtils.setHidden('#modal-tx-to-account-group', type !== 'transfer');
                this.updateSecondaryCategoryDropdown(type);
            });
        });
    }

    /* -------------------- HANDLERS -------------------- */

    handleFilter(type: string): void {
        this.state.txHistoryFilter = type;
        this.state.txHistoryPage = 1;
        this.render();
    }

    handleSort(field: string): void {
        const sameField = this.state.txSortField === field;
        this.state.txSortField = field;
        this.state.txSortOrder = sameField && this.state.txSortOrder === 'asc' ? 'desc' : 'asc';
        this.render();
    }

    changePage(delta: number): void {
        const filtered = this.getFilteredTransactions();
        const maxPage = Math.ceil(filtered.length / this.state.txHistoryPageSize);

        this.state.txHistoryPage = Math.min(
            Math.max(1, this.state.txHistoryPage + delta),
            maxPage
        );

        this.render();
    }

    /* -------------------- DATA -------------------- */

    getFilteredTransactions(): any[] {
        const { txHistoryFilter, txMonthFilter, txSortField, txSortOrder } = this.state;
        const order = txSortOrder === 'asc' ? 1 : -1;

        return [...this.state.transactions]
            .filter(t => txHistoryFilter === 'all' || t.type === txHistoryFilter)
            .filter(t => !txMonthFilter || t.start_date.startsWith(txMonthFilter))
            .sort((a, b) => {
                let A = a[txSortField];
                let B = b[txSortField];

                if (txSortField === 'start_date') {
                    A = new Date(A).getTime();
                    B = new Date(B).getTime();
                } else if (txSortField === 'amount') {
                    A = +A; B = +B;
                } else {
                    A = (A || '').toString().toLowerCase();
                    B = (B || '').toString().toLowerCase();
                }

                return A < B ? -order : A > B ? order : 0;
            });
    }

    /* -------------------- RENDER -------------------- */

    async render(): Promise<void> {
        const body = $('#tx-table-body');
        if (!body) return;

        const { txHistoryFilter, txSortField, txSortOrder } = this.state;

        // Render Toggle Component once or when needed
        const filterContainer = $('#tx-filter-container');
        if (filterContainer && !filterContainer.innerHTML.trim()) {
            filterContainer.innerHTML = SegmentedControl({
                id: 'tx-history-filter',
                onchange: 'app.views.transactions.handleFilter',
                options: [
                    { label: 'All', value: 'all', active: txHistoryFilter === 'all' },
                    { label: 'Income', value: 'income', active: txHistoryFilter === 'income' },
                    { label: 'Expense', value: 'expense', active: txHistoryFilter === 'expense' },
                    { label: 'Transfer', value: 'transfer', active: txHistoryFilter === 'transfer' }
                ]
            });
        } else if (filterContainer) {
            // Just update active classes if already rendered
            filterContainer.querySelectorAll('.segment').forEach(btn => {
                const el = btn as HTMLElement;
                el.classList.toggle('active', el.dataset.value === txHistoryFilter);
            });
        }

        // Render Table Header once
        const thead = $('#tx-table-head');
        if (thead && !thead.innerHTML.trim()) {
            thead.innerHTML = `
                <tr>
                    ${SortableHeader({ label: 'Date', field: 'start_date', currentSort: txSortField, direction: txSortOrder, onclick: 'app.views.transactions.handleSort' })}
                    ${SortableHeader({ label: 'Category', field: 'category', currentSort: txSortField, direction: txSortOrder, onclick: 'app.views.transactions.handleSort' })}
                    ${SortableHeader({ label: 'Account', field: 'account_id', currentSort: txSortField, direction: txSortOrder, onclick: 'app.views.transactions.handleSort' })}
                    ${SortableHeader({ label: 'Description', field: 'description', currentSort: txSortField, direction: txSortOrder, onclick: 'app.views.transactions.handleSort' })}
                    ${SortableHeader({ label: 'Amount', field: 'amount', currentSort: txSortField, direction: txSortOrder, onclick: 'app.views.transactions.handleSort' })}
                    <th>Action</th>
                </tr>
            `;
        }

        const filtered = this.getFilteredTransactions();
        const pageSize = this.state.txHistoryPageSize;
        const page = this.state.txHistoryPage;
        const totalPages = Math.ceil(filtered.length / pageSize) || 1;

        UIUtils.renderList(
            'tx-table-body',
            filtered.slice((page - 1) * pageSize, page * pageSize),
            (t: any) => {
                const acc = this.state.accounts.find(a => a.id == t.account_id);
                const toAcc = t.to_account_id ? this.state.accounts.find(a => a.id == t.to_account_id) : null;
                const accName = acc ? acc.name : 'Unknown';
                const accountText = t.type === 'transfer'
                    ? `${accName} → ${toAcc ? toAcc.name : '?'}`
                    : accName;

                return TransactionRow({
                    id: t.id,
                    date: t.start_date,
                    category: t.category,
                    type: t.type,
                    accountText: accountText,
                    description: t.description,
                    amount: t.amount,
                    formatter: this.formatter,
                    onEdit: `app.views.transactions.handleEdit(${t.id})`,
                    onDelete: `app.handleDeleteTransaction(${t.id})`
                });
            },
            EmptyState({
                icon: 'search',
                title: 'No transactions',
                message: 'No transactions matched your current filters.'
            })
        );

        this.setText('tx-page-info', `Page ${page} of ${totalPages}`);
        const prevBtn = $('#prev-tx') as HTMLButtonElement;
        const nextBtn = $('#next-tx') as HTMLButtonElement;
        if (prevBtn) prevBtn.disabled = page <= 1;
        if (nextBtn) nextBtn.disabled = page >= totalPages;

        this.refreshIcons('#tx-table-body');
        this.refreshIcons('.pagination');
    }

    /* -------------------- EDIT -------------------- */
    // Note: handleEdit is called via string eval from HTML, so it needs to be accessible globally or via app
    // We will ensure app.views.transactions.handleEdit maps to this.

    handleEdit(id: number | string): void {
        const t = this.state.transactions.find(tx => tx.id == id);
        if (!t) return;

        this.editingTxId = id;

        ($('#modal-tx-amount') as HTMLInputElement).value = t.amount.toString();
        ($('#modal-tx-desc') as HTMLInputElement).value = t.description || '';
        ($('#modal-tx-date') as HTMLInputElement).value = t.start_date;
        ($('#modal-tx-account') as HTMLSelectElement).value = t.account_id.toString();

        if (t.type === 'transfer') {
            ($('#modal-tx-to-account') as HTMLSelectElement).value = t.to_account_id?.toString() || '';
            if (t.exchange_rate) ($('#modal-tx-exchange-rate') as HTMLInputElement).value = t.exchange_rate.toString();
            if (t.to_amount) ($('#modal-tx-to-amount') as HTMLInputElement).value = t.to_amount.toString();
        }

        // Set type toggle
        $$('.tx-type-toggle-modal .segment').forEach(btn => {
            const active = (btn as HTMLElement).dataset.type === t.type;
            btn.classList.toggle('active', active);
        });

        UIUtils.setHidden('#modal-tx-to-account-group', t.type !== 'transfer');
        this.updateSecondaryCategoryDropdown(t.type);
        ($('#modal-tx-category') as HTMLSelectElement).value = t.category;

        UIUtils.setHidden('#transaction-modal', false);
        this.refreshIcons();
        $('#modal-tx-account')?.dispatchEvent(new Event('change'));
    }

    updateSecondaryCategoryDropdown(type: string): void {
        const select = $('#modal-tx-category');
        if (!select) return;

        select.innerHTML = this.state.categories
            .filter(c => c.type === type && (c.status === 'active' || !c.status))
            .map(c => `<option value="${c.name}">${c.name}</option>`)
            .join('');
    }

    async handleUpdate(): Promise<void> {
        try {
            const id = this.editingTxId;
            if (!id) return;

            const amount = parseFloat(($('#modal-tx-amount') as HTMLInputElement).value);
            const account_id = parseInt(($('#modal-tx-account') as HTMLSelectElement).value);
            const type = ($('.tx-type-toggle-modal .segment.active') as HTMLElement).dataset.type || 'expense';
            const to_account_id = type === 'transfer' ? parseInt(($('#modal-tx-to-account') as HTMLSelectElement).value) : undefined;

            if (!amount || amount <= 0) throw new Error('Invalid amount');

            // Validate sufficient balance for expenses and transfers
            if (type === 'expense' || type === 'transfer') {
                const account = this.state.accounts.find(a => a.id === account_id);
                // Get the original transaction to account for its current amount
                const originalTx = this.state.transactions.find(t => t.id === id);
                const originalAmount = (originalTx && originalTx.account_id === account_id) ? originalTx.amount : 0;
                const effectiveBalance = account ? account.balance + originalAmount : 0;

                if (account && amount > effectiveBalance) {
                    throw new Error(`Insufficient balance. Account "${account.name}" only has ${this.formatter.formatCurrency(effectiveBalance)} available.`);
                }
            }

            const data: any = {
                id,
                amount,
                account_id,
                to_account_id,
                type,
                category: type === 'transfer' ? 'Transfer' : ($('#modal-tx-category') as HTMLSelectElement).value,
                description: ($('#modal-tx-desc') as HTMLInputElement).value,
                start_date: ($('#modal-tx-date') as HTMLInputElement).value
            };

            await window.api.updateTransaction(id, data);
            UIUtils.setHidden('#transaction-modal', true);

            await Promise.all([
                this.state.loadAccounts(),
                this.state.loadTransactions()
            ]);

            if (this.app.updateAccountDropdowns) this.app.updateAccountDropdowns();
            this.render();
            this.loadInsights();
            this.app.notifications.toast('Success', 'Transaction updated', 'success');
        } catch (err: any) {
            this.app.notifications.alert('Update Failed', err.message, 'error');
        }
    }

    /* -------------------- INSIGHTS -------------------- */

    async loadInsights(): Promise<void> {
        await this._renderStats();
        await this._renderPeriodInsight();
    }

    async _renderStats(): Promise<void> {
        const container = $('#tx-stats-container');
        if (!container) return;

        const { state, formatter } = this.app;
        const now = new Date();
        const monthFilter = this.state.txMonthFilter;

        // Determine which period to analyze
        let targetMonth, targetYear;
        if (monthFilter) {
            const [y, m] = monthFilter.split('-').map(Number);
            targetMonth = m - 1;
            targetYear = y;
        } else {
            targetMonth = now.getMonth();
            targetYear = now.getFullYear();
        }

        const monthStart = new Date(targetYear, targetMonth, 1);
        const monthEnd = new Date(targetYear, targetMonth + 1, 0);

        // Calculate stats for the period
        const periodTxs = state.transactions.filter(t => {
            const d = new Date(t.start_date);
            return d >= monthStart && d <= monthEnd;
        });

        const stats = periodTxs.reduce((acc, t) => {
            if (t.type === 'income') acc.income += t.amount;
            if (t.type === 'expense') acc.expense += t.amount;
            if (t.type === 'transfer') acc.transfers += t.amount;
            acc.count++;
            return acc;
        }, { income: 0, expense: 0, transfers: 0, count: 0 });

        const netFlow = stats.income - stats.expense;
        const savingsRate = stats.income > 0 ? ((netFlow / stats.income) * 100).toFixed(1) : '0.0';

        // Compare to previous month
        const prevMonthStart = new Date(targetYear, targetMonth - 1, 1);
        const prevMonthEnd = new Date(targetYear, targetMonth, 0);
        const prevTxs = state.transactions.filter(t => {
            const d = new Date(t.start_date);
            return d >= prevMonthStart && d <= prevMonthEnd;
        });
        const prevExpense = prevTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const expenseChange = prevExpense > 0 ? (((stats.expense - prevExpense) / prevExpense) * 100).toFixed(0) : '0';
        const expenseChangeNum = parseFloat(expenseChange);

        container.innerHTML = `
            ${StatCard({ label: 'Income', value: formatter.formatCurrency(stats.income), icon: 'trending-up' })}
            ${StatCard({
            label: 'Expenses', value: formatter.formatCurrency(stats.expense), icon: 'trending-down',
            trend: expenseChangeNum != 0 ? { type: expenseChangeNum > 0 ? 'down' : 'up', value: `${expenseChangeNum > 0 ? '+' : ''}${expenseChange}% vs last month` } : null
        })}
            ${StatCard({ label: 'Net Flow', value: (netFlow >= 0 ? '+' : '') + formatter.formatCurrency(netFlow), icon: netFlow >= 0 ? 'arrow-up-circle' : 'arrow-down-circle' })}
            ${StatCard({ label: 'Savings Rate', value: `${savingsRate}%`, icon: 'piggy-bank' })}
            ${StatCard({ label: 'Transactions', value: stats.count.toString(), icon: 'receipt' })}
            ${StatCard({ label: 'Transfers', value: formatter.formatCurrency(stats.transfers), icon: 'arrow-right-left' })}
        `;
        this.refreshIcons('#tx-stats-container');
    }

    async _renderPeriodInsight(): Promise<void> {
        const container = $('#tx-insight-container');
        if (!container) return;

        const { state } = this.app;
        const now = new Date();
        const monthFilter = this.state.txMonthFilter;

        // Determine context
        let targetMonth, targetYear, isPastMonth;
        if (monthFilter) {
            const [y, m] = monthFilter.split('-').map(Number);
            targetMonth = m - 1;
            targetYear = y;
            isPastMonth = (targetYear < now.getFullYear()) ||
                (targetYear === now.getFullYear() && targetMonth < now.getMonth());
        } else {
            targetMonth = now.getMonth();
            targetYear = now.getFullYear();
            isPastMonth = false;
        }

        const monthStart = new Date(targetYear, targetMonth, 1);
        const monthEnd = new Date(targetYear, targetMonth + 1, 0);
        const monthName = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        // Get transactions for the period
        const periodTxs = state.transactions.filter(t => {
            const d = new Date(t.start_date);
            return d >= monthStart && d <= monthEnd;
        });

        if (periodTxs.length === 0) {
            container.innerHTML = '';
            return;
        }

        // Calculate summary data
        const summary = this._calculatePeriodSummary(periodTxs, targetMonth, targetYear);
        const cacheContext = `transactions_${targetYear}_${targetMonth}`;

        // Check cache first
        const cachedInsight = this.app.aiCache.getCached(cacheContext, summary);
        if (cachedInsight) {
            container.innerHTML = InsightCard({
                title: isPastMonth ? `${monthName} in Review` : `${monthName} So Far`,
                message: cachedInsight.text,
                icon: cachedInsight.icon
            });
            this.refreshIcons(container);
            return;
        }

        // Show loading
        container.innerHTML = InsightCard({
            title: isPastMonth ? `${monthName} in Review` : `${monthName} So Far`,
            message: '<span class="typing-dots">Analyzing transactions</span>',
            icon: isPastMonth ? 'calendar-check' : 'activity'
        });
        this.refreshIcons(container);

        // Fetch insight using cache system
        try {
            const insight = await this.app.aiCache.fetchInsight(
                cacheContext,
                summary,
                async (data: any) => {
                    const prompt = this._buildTransactionInsightPrompt(data, monthName, isPastMonth);
                    return await window.api.getAIInsight(prompt);
                },
                (data: any) => (this.app as any).fallbackGenerator.generateTransactionInsight(data, monthName, isPastMonth),
                {
                    aiTitle: isPastMonth ? `${monthName} in Review` : `${monthName} So Far`,
                    fallbackTitle: isPastMonth ? `${monthName} in Review` : `${monthName} So Far`,
                    ttl: isPastMonth ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000 // 7 days for past month, 1 hour for current
                }
            );

            container.innerHTML = InsightCard({
                title: isPastMonth ? `${monthName} in Review` : `${monthName} So Far`,
                message: insight.text,
                icon: insight.isAI ? 'sparkles' : (isPastMonth ? 'calendar-check' : 'activity')
            });
            this.refreshIcons(container);
        } catch (err) {
            console.error('Failed to load transaction insight:', err);
            const fallbackText = (this.app as any).fallbackGenerator.generateTransactionInsight(summary, monthName, isPastMonth);
            container.innerHTML = InsightCard({
                title: isPastMonth ? `${monthName} in Review` : `${monthName} So Far`,
                message: fallbackText,
                icon: isPastMonth ? 'calendar-check' : 'activity'
            });
            this.refreshIcons(container);
        }
    }

    _calculatePeriodSummary(transactions: any[], month: number, year: number): TransactionSummary {
        const { state, formatter } = this.app;

        const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const netFlow = income - expense;
        const savingsRate = income > 0 ? ((netFlow / income) * 100).toFixed(1) : '0';

        // Top categories
        const categorySpending: Record<string, number> = {};
        transactions.filter(t => t.type === 'expense').forEach(t => {
            categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
        });
        const topCategories = Object.entries(categorySpending)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([cat, amt]) => ({ category: cat, amount: amt, percent: ((amt / expense) * 100).toFixed(0) }));

        // Compare to same month last year
        const lastYearStart = new Date(year - 1, month, 1);
        const lastYearEnd = new Date(year - 1, month + 1, 0);
        const lastYearTxs = state.transactions.filter(t => {
            const d = new Date(t.start_date);
            return d >= lastYearStart && d <= lastYearEnd;
        });
        const lastYearExpense = lastYearTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const yoyChange = lastYearExpense > 0 ? (((expense - lastYearExpense) / lastYearExpense) * 100).toFixed(0) : null;

        return {
            income: formatter.formatCurrency(income),
            expense: formatter.formatCurrency(expense),
            netFlow: formatter.formatCurrency(netFlow),
            netFlowPositive: netFlow >= 0,
            savingsRate,
            transactionCount: transactions.length,
            topCategories,
            yoyChange,
            incomeRaw: income,
            expenseRaw: expense
        };
    }

    _buildTransactionInsightPrompt(summary: TransactionSummary, monthName: string, isPastMonth: boolean): string {
        return `Analyze ${monthName} transactions and provide 2-3 sentences of practical insight:
Income: ${summary.income}
Expenses: ${summary.expense}
Net Flow: ${summary.netFlow}
Savings Rate: ${summary.savingsRate}%
Transaction Count: ${summary.transactionCount}
Top Spending: ${summary.topCategories.map(c => `${c.category} (${c.percent}%)`).join(', ')}
${summary.yoyChange ? `Year-over-year expense change: ${summary.yoyChange}%` : ''}
${isPastMonth ? 'This is a completed month - summarize performance.' : 'Month is ongoing - suggest optimizations.'}
Be specific, actionable, and focus on what matters financially.`;
    }
}
