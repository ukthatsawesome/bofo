class StateManager {
    constructor() {
        this.transactions = [];
        this.accounts = [];
        this.categories = [];
        this.settings = {};
        this.txHistoryFilter = 'all';
        this.txHistoryPage = 1;
        this.txHistoryPageSize = 10;
        this.txMonthFilter = ''; // Empty means all time
        this.categoryTableFilter = 'all';
        this.categoryTablePage = 1;
        this.categoryTablePageSize = 50;
        this.whatIfTransactions = [];
        this.budgets = [];
        this.budgetViewMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        this.budgetViewFilter = 'active'; // 'active' or 'past'
    }

    async loadSettings() {
        this.settings = await window.api.getSettings();
        this.applyTheme(this.settings.theme || 'dark');
    }

    async loadAccounts() {
        this.accounts = await window.api.getAccounts();
    }

    async loadCategories() {
        this.categories = await window.api.getCategories();
    }

    async loadTransactions() {
        const data = await window.api.getTransactions();
        this.transactions = data.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
    }

    applyTheme(theme) {
        if (theme === 'system') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    getCurrencyPrecision() {
        return parseInt(this.settings.currency_precision || 2);
    }

    getBaseCurrency() {
        return this.settings.currency_base || 'USD';
    }

    async loadBudgets() {
        this.budgets = await window.api.getBudgets();
    }
}

// Export for use in other modules
window.StateManager = StateManager;
