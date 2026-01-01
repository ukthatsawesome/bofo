import { BaseView } from './BaseView.js';
import { $, $$, UIUtils } from '../core/dom.js';
import { SegmentedControl } from '../components/common/SegmentedControl.js';
import { SortableHeader } from '../components/tables/SortableHeader.js';
import { TransactionRow } from '../components/tables/TransactionRow.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { ProgressBar } from '../components/common/ProgressBar.js';

export class TransactionsView extends BaseView {
    constructor(app) {
        super(app, 'transactions');
        this.selectedTxType = 'income';
        this.isInitialized = false;
    }

    async onShow() {
        if (!this.isInitialized) {
            this.renderBaseTemplate();
            this.setupHistoryListeners();
            this.setupModalListeners();
            this.isInitialized = true;
        }

        this.render();
    }

    renderBaseTemplate() {
        this.element.innerHTML = `
            <div class="view-header">
                <div class="header-main">
                    <h1>Transactions</h1>
                    <p class="text-muted">Manage your income, expenses, and transfers</p>
                </div>
                <div class="header-actions">
                    <div class="filter-group">
                        <label>Month</label>
                        <input type="month" id="tx-month-filter" class="form-control sm">
                    </div>
                </div>
            </div>

            <div class="tx-history-container mt-6">
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
            this.app.notifications.toast('Success', 'Transaction updated', 'success');
        } catch (err) {
            this.app.notifications.alert('Update Failed', err.message, 'error');
        }
    }
}

window.TransactionsView = TransactionsView;
