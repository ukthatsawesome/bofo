import type {
  Account,
  Category,
  Transaction,
  TransactionListDTO,
  Budget,
  Goal,
  RecurringCharge,
  BillType,
  BillReading,
  ExchangeRate,
  Setting,
  GoalContribution,
  PaginatedResponse,
  TransactionWithCategory,
  CategorySpending,
  DashboardData,
  SummaryStats,
  AuditLog,
} from '../../../shared/types';


export interface API {
  // Transactions
  getTransactions: (options?: any) => Promise<TransactionListDTO>;
  getTransactionsPaginated: (
    options: any
  ) => Promise<TransactionListDTO>;
  getTransaction: (id: number) => Promise<Transaction>;
  getTransactionCount: (options: any) => Promise<number>;
  addTransaction: (data: Partial<Transaction>) => Promise<any>;
  updateTransaction: (id: number, data: Partial<Transaction>) => Promise<any>;
  deleteTransaction: (id: number) => Promise<any>;
  calculateForecast: (data: any) => Promise<any>;

  // Categories
  getCategories: () => Promise<Category[]>;
  isCategoryInUse: (name: string) => Promise<boolean>;
  addCategory: (data: Partial<Category>) => Promise<any>;
  updateCategory: (id: number, data: Partial<Category>) => Promise<any>;
  deleteCategory: (id: number) => Promise<any>;
  archiveCategory: (id: number) => Promise<any>;
  unarchiveCategory: (id: number) => Promise<any>;

  // Accounts
  getAccounts: () => Promise<Account[]>;
  addAccount: (data: Partial<Account>) => Promise<any>;
  updateAccount: (data: Partial<Account>) => Promise<any>;
  deleteAccount: (id: number) => Promise<any>;
  archiveAccount: (id: number) => Promise<any>;
  unarchiveAccount: (id: number) => Promise<any>;
  isAccountInUse: (id: number) => Promise<boolean>;

  // Settings
  getSettings: () => Promise<Record<string, string>>;
  updateSetting: (data: { key: string; value: string }) => Promise<any>;
  saveSettings: (settings: Record<string, any>) => Promise<any>;

  // Budgets
  getBudgets: () => Promise<Budget[]>;
  setBudget: (
    category: string,
    amount: number,
    period: string,
    startDate: string,
    endDate: string
  ) => Promise<any>;
  updateBudget: (
    id: number,
    category: string,
    amount: number,
    period: string,
    startDate: string,
    endDate: string
  ) => Promise<any>;
  deleteBudget: (id: number) => Promise<any>;

  // Goals
  getGoals: () => Promise<Goal[]>;
  getActiveGoals: () => Promise<Goal[]>;
  getGoal: (id: number) => Promise<Goal>;
  createGoal: (data: Partial<Goal>) => Promise<any>;
  updateGoal: (id: number, data: Partial<Goal>) => Promise<any>;
  deleteGoal: (id: number) => Promise<any>;
  contributeToGoal: (goalId: number, amount: number, source: string | null, notes: string | null) => Promise<any>;
  getGoalContributions: (goalId: number) => Promise<GoalContribution[]>;
  getGoalsSummary: () => Promise<any>;

  // Recurring Charges
  getRecurringCharges: () => Promise<RecurringCharge[]>;
  getActiveRecurringCharges: () => Promise<RecurringCharge[]>;
  createRecurringCharge: (data: Partial<RecurringCharge>) => Promise<any>;
  updateRecurringCharge: (id: number, data: Partial<RecurringCharge>) => Promise<any>;
  deleteRecurringCharge: (id: number) => Promise<any>;
  getMonthlyRecurringTotal: () => Promise<number>;

  // Financial Summary
  getAvailableForGoals: () => Promise<any>;

  // Data Export/Import
  exportData: () => Promise<any>;
  importData: () => Promise<any>;
  exportCSV: () => Promise<boolean>;
  exportExcel: () => Promise<boolean>;

  // Auto-Backup
  pickBackupDirectory: () => Promise<string | null>;
  runBackupNow: (directory?: string) => Promise<any>;

  // AI
  aiChat: (message: string) => Promise<string>,
  getAISettings: () => Promise<any>;
  getAIDefaults: () => Promise<any>;
  saveAISettings: (settings: any) => Promise<any>;
  getAIModels: (url?: string) => Promise<string[]>;
  getOllamaModels: (url?: string) => Promise<string[]>;
  checkAIConnection: (url?: string) => Promise<boolean>;
  getAIHealth: () => Promise<any>;
  parseTransactionAI: (text: string) => Promise<any>;
  getAIInsight: (summary: any) => Promise<string>;
  chatSandbox: (text: string, context: any) => Promise<string>;
  onChatSandboxChunk: (callback: (chunk: any) => void) => () => void;

  // Bills
  getBillTypes: () => Promise<(BillType & { account_name?: string })[]>;
  addBillType: (data: Partial<BillType>) => Promise<any>;
  updateBillType: (args: { id: number; data: Partial<BillType> }) => Promise<any>;
  deleteBillType: (id: number) => Promise<any>;
  getBillReadings: (filters: any) => Promise<(BillReading & { bill_name: string })[]>;
  getBillReadingsPaginated: (options: any) => Promise<any>;
  addBillReading: (data: Partial<BillReading>) => Promise<any>;
  updateBillReading: (id: number, data: Partial<BillReading>) => Promise<any>;
  deleteBillReading: (id: number) => Promise<any>;
  getBillProjections: (months?: number) => Promise<any[]>;

  // Exchange Rates
  getExchangeRates: () => Promise<ExchangeRate[]>;
  getExchangeRate: (from: string, to: string) => Promise<number | null>;
  setExchangeRate: (data: {
    from: string;
    to: string;
    rate: number;
    source?: string;
  }) => Promise<any>;
  deleteExchangeRate: (id: number) => Promise<any>;
  convertCurrency: (amount: number, from: string, to: string) => Promise<number | null>;
  getUsedCurrencies: () => Promise<string[]>;
  getAccountsConverted: (baseCurrency: string) => Promise<any[]>;
  getRateSyncStatus: () => Promise<{
    lastSync: string | null;
    isStale: boolean;
    hoursSinceSync: number;
    rateCount: number;
  }>;
  getTotalBalance: (
    baseCurrency: string
  ) => Promise<{
    total: number;
    convertedCount: number;
    unconvertedCount: number;
    breakdown: any[];
  }>;
  syncExchangeRates: (data: {
    provider: string;
    baseCurrency: string;
    customUrl?: string;
  }) => Promise<{ success: boolean; message?: string; ratesUpdated?: number }>;
  testCurrencyAPI: (data: {
    provider: string;
    baseCurrency?: string;
    customUrl?: string;
  }) => Promise<{ success: boolean; message: string }>;
  getCurrencyProviders: () => Promise<any[]>;


  // Remote Access
  getHostInfo: () => Promise<any>;
  restartWebServer: () => void;
  onNativeThemeChanged: (callback: (isDark: boolean) => void) => () => void;
  onDbStatus: (callback: (status: string, message?: string) => void) => () => void;
  getDbStatus: () => Promise<string>;
  version: string;

  // Analytics
  getSummaryStats: (baseCurrency?: string) => Promise<SummaryStats>;
  getDashboardData: (months?: number) => Promise<DashboardData>;
  getCategorySpending: (startDate: string, endDate: string) => Promise<CategorySpending[]>;
  getTransactionStats: (options: any) => Promise<{
    income: number;
    expense: number;
    transfers: number;
    count: number;
    topCategories: { category: string; amount: number; percent: string }[];
  }>;
  getBudgetSummary: () => Promise<{ totalAmount: number; usedAmount: number }>;

  // Audit
  getAuditLogs: (options?: any) => Promise<PaginatedResponse<AuditLog>>;

  // Anomaly Detection
  detectAnomalies: (data: { transaction: any }) => Promise<any>;
  getCategoryStats: () => Promise<any[]>;
}

export interface Lucide {
  createIcons: (options: { root: HTMLElement; icons?: any }) => void;
  icons: any;
}

declare global {
  interface Window {
    api: API;
    Formatter: any; // Ideally we type this properly
    StateManager: any;
    lucide: Lucide;
  }
}
