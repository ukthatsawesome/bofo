class App {
    constructor() {
        this.state = new StateManager();
        this.formatter = new Formatter(this.state);
        this.chartManager = new ChartManager(this.state);

        this.views = {
            dashboard: new DashboardView(this),
            transactions: new TransactionsView(this),
            forecast: new ForecastView(this),
            budget: new BudgetView(this),
            whatif: new WhatIfView(this),
            settings: new SettingsView(this)
        };

        this.currentView = null;
        this.currencies = [
            { code: 'USD', name: 'US Dollar', symbol: '$' },
            { code: 'EUR', name: 'Euro', symbol: '€' },
            { code: 'GBP', name: 'British Pound', symbol: '£' },
            { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
            { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
            { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
            { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
            { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
            { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
            { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' }
        ];
    }

    async init() {
        try {
            await Promise.all([
                this.state.loadSettings(),
                this.state.loadAccounts(),
                this.state.loadCategories(),
                this.state.loadTransactions(),
                this.state.loadBudgets()
            ]);

            this.populateCurrencyDropdowns();
            this.setupNavigation();
            this.setupAccountModal();

            this.switchView('dashboard');
            UIUtils.refreshIcons();
        } catch (error) {
            console.error('App initialization failed:', error);
        }
    }

    populateCurrencyDropdowns() {
        const html = this.currencies.map(c => `<option value="${c.code}">${c.code} - ${c.name}</option>`).join('');
        $$('.currency-select').forEach(el => {
            const current = el.value;
            el.innerHTML = html;
            if (current) el.value = current;
        });
    }

    setupNavigation() {
        $$('.nav-links li').forEach(link => {
            link.addEventListener('click', () => {
                const target = link.dataset.view;
                $$('.nav-links li').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                this.switchView(target);
            });
        });
    }

    switchView(viewId) {
        if (this.currentView) this.currentView.hide();
        this.currentView = this.views[viewId];
        if (this.currentView) this.currentView.show();
        UIUtils.refreshIcons();
    }

    updateAccountDropdowns() {
        const optionsHtml = this.state.accounts.map(acc =>
            `<option value="${acc.id}">${acc.name} (${this.formatter.formatCurrency(acc.balance, acc.currency)})</option>`
        ).join('');
        ['#tx-account', '#tx-to-account', '#edit-tx-account', '#edit-tx-to-account', '.dropdown-account'].forEach(sel => {
            $$(sel).forEach(el => el.innerHTML = optionsHtml);
        });
    }

    setupAccountModal() {
        $('#btn-add-account')?.addEventListener('click', () => UIUtils.setHidden('#account-modal', false));
        $('#close-acc-modal')?.addEventListener('click', () => UIUtils.setHidden('#account-modal', true));

        $('#save-account')?.addEventListener('click', async () => {
            const name = $('#acc-name').value;
            const type = $('#acc-type').value;
            const balance = parseFloat($('#acc-balance').value);
            const currency = $('#acc-currency').value;
            const editId = $('#save-account').dataset.editId;

            if (!name) return notifications.alert('Name Required', 'Please enter an account name', 'error');

            if (editId) {
                await window.api.updateAccount({ id: editId, data: { name, type, balance, currency } });
                delete $('#save-account').dataset.editId;
            } else {
                await window.api.addAccount({ name, type, balance, currency });
            }

            UIUtils.setHidden('#account-modal', true);
            this.resetAccountModal();

            await this.state.loadAccounts();
            if (this.views.settings) this.views.settings.renderAccountsTable();
            this.updateAccountDropdowns();
        });
    }

    resetAccountModal() {
        const nameEl = $('#acc-name');
        if (nameEl) nameEl.value = '';

        const balEl = $('#acc-balance');
        if (balEl) balEl.value = '0.00';

        const saveBtn = $('#save-account');
        if (saveBtn) saveBtn.innerText = 'Save Account';

        const modalTitle = $('#account-modal h2');
        if (modalTitle) modalTitle.innerText = 'Setup New Account';
    }

    async handleDeleteTransaction(id) {
        if (await notifications.confirm('Delete Transaction', 'Permanently delete this transaction?', 'error')) {
            await window.api.deleteTransaction(id);
            await Promise.all([this.state.loadTransactions(), this.state.loadAccounts()]);
            this.currentView?.render?.();
            this.updateAccountDropdowns();
            notifications.toast('Success', 'Transaction deleted', 'success');
        }
    }

    async handleDeleteAccount(id) {
        if (await notifications.confirm('Delete Account', 'Remove this account and affect balances?', 'warning')) {
            await window.api.deleteAccount(id);
            await this.state.loadAccounts();
            this.views.settings?.renderAccountsTable();
            this.updateAccountDropdowns();
            notifications.toast('Success', 'Account removed successfully', 'success');
        }
    }

    async handleArchiveCategory(id) {
        await window.api.archiveCategory(id);
        await this.state.loadCategories();
        this.views.settings?.renderCategoryTable();
    }

    async handleUnarchiveCategory(id) {
        await window.api.unarchiveCategory(id);
        await this.state.loadCategories();
        this.views.settings?.renderCategoryTable();
    }

    async handleDeleteCategory(id) {
        if (await notifications.confirm('Delete Category', 'Permanently delete?', 'error')) {
            await window.api.deleteCategory(id);
            await this.state.loadCategories();
            this.views.settings?.renderCategoryTable();
            notifications.toast('Success', 'Category permanently removed', 'success');
        }
    }

    async handleAddNewCategory() {
        const name = $('#new-cat-name').value.trim();
        const type = $('#new-cat-type').value;
        if (!name) return notifications.alert('Name Required', 'Enter a name', 'error');

        await window.api.addCategory({ type, name });
        $('#new-cat-name').value = '';
        await this.state.loadCategories();
        this.state.categoryTableFilter = type;
        this.views.settings?.renderCategoryTable();
    }

    filterCategoryTable(type) {
        this.state.categoryTableFilter = type;
        this.state.categoryTablePage = 1;
        this.views.settings?.renderCategoryTable();
    }

    showSettingsSubView(subViewId) { this.views.settings?.showSubView(subViewId); }
    showSettingsHome() { this.views.settings?.showHome(); }

    async updateAppSetting(key, value) {
        const valStr = typeof value === 'boolean' ? String(value) : value;
        await window.api.updateSetting({ key, value: valStr });
        await this.state.loadSettings();
        if (key === 'theme') this.state.applyTheme(valStr);
    }

    setLoading(isLoading) { UIUtils.setHidden('#global-loader', !isLoading); }

    handleEditAccount(id) {
        const acc = this.state.accounts.find(a => a.id == id);
        if (!acc) return;

        const nameEl = $('#acc-name');
        if (nameEl) nameEl.value = acc.name;

        const typeEl = $('#acc-type');
        if (typeEl) typeEl.value = acc.type;

        const balEl = $('#acc-balance');
        if (balEl) balEl.value = acc.balance;

        const curEl = $('#acc-currency');
        if (curEl) curEl.value = acc.currency;

        const modalTitle = $('#account-modal h2');
        if (modalTitle) modalTitle.innerText = 'Edit Account';

        const saveBtn = $('#save-account');
        if (saveBtn) {
            saveBtn.innerText = 'Update Account';
            saveBtn.dataset.editId = id;
        }

        UIUtils.setHidden('#account-modal', false);
    }

    async handleExportData(format) {
        try {
            const data = format === 'json' ? await window.api.exportData() : await window.api.exportCSV();
            const type = format === 'json' ? 'application/json' : 'text/csv';
            const filename = `bofo_${format === 'json' ? 'backup' : 'tx'}_${new Date().toISOString().split('T')[0]}.${format}`;

            const blob = new Blob([format === 'json' ? JSON.stringify(data, null, 2) : data], { type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            notifications.toast('Export Success', `Data saved as ${filename}`, 'success');
        } catch (err) {
            notifications.alert('Export Failed', err.message, 'error');
        }
    }

    async handleImportData(input) {
        const file = input.files[0];
        if (!file || !(await notifications.confirm('Restore Backup', 'Overwrite all data?', 'warning'))) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                await window.api.importData(JSON.parse(e.target.result));
                await this.init();
                notifications.toast('Restore Complete', 'Your financial data has been fully recovered', 'success');
            } catch (err) {
                notifications.alert('Import Failed', 'Invalid backup file', 'error');
            }
        };
        reader.readAsText(file);
        input.value = '';
    }
}

window.App = App;
