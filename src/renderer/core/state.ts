import type {
  Account,
  Category,
  TransactionListDTO,
  Budget,
  Goal,
  RecurringCharge,
  BillType,
  BillReading,
  ExchangeRate,
  Setting,
} from '../../shared/types';
import type { TransactionWithCategory } from '../../main/database/types';
import { DateUtils } from '../../shared/utils/dateUtils';

import { eventBus } from './eventBus';

export class StateManager {
  transactions: TransactionWithCategory[];
  transactionMetadata: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  accounts: Account[];
  categories: Category[];
  settings: Record<string, string>;
  aiSettings: any;
  summaryStats: {
    netWorth: number;
    totalBalance: number;
    monthIncome: number;
    monthExpense: number;
    savingsRate: number;
  };

  theme: 'light' | 'dark' | 'system';

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
  // Extended types for UI
  billTypes: (BillType & { account_name?: string })[];
  billReadings: (BillReading & { bill_name: string })[];
  allBillReadings: (BillReading & { bill_name: string })[];
  billHistoryFilter: { year: number; month: number };
  exchangeRates: ExchangeRate[];
  recurringCharges: RecurringCharge[];

  constructor() {
    this.transactions = [];
    this.transactionMetadata = { total: 0, limit: 100, offset: 0, hasMore: false };
    this.accounts = [];
    this.categories = [];
    this.settings = {};
    this.aiSettings = {};
    this.summaryStats = { netWorth: 0, totalBalance: 0, monthIncome: 0, monthExpense: 0, savingsRate: 0 };
    this.theme = 'system';
    this.txHistoryFilter = 'all';
    this.txHistoryPage = 1;
    this.txHistoryPageSize = 100;
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
      month: 0, // All Months
    };
    this.exchangeRates = [];
    this.exchangeRates = [];
    this.recurringCharges = [];

    this.editingTxId = null;
  }

  editingTxId: number | null;

  private checkResponse(response: any): boolean {
    if (response && response.error === true) {
      console.warn('IPC Error detected:', response);
      eventBus.emit('api:error', response);
      return false;
    }
    return true;
  }

  async loadSettings(): Promise<void> {
    const settings = await window.api.getSettings();
    this.settings = settings && typeof settings === 'object' ? settings : {};
    const aiSettings = await window.api.getAISettings();
    this.aiSettings = aiSettings && typeof aiSettings === 'object' ? aiSettings : {};

    // Initial theme application
    this.applyTheme(this.settings.theme || 'system');

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

  async goToPage(page: number): Promise<void> {
    this.txHistoryPage = page;
    await this.loadTransactions();
  }



  async loadSummaryStats(): Promise<void> {
    try {
      const baseCurrency = this.settings.currency_base;
      this.summaryStats = await window.api.getSummaryStats(baseCurrency);
    } catch (e) {
      console.warn('Failed to load summary stats', e);
    }
  }

  async loadTransactions(): Promise<void> {
    const options: any = {
      limit: this.txHistoryPageSize,
      offset: (this.txHistoryPage - 1) * this.txHistoryPageSize,
      sortBy: this.txSortField,
      sortOrder: this.txSortOrder,
    };

    if (this.txHistoryFilter !== 'all') options.type = this.txHistoryFilter;
    if (this.txMonthFilter) {
      // txMonthFilter is YYYY-MM
      const [year, month] = this.txMonthFilter.split('-').map(Number);
      const { start: startDate, end: endDate } = DateUtils.getMonthBoundariesForYearMonth(year, month);
      options.startDate = startDate;
      options.endDate = endDate;
    }

    // Use proper typing based on new API contract
    const response = await window.api.getTransactions(options);

    if (!this.checkResponse(response)) return;

    // Handle both new PaginatedResponse (object) and legacy array (fallback)
    if (response && 'data' in response && Array.isArray(response.data)) {
      this.transactions = response.data as unknown as TransactionWithCategory[];
      this.transactionMetadata = {
        total: response.total,
        limit: response.limit,
        offset: response.offset,
        hasMore: response.hasMore
      };
    } else if (Array.isArray(response)) {
      console.warn('Received legacy array response for transactions');
      this.transactions = response;
      this.transactionMetadata = { total: response.length, limit: response.length, offset: 0, hasMore: false };
    } else {
      this.transactions = [];
      this.transactionMetadata = { total: 0, limit: 100, offset: 0, hasMore: false };
    }

    await this.loadSummaryStats();
  }

  async loadMoreTransactions(): Promise<void> {
    if (this.transactionMetadata.hasMore) {
      await this.loadTransactions();
    }
  }

  applyTheme(theme: string): void {
    this.theme = (['light', 'dark', 'system'].includes(theme) ? theme : 'system') as 'light' | 'dark' | 'system';

    let mode = this.theme;
    if (this.theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      mode = isDark ? 'dark' : 'light';
    }

    // Persist resolved mode (or effectively the current appearance) for FOUC prevention
    localStorage.setItem('bofo_theme_cache', mode);

    document.documentElement.setAttribute('data-theme', mode);

    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Dispatch custom event for UI components to react (e.g., charts)
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: { mode, theme: this.theme } }));
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
    const data = await window.api.getBillTypes();
    this.billTypes = Array.isArray(data) ? data : [];
  }

  async loadBillReadings(filters: any = null): Promise<void> {
    const readings = await window.api.getBillReadings(filters || this.billHistoryFilter);
    this.billReadings = Array.isArray(readings) ? readings : [];

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
