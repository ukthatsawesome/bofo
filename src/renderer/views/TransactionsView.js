import { BaseView } from './BaseView.js';
import { $, $$, UIUtils } from '../core/dom.js';
import { SegmentedControl } from '../components/common/SegmentedControl.js';
import { SortableHeader } from '../components/tables/SortableHeader.js';
import { TransactionRow } from '../components/tables/TransactionRow.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { ProgressBar } from '../components/common/ProgressBar.js';
import { InsightCard } from '../components/common/InsightCard.js';
import { StatCard } from '../components/common/StatCard.js';
import { ViewHeader } from '../components/common/ViewHeader.js';

export class TransactionsView extends BaseView {
    constructor(app) {
        super(app, 'transactions');
        this.selectedTxType = 'income';
        this.isInitialized = false;
        this.insightsLoaded = false;
    }

    async onShow() {
        if (!this.isInitialized) {
            this.renderBaseTemplate();
            this.setupHistoryListeners();
            this.setupModalListeners();
            this.isInitialized = true;
        }

        this.render();
        this.loadInsights();
    }

    renderBaseTemplate() {
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

    /* -------------------- LISTENERS -------------------- */

    setupHistoryListeners() {
        $('#tx-month-filter')?.addEventListener('change', e => {
            this.state.txMonthFilter = e.target.value;
            this.state.txHistoryPage = 1;
            this.render();
        });

        // Pagination
        $('#prev-tx')?.addEventListener('click', () => this.changePage(-1));
        $('#next-tx')?.addEventListener('click', () => this.changePage(1));
    }

    setupModalListeners() {
        $('#close-transaction-modal')?.addEventListener('click', () => UIUtils.setHidden('#transaction-modal', true));
        $('#modal-tx-cancel')?.addEventListener('click', () => UIUtils.setHidden('#transaction-modal', true));
        $('#modal-tx-save')?.addEventListener('click', () => this.handleUpdate());

        $$('.tx-type-toggle-modal .segment').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.tx-type-toggle-modal .segment').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const type = btn.dataset.type;
                UIUtils.setHidden('#modal-tx-to-account-group', type !== 'transfer');
                this.updateSecondaryCategoryDropdown(type);
            });
        });
    }

    /* -------------------- HANDLERS -------------------- */

    handleFilter(type) {
        this.state.txHistoryFilter = type;
        this.state.txHistoryPage = 1;
        this.render();
    }

    handleSort(field) {
        const sameField = this.state.txSortField === field;
        this.state.txSortField = field;
        this.state.txSortOrder = sameField && this.state.txSortOrder === 'asc' ? 'desc' : 'asc';
        this.render();
    }

    changePage(delta) {
        const filtered = this.getFilteredTransactions();
        const maxPage = Math.ceil(filtered.length / this.state.txHistoryPageSize);

        this.state.txHistoryPage = Math.min(
            Math.max(1, this.state.txHistoryPage + delta),
            maxPage
        );

        this.render();
    }

    /* -------------------- DATA -------------------- */

    getFilteredTransactions() {
        const { txHistoryFilter, txMonthFilter, txSortField, txSortOrder } = this.state;
        const order = txSortOrder === 'asc' ? 1 : -1;

        return [...this.state.transactions]
            .filter(t => txHistoryFilter === 'all' || t.type === txHistoryFilter)
            .filter(t => !txMonthFilter || t.start_date.startsWith(txMonthFilter))
            .sort((a, b) => {
                let A = a[txSortField];
                let B = b[txSortField];

                if (txSortField === 'start_date') {
                    A = new Date(A); B = new Date(B);
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

    async render() {
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
                btn.classList.toggle('active', btn.dataset.value === txHistoryFilter);
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
        } else if (thead) {
            // If sort changed, we might need to update the indicators, but for now let's at least keep it stable
            // Ideally we also update the SortableHeader indicators here if they changed
        }

        const filtered = this.getFilteredTransactions();
        const pageSize = this.state.txHistoryPageSize;
        const page = this.state.txHistoryPage;
        const totalPages = Math.ceil(filtered.length / pageSize) || 1;

        UIUtils.renderList(
            'tx-table-body',
            filtered.slice((page - 1) * pageSize, page * pageSize),
            t => {
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
        const prevBtn = $('#prev-tx');
        const nextBtn = $('#next-tx');
        if (prevBtn) prevBtn.disabled = page <= 1;
        if (nextBtn) nextBtn.disabled = page >= totalPages;

        this.refreshIcons('#tx-table-body');
        this.refreshIcons('.pagination');
    }

    /* -------------------- EDIT -------------------- */

    handleEdit(id) {
        const t = this.state.transactions.find(tx => tx.id == id);
        if (!t) return;

        this.editingTxId = id;

        $('#modal-tx-amount').value = t.amount;
        $('#modal-tx-desc').value = t.description || '';
        $('#modal-tx-date').value = t.start_date;
        $('#modal-tx-account').value = t.account_id;

        if (t.type === 'transfer') {
            $('#modal-tx-to-account').value = t.to_account_id;
        }

        // Set type toggle
        $$('.tx-type-toggle-modal .segment').forEach(btn => {
            const active = btn.dataset.type === t.type;
            btn.classList.toggle('active', active);
        });

        UIUtils.setHidden('#modal-tx-to-account-group', t.type !== 'transfer');
        this.updateSecondaryCategoryDropdown(t.type);
        $('#modal-tx-category').value = t.category;

        UIUtils.setHidden('#transaction-modal', false);
        this.refreshIcons();
    }

    updateSecondaryCategoryDropdown(type) {
        const select = $('#modal-tx-category');
        if (!select) return;

        select.innerHTML = this.state.categories
            .filter(c => c.type === type && (c.status === 'active' || !c.status))
            .map(c => `<option value="${c.name}">${c.name}</option>`)
            .join('');
    }

    async handleUpdate() {
        try {
            const id = this.editingTxId;
            const amount = parseFloat($('#modal-tx-amount').value);
            const account_id = parseInt($('#modal-tx-account').value);
            const type = $('.tx-type-toggle-modal .segment.active').dataset.type;
            const to_account_id = type === 'transfer' ? parseInt($('#modal-tx-to-account').value) : null;

            if (!amount || amount <= 0) throw new Error('Invalid amount');

            // Validate sufficient balance for expenses and transfers
            if (type === 'expense' || type === 'transfer') {
                const account = this.state.accounts.find(a => a.id === account_id);
                // Get the original transaction to account for its current amount
                const originalTx = this.state.transactions.find(t => t.id === id);
                const originalAmount = (originalTx && originalTx.account_id === account_id) ? originalTx.amount : 0;
                const effectiveBalance = account ? account.balance + originalAmount : 0;

                if (amount > effectiveBalance) {
                    throw new Error(`Insufficient balance. Account "${account?.name}" only has ${this.formatter.formatCurrency(effectiveBalance)} available.`);
                }
            }

            const data = {
                id,
                amount,
                account_id,
                to_account_id,
                type,
                category: type === 'transfer' ? 'Transfer' : $('#modal-tx-category').value,
                description: $('#modal-tx-desc').value,
                start_date: $('#modal-tx-date').value
            };

            await window.api.updateTransaction(id, data);
            UIUtils.setHidden('#transaction-modal', true);

            await Promise.all([
                this.state.loadAccounts(),
                this.state.loadTransactions()
            ]);

            this.app.updateAccountDropdowns();
            this.render();
            this.loadInsights();
            this.app.notifications.toast('Success', 'Transaction updated', 'success');
        } catch (err) {
            this.app.notifications.alert('Update Failed', err.message, 'error');
        }
    }

    /* -------------------- INSIGHTS -------------------- */

    async loadInsights() {
        await this._renderStats();
        await this._renderPeriodInsight();
    }

    async _renderStats() {
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
        const savingsRate = stats.income > 0 ? ((netFlow / stats.income) * 100).toFixed(1) : 0;

        // Compare to previous month
        const prevMonthStart = new Date(targetYear, targetMonth - 1, 1);
        const prevMonthEnd = new Date(targetYear, targetMonth, 0);
        const prevTxs = state.transactions.filter(t => {
            const d = new Date(t.start_date);
            return d >= prevMonthStart && d <= prevMonthEnd;
        });
        const prevExpense = prevTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const expenseChange = prevExpense > 0 ? (((stats.expense - prevExpense) / prevExpense) * 100).toFixed(0) : 0;

        container.innerHTML = `
            ${StatCard({ label: 'Income', value: formatter.formatCurrency(stats.income), icon: 'trending-up' })}
            ${StatCard({
            label: 'Expenses', value: formatter.formatCurrency(stats.expense), icon: 'trending-down',
            trend: expenseChange != 0 ? { type: expenseChange > 0 ? 'down' : 'up', value: `${expenseChange > 0 ? '+' : ''}${expenseChange}% vs last month` } : null
        })}
            ${StatCard({ label: 'Net Flow', value: (netFlow >= 0 ? '+' : '') + formatter.formatCurrency(netFlow), icon: netFlow >= 0 ? 'arrow-up-circle' : 'arrow-down-circle' })}
            ${StatCard({ label: 'Savings Rate', value: `${savingsRate}%`, icon: 'piggy-bank' })}
            ${StatCard({ label: 'Transactions', value: stats.count.toString(), icon: 'receipt' })}
            ${StatCard({ label: 'Transfers', value: formatter.formatCurrency(stats.transfers), icon: 'arrow-right-left' })}
        `;
        this.refreshIcons('#tx-stats-container');
    }

    async _renderPeriodInsight() {
        const container = $('#tx-insight-container');
        if (!container) return;

        const { state, formatter } = this.app;
        const now = new Date();
        const monthFilter = this.state.txMonthFilter;

        // Determine context
        let targetMonth, targetYear, isPastMonth, isPastYear;
        if (monthFilter) {
            const [y, m] = monthFilter.split('-').map(Number);
            targetMonth = m - 1;
            targetYear = y;
            isPastMonth = (targetYear < now.getFullYear()) ||
                (targetYear === now.getFullYear() && targetMonth < now.getMonth());
            isPastYear = targetYear < now.getFullYear();
        } else {
            targetMonth = now.getMonth();
            targetYear = now.getFullYear();
            isPastMonth = false;
            isPastYear = false;
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
                async (data) => {
                    const prompt = this._buildTransactionInsightPrompt(data, monthName, isPastMonth);
                    return await window.api.getAIInsight(prompt);
                },
                (data) => this.app.fallbackGenerator.generateTransactionInsight(data, monthName, isPastMonth),
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
            const fallbackText = this.app.fallbackGenerator.generateTransactionInsight(summary, monthName, isPastMonth);
            container.innerHTML = InsightCard({
                title: isPastMonth ? `${monthName} in Review` : `${monthName} So Far`,
                message: fallbackText,
                icon: isPastMonth ? 'calendar-check' : 'activity'
            });
            this.refreshIcons(container);
        }
    }

    _calculatePeriodSummary(transactions, month, year) {
        const { state, formatter } = this.app;

        const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const netFlow = income - expense;
        const savingsRate = income > 0 ? ((netFlow / income) * 100).toFixed(1) : 0;

        // Top categories
        const categorySpending = {};
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

    _buildTransactionInsightPrompt(summary, monthName, isPastMonth) {
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

    _generateTransactionFallbackInsight(summary, monthName, isPastMonth) {
        const insights = [];

        // Savings rate analysis
        const rate = parseFloat(summary.savingsRate);
        if (rate >= 30) {
            insights.push(`<strong class="text-success">Excellent!</strong> ${summary.savingsRate}% savings rate - you saved ${summary.netFlow} this period.`);
        } else if (rate >= 15) {
            insights.push(`Solid ${summary.savingsRate}% savings rate with ${summary.netFlow} net flow.`);
        } else if (rate > 0) {
            const topCat = summary.topCategories[0]?.category;
            const safeTopCat = topCat ? UIUtils.escapeHTML(topCat) : 'discretionary';
            insights.push(`${summary.savingsRate}% savings rate. Consider reducing ${safeTopCat} spending.`);
        } else if (summary.incomeRaw > 0) {
            insights.push(`<strong class="text-danger">Watch out:</strong> Spending exceeded income by ${summary.netFlow}.`);
        }

        // Top category insight
        if (summary.topCategories.length > 0) {
            const top = summary.topCategories[0];
            if (parseInt(top.percent) > 40) {
                insights.push(`${UIUtils.escapeHTML(top.category)} dominated at ${top.percent}% of spending.`);
            }
        }

        // Year-over-year comparison
        if (summary.yoyChange !== null) {
            const change = parseInt(summary.yoyChange);
            if (change > 20) {
                insights.push(`Expenses up ${summary.yoyChange}% vs last year - review for lifestyle creep.`);
            } else if (change < -10) {
                insights.push(`Great progress! Expenses down ${Math.abs(change)}% compared to last year.`);
            }
        }

        return insights.length > 0
            ? insights.join(' ')
            : `${summary.transactionCount} transactions totaling ${summary.expense} in expenses.`;
    }
}

window.TransactionsView = TransactionsView;

