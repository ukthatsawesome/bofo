
import type {
    Account, Category, TransactionWithCategory, Budget, Goal, RecurringCharge,
    BillType, BillReading, ExchangeRate, Setting
} from '../../database/types';

export class StateManager {
    transactions: TransactionWithCategory[];
    accounts: Account[];
    categories: Category[];
    settings: Record<string, string>;
    aiSettings: any;

    // Filters & Pagination
    txHistoryFilter: string;
    txHistoryPage: number;
    txHistoryPageSize: number;
    txMonthFilter: string;
    txSortField: string;
    txSortOrder: string;
    categoryTableFilter: string;
    categoryTablePage: number;
    categoryTablePageSize: number;
    categorySortField: string;
    categorySortDirection: string;
    accountSortField: string;
    accountSortDirection: string;
    recurringSortField: string;
    recurringSortDirection: string;

    whatIfTransactions: any[];
    budgets: Budget[];
    budgetViewMonth: string;
    budgetViewFilter: string;
    billTypes: BillType[];
    billReadings: BillReading[];
    allBillReadings: BillReading[];
    billHistoryFilter: { year: number; month: number };
    exchangeRates: ExchangeRate[];
    recurringCharges: RecurringCharge[];

    constructor() {
        this.transactions = [];
        this.accounts = [];
        this.categories = [];
        this.settings = {};
        this.aiSettings = {};
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
        this.recurringCharges = [];
    }

    async loadSettings(): Promise<void> {
        const settings = await window.api.getSettings();
        this.settings = settings && typeof settings === 'object' ? settings : {};
        const aiSettings = await window.api.getAISettings();
        this.aiSettings = aiSettings && typeof aiSettings === 'object' ? aiSettings : {};
        this.applyTheme(this.settings.theme || 'dark');
        await this.loadBillTypes();
        await this.loadExchangeRates();
    }

    async loadExchangeRates(): Promise<void> {
        try {
            const rates = await window.api.getExchangeRates();
            this.exchangeRates = Array.isArray(rates) ? rates : [];
        } catch (e) {
            console.warn('Failed to load exchange rates:', e);
            this.exchangeRates = [];
        }
    }

    async loadAccounts(): Promise<void> {
        const data = await window.api.getAccounts();
        this.accounts = Array.isArray(data) ? data : [];
    }

    async loadCategories(): Promise<void> {
        const data = await window.api.getCategories();
        this.categories = Array.isArray(data) ? data : [];
    }

    async loadTransactions(): Promise<void> {
        const data = await window.api.getTransactions();
        this.transactions = (Array.isArray(data) ? data : []).sort((a, b) =>
            new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        );
    }

    applyTheme(theme: string): void {
        // Light mode only for now (dark mode deferred)
        document.documentElement.setAttribute('data-theme', 'light');
    }

    getCurrencyPrecision(): number {
        return parseInt(this.settings.currency_precision || '2');
    }

    getBaseCurrency(): string {
        return this.settings.currency_base || 'USD';
    }

    async loadBudgets(): Promise<void> {
        const data = await window.api.getBudgets();
        this.budgets = Array.isArray(data) ? data : [];
    }

    async loadBillTypes(): Promise<void> {
        // @ts-ignore - mismatch in expected structure? Types say BillType[], but API returns BillType including account_name
        const data = await window.api.getBillTypes();
        this.billTypes = Array.isArray(data) ? data : [];
    }

    async loadBillReadings(filters: any = null): Promise<void> {
        // @ts-ignore
        const readings = await window.api.getBillReadings(filters || this.billHistoryFilter);
        this.billReadings = Array.isArray(readings) ? readings : [];
        // @ts-ignore
        const allReadings = await window.api.getBillReadings({}); // All time
        this.allBillReadings = Array.isArray(allReadings) ? allReadings : [];
    }

    async loadRecurringCharges(): Promise<void> {
        const data = await window.api.getRecurringCharges();
        this.recurringCharges = Array.isArray(data) ? data : [];
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    (window as any).StateManager = StateManager;
}
