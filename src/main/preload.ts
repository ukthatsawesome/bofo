import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  TransactionPayload, CategoryPayload, AccountPayload, AppSettings,
  GoalPayload, RecurringChargePayload, BillTypePayload, BillReadingPayload,
  AISettings, TransactionFilter,
} from '../shared/types';

const invokeWithTimeout = async (channel: string, args: any[] = [], timeoutMs: number = 5000) => {
  let timeoutId: any;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Request Timed Out for channel: ${channel}`)), timeoutMs);
  });

  try {
    const result = await Promise.race([
      ipcRenderer.invoke(channel, ...args),
      timeoutPromise
    ]);

    if (result && typeof result === 'object' && result.error === true) {
      const error = new Error(result.message || 'Unknown IPC Error');
      (error as any).code = result.code;
      throw error;
    }

    return result;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

contextBridge.exposeInMainWorld('api', {
  // Transactions
  getTransactions: (options?: TransactionFilter) => invokeWithTimeout('get-transactions', [options]),
  getTransaction: (id: number) => invokeWithTimeout('get-transaction', [id]),
  getTransactionsPaginated: (options: { limit: number; offset: number; filters?: any }) =>
    invokeWithTimeout('get-transactions-paginated', [options]),
  getTransactionCount: (options: { filters?: any }) => invokeWithTimeout('get-transaction-count', [options]),
  addTransaction: (data: TransactionPayload) => invokeWithTimeout('add-transaction', [data]),
  updateTransaction: (id: number, data: Partial<TransactionPayload>) =>
    invokeWithTimeout('update-transaction', [{ id, data }]),
  deleteTransaction: (id: number) => invokeWithTimeout('delete-transaction', [id]),
  getTransactionStats: (options: { startDate: string; endDate: string }) => invokeWithTimeout('get-transaction-stats', [options]),
  calculateForecast: (data: { accounts: any[]; transactions: any[]; months: number }) => invokeWithTimeout('calculate-forecast', [data]),

  // Categories
  getCategories: () => invokeWithTimeout('get-categories'),
  isCategoryInUse: (name: string) => invokeWithTimeout('is-category-in-use', [name]),
  addCategory: (data: CategoryPayload) => invokeWithTimeout('add-category', [data]),
  updateCategory: (id: number, data: Partial<CategoryPayload>) => invokeWithTimeout('update-category', [{ id, data }]),
  deleteCategory: (id: number) => invokeWithTimeout('delete-category', [id]),
  archiveCategory: (id: number) => invokeWithTimeout('archive-category', [id]),
  unarchiveCategory: (id: number) => invokeWithTimeout('unarchive-category', [id]),

  // Accounts
  getAccounts: () => invokeWithTimeout('get-accounts'),
  addAccount: (data: AccountPayload) => invokeWithTimeout('add-account', [data]),
  updateAccount: (data: Partial<AccountPayload> & { id: number }) => invokeWithTimeout('update-account', [data]),
  deleteAccount: (id: number) => invokeWithTimeout('delete-account', [id]),
  archiveAccount: (id: number) => invokeWithTimeout('archive-account', [id]),
  unarchiveAccount: (id: number) => invokeWithTimeout('unarchive-account', [id]),
  isAccountInUse: (id: number) => invokeWithTimeout('is-account-in-use', [id]),

  // Settings
  getSettings: () => invokeWithTimeout('get-settings'),
  updateSetting: (data: { key: string; value: string }) => invokeWithTimeout('update-setting', [data]),
  saveSettings: (settings: AppSettings) => invokeWithTimeout('save-settings', [settings]),
  getEffectiveConfig: () => invokeWithTimeout('get-effective-config'),
  generateSecureKey: () => invokeWithTimeout('generate-secure-key'),

  // Budgets
  getBudgets: () => invokeWithTimeout('get-budgets'),
  setBudget: (
    category: string,
    amount: number,
    period: string,
    startDate: string,
    endDate: string
  ) => invokeWithTimeout('set-budget', [{ category, amount, period, startDate, endDate }]),
  getBudgetSummary: () => invokeWithTimeout('get-budget-summary'),
  updateBudget: (
    id: number,
    category: string,
    amount: number,
    period: string,
    startDate: string,
    endDate: string
  ) => invokeWithTimeout('update-budget', [{ id, category, amount, period, startDate, endDate }]),
  deleteBudget: (id: number) => invokeWithTimeout('delete-budget', [id]),

  // Goals
  getGoals: () => invokeWithTimeout('get-goals'),
  getActiveGoals: () => invokeWithTimeout('get-active-goals'),
  getGoal: (id: number) => invokeWithTimeout('get-goal', [id]),
  createGoal: (data: GoalPayload) => invokeWithTimeout('create-goal', [data]),
  updateGoal: (id: number, data: Partial<GoalPayload>) => invokeWithTimeout('update-goal', [{ id, data }]),
  deleteGoal: (id: number) => invokeWithTimeout('delete-goal', [id]),
  contributeToGoal: (goalId: number, amount: number, source: string, notes: string) =>
    invokeWithTimeout('contribute-to-goal', [{ goalId, amount, source, notes }]),
  getGoalContributions: (goalId: number) => invokeWithTimeout('get-goal-contributions', [goalId]),
  getGoalsSummary: () => invokeWithTimeout('get-goals-summary'),

  // Recurring Charges
  getRecurringCharges: () => invokeWithTimeout('get-recurring-charges'),
  getActiveRecurringCharges: () => invokeWithTimeout('get-active-recurring-charges'),
  createRecurringCharge: (data: RecurringChargePayload) => invokeWithTimeout('create-recurring-charge', [data]),
  updateRecurringCharge: (id: number, data: Partial<RecurringChargePayload>) =>
    invokeWithTimeout('update-recurring-charge', [{ id, data }]),
  deleteRecurringCharge: (id: number) => invokeWithTimeout('delete-recurring-charge', [id]),
  getMonthlyRecurringTotal: () => invokeWithTimeout('get-monthly-recurring-total'),

  // Financial Summary
  getAvailableForGoals: () => invokeWithTimeout('get-available-for-goals'),

  // Data Export/Import
  exportData: () => invokeWithTimeout('export-data'),
  importData: () => invokeWithTimeout('import-data', [], 60000), // Extended timeout for import
  exportExcel: () => invokeWithTimeout('export-excel'),

  // Auto-Backup
  pickBackupDirectory: () => invokeWithTimeout('pick-backup-directory'),
  runBackupNow: () => invokeWithTimeout('run-backup-now'),

  // AI
  aiChat: (message: string) => invokeWithTimeout('ai-chat', [message]),
  getAISettings: () => invokeWithTimeout('get-ai-settings'),
  getAIDefaults: () => invokeWithTimeout('get-ai-defaults'),
  saveAISettings: (settings: AISettings) => invokeWithTimeout('save-ai-settings', [settings]),
  getAIModels: (url: string) => invokeWithTimeout('get-ai-models', [url], 10000),
  getOllamaModels: (url: string) => invokeWithTimeout('get-ai-models', [url], 10000), // Alias for compatibility
  checkAIConnection: () => invokeWithTimeout('check-ai-connection', [], 10000),
  getAIHealth: () => invokeWithTimeout('get-ai-health'),
  parseTransactionAI: (text: string) => invokeWithTimeout('parse-transaction-ai', [text], 60000),
  getAIInsight: (summary: any) => invokeWithTimeout('get-ai-insight', [summary], 60000),
  chatSandbox: (text: string, context: any) =>
    invokeWithTimeout('chat-sandbox', [{ text, context }], 120000),
  onChatSandboxChunk: (callback: (chunk: any) => void) => {
    const listener = (_event: IpcRendererEvent, chunk: any) => callback(chunk);
    ipcRenderer.on('chat-sandbox-chunk', listener);
    return () => ipcRenderer.removeListener('chat-sandbox-chunk', listener);
  },

  // Bills
  getBillTypes: () => invokeWithTimeout('get-bill-types'),
  addBillType: (data: BillTypePayload) => invokeWithTimeout('add-bill-type', [data]),
  updateBillType: (data: Partial<BillTypePayload> & { id: number }) => invokeWithTimeout('update-bill-type', [data]),
  deleteBillType: (id: number) => invokeWithTimeout('delete-bill-type', [id]),
  getBillReadings: (filters: { billTypeId?: number; year?: number }) => invokeWithTimeout('get-bill-readings', [filters]),
  getBillReadingsPaginated: (options: { limit: number; offset: number; filters?: any }) =>
    invokeWithTimeout('get-bill-readings-paginated', [options]),
  addBillReading: (data: BillReadingPayload) => invokeWithTimeout('add-bill-reading', [data]),
  updateBillReading: (id: number, data: Partial<BillReadingPayload>) =>
    invokeWithTimeout('update-bill-reading', [{ id, data }]),
  deleteBillReading: (id: number) => invokeWithTimeout('delete-bill-reading', [id]),
  getBillProjections: (months?: number) => invokeWithTimeout('get-bill-projections', [months]),

  // Exchange Rates
  getExchangeRates: () => invokeWithTimeout('get-exchange-rates'),
  getExchangeRate: (from: string, to: string) =>
    invokeWithTimeout('get-exchange-rate', [{ from, to }]),
  setExchangeRate: (data: { from: string; to: string; rate: number; source?: string }) =>
    invokeWithTimeout('set-exchange-rate', [data]),
  deleteExchangeRate: (id: number) => invokeWithTimeout('delete-exchange-rate', [id]),
  convertCurrency: (amount: number, from: string, to: string) =>
    invokeWithTimeout('convert-currency', [{ amount, from, to }]),
  getUsedCurrencies: () => invokeWithTimeout('get-used-currencies'),
  getAccountsConverted: (baseCurrency: string) =>
    invokeWithTimeout('get-accounts-converted', [baseCurrency]),
  getRateSyncStatus: () => invokeWithTimeout('get-rate-sync-status'),
  getTotalBalance: (baseCurrency: string) => invokeWithTimeout('get-total-balance', [baseCurrency]),
  syncExchangeRates: (data: { provider: string; baseCurrency: string; customUrl?: string }) =>
    invokeWithTimeout('sync-exchange-rates', [data]),
  testCurrencyAPI: (data: { provider: string; baseCurrency?: string; customUrl?: string }) =>
    invokeWithTimeout('test-currency-api', [data]),
  getCurrencyProviders: () => invokeWithTimeout('get-currency-providers'),

  // Remote Access
  getHostInfo: () => invokeWithTimeout('get-host-info'),
  restartWebServer: () => ipcRenderer.send('restart-web-server'),

  // Analytics
  getSummaryStats: (baseCurrency?: string) => invokeWithTimeout('get-summary-stats', [baseCurrency]),
  getDashboardData: (months?: number) => invokeWithTimeout('get-dashboard-data', [months]),
  getCategorySpending: (startDate: string, endDate: string) =>
    invokeWithTimeout('get-category-spending', [{ startDate, endDate }]),
  onNativeThemeChanged: (callback: (isDark: boolean) => void) => {
    const listener = (_event: IpcRendererEvent, isDark: boolean) => callback(isDark);
    ipcRenderer.on('native-theme-changed', listener);
    return () => ipcRenderer.removeListener('native-theme-changed', listener);
  },
  onDbStatus: (callback: (status: string, message?: string) => void) => {
    const listener = (_event: IpcRendererEvent, status: string, message?: string) => callback(status, message);
    ipcRenderer.on('app:db-status', listener);
    return () => ipcRenderer.removeListener('app:db-status', listener);
  },
  getDbStatus: () => invokeWithTimeout('get-db-status'),

  // Audit
  getAuditLogs: (options: { limit?: number; offset?: number; source?: string }) => invokeWithTimeout('get-audit-logs', [options]),

  // Anomaly Detection
  detectAnomalies: (data: { transaction: TransactionPayload }) => invokeWithTimeout('detect-anomalies', [data]),
  getCategoryStats: () => invokeWithTimeout('get-category-stats'),
  seedDatabase: () => invokeWithTimeout('seed-db'),

  version: '1.1.2',
});
