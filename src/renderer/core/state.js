export class StateManager {
    constructor() {
        this.transactions = [];
        this.accounts = [];
        this.categories = [];
        this.settings = {};
        this.txHistoryFilter = 'all';
        this.txHistoryPage = 1;
        this.txHistoryPageSize = 10;
        this.txMonthFilter = ''; // Empty means all time
        this.txSortField = 'start_date';
        this.txSortOrder = 'desc'; // 'asc' or 'desc'
        this.categoryTableFilter = 'all';
        this.categoryTablePage = 1;
        this.categoryTablePageSize = 50;
        this.categorySortField = 'name';
        this.categorySortDirection = 'asc';
        this.accountSortField = 'name';
        this.accountSortDirection = 'asc';
        this.recurringSortField = 'name';
        this.recurringSortDirection = 'asc';
        this.whatIfTransactions = [];
        this.budgets = [];
        this.budgetViewMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        this.budgetViewFilter = 'active'; // 'active' or 'past'
        this.billTypes = [];
        this.billReadings = [];
        this.allBillReadings = [];
        this.billHistoryFilter = {
            year: new Date().getFullYear(),
            month: 0 // All Months
        };
        this.exchangeRates = [];
    }

    async loadSettings() {
        this.settings = await window.api.getSettings();
        this.aiSettings = await window.api.getAISettings();
        this.applyTheme(this.settings.theme || 'dark');
        await this.loadBillTypes();
        await this.loadExchangeRates();
    }

    async loadExchangeRates() {
        try {
            const rates = await window.api.getExchangeRates();
            this.exchangeRates = Array.isArray(rates) ? rates : [];
        } catch (e) {
            console.warn('Failed to load exchange rates:', e);
            this.exchangeRates = [];
        }
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
        // Store theme preference
        localStorage.setItem('bofo-theme', theme);

        // Resolve system theme
        let resolvedTheme = theme;
        if (theme === 'system') {
            resolvedTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }

        // Apply to HTML element
        document.documentElement.setAttribute('data-theme', resolvedTheme);

        // Update meta theme-color for browser
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.content = resolvedTheme === 'light' ? '#f8fafc' : '#09090b';
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

    async loadBillTypes() {
        this.billTypes = await window.api.getBillTypes();
    }

    async loadBillReadings(filters = null) {
        this.billReadings = await window.api.getBillReadings(filters || this.billHistoryFilter);
        this.allBillReadings = await window.api.getBillReadings({}); // All time
    }
}

// Export for use in other modules
window.StateManager = StateManager;
