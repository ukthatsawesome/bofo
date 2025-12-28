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
            this.isInitialized = true;
        }
        this.app.updateAccountDropdowns();
        this.updateCategoryDropdown(this.selectedTxType);
        this.render();
    }

    setupFormListeners() {
        // Type Toggles
        $$('.type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedTxType = btn.dataset.type;
                UIUtils.setHidden('#tx-to-account-group', this.selectedTxType !== 'transfer');
                this.updateCategoryDropdown(this.selectedTxType);
            });
        });

        // Form Submission
        $('#save-tx')?.addEventListener('click', () => this.handleSave());

        // File Upload (if present)
        $('#upload-zone')?.addEventListener('click', () => $('#tx-attachment').click());
        $('#tx-attachment')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.setText('file-name', file.name);
                UIUtils.setHidden('#file-preview', false);
                UIUtils.setHidden('#upload-zone', true);
            }
        });

        $('#remove-file')?.addEventListener('click', () => {
            const input = $('#tx-attachment');
            if (input) input.value = '';
            UIUtils.setHidden('#file-preview', true);
            UIUtils.setHidden('#upload-zone', false);
        });

        $('#tx-category')?.addEventListener('change', () => this.updateBudgetHint());
        $('#tx-date')?.addEventListener('change', () => this.updateBudgetHint());

        // Initial date
        const dateInput = $('#tx-date');
        if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
    }

    setupHistoryListeners() {
        // Filter Controls
        $$('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.txHistoryFilter = btn.dataset.filter;
                this.state.txHistoryPage = 1;
                this.render();
            });
        });

        $('#tx-month-filter')?.addEventListener('change', (e) => {
            this.state.txMonthFilter = e.target.value;
            this.state.txHistoryPage = 1;
            this.render();
        });

        // Pagination
        $('#prev-tx')?.addEventListener('click', () => {
            if (this.state.txHistoryPage > 1) {
                this.state.txHistoryPage--;
                this.render();
            }
        });
        $('#next-tx')?.addEventListener('click', () => {
            const filtered = this.getFilteredTransactions();
            if (this.state.txHistoryPage < Math.ceil(filtered.length / this.state.txHistoryPageSize)) {
                this.state.txHistoryPage++;
                this.render();
            }
        });
    }

    async handleSave() {
        try {
            const amount = parseFloat($('#tx-amount').value);
            const accountId = $('#tx-account').value;
            const toAccountId = $('#tx-to-account').value;

            if (!amount || amount <= 0) return notifications.alert('Invalid Amount', 'Please enter a valid amount', 'error');
            if (!accountId) return notifications.alert('Account Missing', 'Please select an account', 'warning');

            if (this.selectedTxType === 'transfer' && accountId === toAccountId) {
                return notifications.alert('Invalid Transfer', 'Accounts must be different', 'error');
            }

            const acc = this.state.accounts.find(a => a.id == accountId);
            if ((this.selectedTxType === 'expense' || this.selectedTxType === 'transfer') && acc && amount > acc.balance) {
                if (!(await notifications.confirm('Low Balance', `Exceeds ${this.formatter.formatCurrency(acc.balance)}. Proceed?`, 'warning'))) return;
            }

            const data = {
                account_id: accountId,
                to_account_id: this.selectedTxType === 'transfer' ? toAccountId : null,
                type: this.selectedTxType,
                category: this.selectedTxType === 'transfer' ? 'Transfer' : $('#tx-category').value,
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

            // If we are on dashboard, we might need a full refresh? 
            // The renderer typically listens to app state anyway if it's set up that way,
            // but here we might need to manually trigger render for the current view.
            if (this.app.currentView) {
                await this.app.currentView.render();
            }

            const card = document.querySelector('.tx-entry-card');
            card?.classList.add('success-flash');
            setTimeout(() => {
                card?.classList.remove('success-flash');
                $('#tx-amount').focus();
            }, 600);

            notifications.toast('Transaction Recorded', `${this.selectedTxType === 'income' ? 'Income' : 'Expense'} of ${this.formatter.formatCurrency(amount)} saved`, 'success');
        } catch (error) {
            notifications.alert('Error', error.message, 'error');
        }
    }

    resetForm() {
        const amountEl = $('#tx-amount');
        if (amountEl) amountEl.value = '';
        const descEl = $('#tx-description');
        if (descEl) descEl.value = '';
        const attachEl = $('#tx-attachment');
        if (attachEl) attachEl.value = '';

        UIUtils.setHidden('#file-preview', true);
        UIUtils.setHidden('#upload-zone', false);
    }

    getFilteredTransactions() {
        let filtered = [...this.state.transactions];
        if (this.state.txHistoryFilter !== 'all') {
            filtered = filtered.filter(t => t.type === this.state.txHistoryFilter);
        }
        if (this.state.txMonthFilter) {
            const [year, month] = this.state.txMonthFilter.split('-');
            filtered = filtered.filter(t => {
                const d = new Date(t.start_date);
                return d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(month);
            });
        }
        return filtered;
    }

    async render() {
        const tableBody = $('#tx-table-body');
        if (!tableBody) return; // Silent return if we are on Dashboard

        const filtered = this.getFilteredTransactions();
        const start = (this.state.txHistoryPage - 1) * this.state.txHistoryPageSize;
        const pageData = filtered.slice(start, start + this.state.txHistoryPageSize);
        const totalPages = Math.ceil(filtered.length / this.state.txHistoryPageSize) || 1;

        UIUtils.renderList('tx-table-body', pageData, t => `
            <tr>
                <td>${t.start_date}</td>
                <td><span class="type-indicator ${t.type}">${t.category}</span></td>
                <td class="text-muted">${t.description || '-'}</td>
                <td class="amount ${t.type}">${this.formatter.formatCurrency(t.amount)}</td>
                <td>
                    <button class="action-btn danger" onclick="app.handleDeleteTransaction(${t.id})" title="Delete Transaction">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>
            </tr>
        `, 'No transactions found.');

        this.setText('tx-page-info', `Page ${this.state.txHistoryPage} of ${totalPages}`);
        const prevBtn = $('#prev-tx');
        if (prevBtn) prevBtn.disabled = this.state.txHistoryPage <= 1;
        const nextBtn = $('#next-tx');
        if (nextBtn) nextBtn.disabled = this.state.txHistoryPage >= totalPages;

        this.refreshIcons();
    }

    updateCategoryDropdown(type) {
        const select = $('#tx-category');
        if (!select) return;

        const filtered = this.state.categories.filter(c =>
            c.type === type && (c.status === 'active' || !c.status)
        );

        select.innerHTML = filtered.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        this.updateBudgetHint();
    }

    updateBudgetHint() {
        const category = $('#tx-category')?.value;
        const dateVal = $('#tx-date')?.value;
        const hintEl = $('#budget-hint');
        if (!hintEl || !category) return;

        const budget = this.state.budgets.find(b => b.category === category);
        if (!budget) return hintEl.innerText = '';

        const now = dateVal ? new Date(dateVal) : new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const spent = this.state.transactions
            .filter(t => t.category === category && t.type === 'expense')
            .filter(t => {
                const d = new Date(t.start_date);
                return d >= monthStart && d < nextMonthStart;
            })
            .reduce((sum, t) => sum + t.amount, 0);

        const remaining = budget.amount - spent;
        hintEl.innerHTML = remaining < 0
            ? `<span style="color: var(--danger)">⚠️ Over budget by ${this.formatter.formatCurrency(Math.abs(remaining))}</span>`
            : `<span style="color: var(--success)">✓ ${this.formatter.formatCurrency(remaining)} remaining this month</span>`;
    }
}

window.TransactionsView = TransactionsView;
