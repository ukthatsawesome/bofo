class TransactionsView extends BaseView {
    constructor(app) {
        super(app, 'transactions');
        this.selectedTxType = 'income';
        this.isInitialized = false;
    }

    async onShow() {
        if (!this.isInitialized) {
            this.setupFormListeners();
            this.setupHistoryListeners();
            this.setupModalListeners();
            this.isInitialized = true;
        }

        this.app.updateAccountDropdowns();
        this.updateCategoryDropdown(this.selectedTxType);
        this.render();
    }

    /* -------------------- LISTENERS -------------------- */

    setupFormListeners() {
        // Type toggle
        $$('.type-btn').forEach(btn =>
            btn.addEventListener('click', () => this.handleTypeToggle(btn))
        );

        $('#save-tx')?.addEventListener('click', () => this.handleSave());

        // File upload
        $('#upload-zone')?.addEventListener('click', () => $('#tx-attachment')?.click());
        $('#tx-attachment')?.addEventListener('change', e => this.handleFileChange(e));
        $('#remove-file')?.addEventListener('click', () => this.clearFile());

        $('#tx-category')?.addEventListener('change', () => this.updateBudgetHint());
        $('#tx-date')?.addEventListener('change', () => this.updateBudgetHint());

        const dateInput = $('#tx-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }

    setupHistoryListeners() {
        // Filters
        $$('.filter-btn').forEach(btn =>
            btn.addEventListener('click', () => this.handleFilter(btn))
        );

        $('#tx-month-filter')?.addEventListener('change', e => {
            this.state.txMonthFilter = e.target.value;
            this.state.txHistoryPage = 1;
            this.render();
        });

        // Sorting
        $$('.sortable').forEach(th =>
            th.addEventListener('click', () => this.handleSort(th))
        );

        // Pagination
        $('#prev-tx')?.addEventListener('click', () => this.changePage(-1));
        $('#next-tx')?.addEventListener('click', () => this.changePage(1));
    }

    setupModalListeners() {
        $('#close-tx-modal')?.addEventListener('click', () => UIUtils.setHidden('#tx-modal', true));
        $('#cancel-edit-tx')?.addEventListener('click', () => UIUtils.setHidden('#tx-modal', true));
        $('#confirm-save-tx')?.addEventListener('click', () => this.handleUpdate());

        $$('#tx-modal .type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('#tx-modal .type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const type = btn.dataset.type;
                UIUtils.setHidden('#edit-tx-to-account-group', type !== 'transfer');
                this.updateSecondaryCategoryDropdown(type);
            });
        });
    }

    /* -------------------- HANDLERS -------------------- */

    handleTypeToggle(btn) {
        $$('.type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.selectedTxType = btn.dataset.type;
        UIUtils.setHidden('#tx-to-account-group', this.selectedTxType !== 'transfer');
        this.updateCategoryDropdown(this.selectedTxType);
    }

    handleFilter(btn) {
        $$('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.state.txHistoryFilter = btn.dataset.filter;
        this.state.txHistoryPage = 1;
        this.render();
    }

    handleSort(th) {
        const field = th.dataset.sort;
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

    handleFileChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        this.setText('file-name', file.name);
        UIUtils.setHidden('#file-preview', false);
        UIUtils.setHidden('#upload-zone', true);
    }

    clearFile() {
        const input = $('#tx-attachment');
        if (input) input.value = '';

        UIUtils.setHidden('#file-preview', true);
        UIUtils.setHidden('#upload-zone', false);
    }

    /* -------------------- SAVE -------------------- */

    async handleSave() {
        try {
            const amount = parseFloat($('#tx-amount').value);
            const accountId = $('#tx-account').value;
            const toAccountId = $('#tx-to-account')?.value;

            if (!amount || amount <= 0)
                return notifications.alert('Invalid Amount', 'Please enter a valid amount', 'error');

            if (!accountId)
                return notifications.alert('Account Missing', 'Please select an account', 'warning');

            if (this.selectedTxType === 'transfer' && accountId === toAccountId)
                return notifications.alert('Invalid Transfer', 'Accounts must be different', 'error');

            const acc = this.state.accounts.find(a => a.id == accountId);

            if (['expense', 'transfer'].includes(this.selectedTxType) && acc && amount > acc.balance) {
                const ok = await notifications.confirm(
                    'Low Balance',
                    `Exceeds ${this.formatter.formatCurrency(acc.balance)}. Proceed?`,
                    'warning'
                );
                if (!ok) return;
            }

            const data = {
                account_id: accountId,
                to_account_id: this.selectedTxType === 'transfer' ? toAccountId : null,
                type: this.selectedTxType,
                category: this.selectedTxType === 'transfer'
                    ? 'Transfer'
                    : $('#tx-category').value,
                amount,
                description: $('#tx-description')?.value || '',
                attachment: $('#tx-attachment')?.files[0]?.path || null,
                frequency: $('#tx-frequency')?.value || 'once',
                start_date: $('#tx-date').value,
                currency: acc?.currency || 'USD',
                is_active: 1
            };

            await window.api.addTransaction(data);

            this.resetForm();
            await this.state.loadAccounts();
            await this.state.loadTransactions();

            await this.app.currentView?.render();

            this.flashSuccess(amount);
        } catch (err) {
            notifications.alert('Error', err.message, 'error');
        }
    }

    flashSuccess(amount) {
        const card = document.querySelector('.tx-entry-card');
        card?.classList.add('success-flash');

        setTimeout(() => {
            card?.classList.remove('success-flash');
            $('#tx-amount')?.focus();
        }, 600);

        notifications.toast(
            'Transaction Recorded',
            `${this.selectedTxType === 'income' ? 'Income' : 'Expense'} of ${this.formatter.formatCurrency(amount)} saved`,
            'success'
        );
    }

    resetForm() {
        ['#tx-amount', '#tx-description', '#tx-attachment'].forEach(sel => {
            const el = $(sel);
            if (el) el.value = '';
        });

        UIUtils.setHidden('#file-preview', true);
        UIUtils.setHidden('#upload-zone', false);
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

        const filtered = this.getFilteredTransactions();
        const pageSize = this.state.txHistoryPageSize;
        const page = this.state.txHistoryPage;
        const totalPages = Math.ceil(filtered.length / pageSize) || 1;

        this.updateSortIcons();

        UIUtils.renderList(
            'tx-table-body',
            filtered.slice((page - 1) * pageSize, page * pageSize),
            t => {
                const acc = this.state.accounts.find(a => a.id == t.account_id);
                const toAcc = t.to_account_id ? this.state.accounts.find(a => a.id == t.to_account_id) : null;
                const accName = acc ? acc.name : 'Unknown';
                const displayText = t.type === 'transfer'
                    ? `${accName} → ${toAcc ? toAcc.name : '?'}`
                    : accName;

                return `
                <tr>
                    <td>${t.start_date}</td>
                    <td><span class="type-indicator ${t.type}">${t.category}</span></td>
                    <td class="text-muted">${displayText}</td>
                    <td class="text-muted">${t.description || '-'}</td>
                    <td class="amount ${t.type}">${this.formatter.formatCurrency(t.amount)}</td>
                    <td>
                        <div class="flex-row" style="gap: 5px;">
                            <button class="action-btn"
                                onclick="app.views.transactions.handleEdit(${t.id})">
                                <i data-lucide="edit-3"></i>
                            </button>
                            <button class="action-btn danger"
                                onclick="app.handleDeleteTransaction(${t.id})">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `},
            'No transactions found.'
        );

        this.setText('tx-page-info', `Page ${page} of ${totalPages}`);
        $('#prev-tx').disabled = page <= 1;
        $('#next-tx').disabled = page >= totalPages;

        this.refreshIcons();
    }

    updateSortIcons() {
        $$('.sortable').forEach(th => {
            const icon = th.querySelector('.sort-icon');
            if (!icon) return;

            const active = th.dataset.sort === this.state.txSortField;
            th.classList.toggle('active-sort', active);

            icon.setAttribute(
                'data-lucide',
                active
                    ? (this.state.txSortOrder === 'asc' ? 'chevron-up' : 'chevron-down')
                    : 'chevrons-up-down'
            );
        });
    }

    /* -------------------- CATEGORY & BUDGET -------------------- */

    updateCategoryDropdown(type) {
        const select = $('#tx-category');
        if (!select) return;

        select.innerHTML = this.state.categories
            .filter(c => c.type === type && (c.status === 'active' || !c.status))
            .map(c => `<option value="${c.name}">${c.name}</option>`)
            .join('');

        this.updateBudgetHint();
    }

    updateBudgetHint() {
        const category = $('#tx-category')?.value;
        const hint = $('#budget-hint');
        if (!category || !hint) return;

        const budget = this.state.budgets.find(b => b.category === category);
        if (!budget) return hint.innerText = '';

        const month = ($('#tx-date')?.value || new Date().toISOString()).slice(0, 7);

        const spent = this.state.transactions
            .filter(t =>
                t.type === 'expense' &&
                t.category === category &&
                t.start_date.startsWith(month)
            )
            .reduce((sum, t) => sum + t.amount, 0);

        const remaining = budget.amount - spent;

        hint.innerHTML = remaining < 0
            ? `<span style="color: var(--danger)">⚠️ Over budget by ${this.formatter.formatCurrency(Math.abs(remaining))}</span>`
            : `<span style="color: var(--success)">✓ ${this.formatter.formatCurrency(remaining)} remaining this month</span>`;
    }

    /* -------------------- EDIT -------------------- */

    handleEdit(id) {
        const t = this.state.transactions.find(tx => tx.id == id);
        if (!t) return;

        this.editingTxId = id;

        $('#edit-tx-amount').value = t.amount;
        $('#edit-tx-description').value = t.description || '';
        $('#edit-tx-date').value = t.start_date;
        $('#edit-tx-account').value = t.account_id;

        if (t.type === 'transfer') {
            $('#edit-tx-to-account').value = t.to_account_id;
        }

        // Set type toggle
        $$('#tx-modal .type-btn').forEach(btn => {
            const active = btn.dataset.type === t.type;
            btn.classList.toggle('active', active);
        });

        UIUtils.setHidden('#edit-tx-to-account-group', t.type !== 'transfer');
        this.updateSecondaryCategoryDropdown(t.type);
        $('#edit-tx-category').value = t.category;

        UIUtils.setHidden('#tx-modal', false);
        this.refreshIcons();
    }

    updateSecondaryCategoryDropdown(type) {
        const select = $('#edit-tx-category');
        if (!select) return;

        select.innerHTML = this.state.categories
            .filter(c => c.type === type && (c.status === 'active' || !c.status))
            .map(c => `<option value="${c.name}">${c.name}</option>`)
            .join('');
    }

    async handleUpdate() {
        try {
            const id = this.editingTxId;
            const amount = parseFloat($('#edit-tx-amount').value);
            const account_id = $('#edit-tx-account').value;
            const type = $('#tx-modal .type-btn.active').dataset.type;
            const to_account_id = type === 'transfer' ? $('#edit-tx-to-account').value : null;

            if (!amount || amount <= 0) throw new Error('Invalid amount');

            const data = {
                id,
                amount,
                account_id,
                to_account_id,
                type,
                category: type === 'transfer' ? 'Transfer' : $('#edit-tx-category').value,
                description: $('#edit-tx-description').value,
                start_date: $('#edit-tx-date').value
            };

            await window.api.updateTransaction(id, data);
            UIUtils.setHidden('#tx-modal', true);

            await Promise.all([
                this.state.loadAccounts(),
                this.state.loadTransactions()
            ]);

            this.app.updateAccountDropdowns();
            this.render();
            notifications.toast('Success', 'Transaction updated', 'success');
        } catch (err) {
            notifications.alert('Update Failed', err.message, 'error');
        }
    }
}

window.TransactionsView = TransactionsView;
