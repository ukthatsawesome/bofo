import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

const invokeWithTimeout = async (channel: string, ...args: any[]) => {
  const timeoutMs = 5000;
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request Timed Out')), timeoutMs);
  });

  // Race the invoke against the timeout
  return Promise.race([
    ipcRenderer.invoke(channel, ...args),
    timeoutPromise
  ]);
};

contextBridge.exposeInMainWorld('api', {
  // Transactions
  getTransactions: () => invokeWithTimeout('get-transactions'),
  getTransaction: (id: number) => invokeWithTimeout('get-transaction', id),
  getTransactionsPaginated: (options: any) =>
    invokeWithTimeout('get-transactions-paginated', options),
  getTransactionCount: (options: any) => invokeWithTimeout('get-transaction-count', options),
  addTransaction: (data: any) => invokeWithTimeout('add-transaction', data),
  updateTransaction: (id: number, data: any) =>
    invokeWithTimeout('update-transaction', { id, data }),
  deleteTransaction: (id: number) => invokeWithTimeout('delete-transaction', id),
  getTransactionStats: (options: any) => invokeWithTimeout('get-transaction-stats', options),
  calculateForecast: (data: any) => invokeWithTimeout('calculate-forecast', data),

  // Categories
  getCategories: () => invokeWithTimeout('get-categories'),
  isCategoryInUse: (name: string) => invokeWithTimeout('is-category-in-use', name),
  addCategory: (data: any) => invokeWithTimeout('add-category', data),
  updateCategory: (id: number, data: any) => invokeWithTimeout('update-category', { id, data }),
  deleteCategory: (id: number) => invokeWithTimeout('delete-category', id),
  archiveCategory: (id: number) => invokeWithTimeout('archive-category', id),
  unarchiveCategory: (id: number) => invokeWithTimeout('unarchive-category', id),

  // Accounts
  getAccounts: () => invokeWithTimeout('get-accounts'),
  addAccount: (data: any) => invokeWithTimeout('add-account', data),
  updateAccount: (data: any) => invokeWithTimeout('update-account', data),
  deleteAccount: (id: number) => invokeWithTimeout('delete-account', id),
  archiveAccount: (id: number) => invokeWithTimeout('archive-account', id),
  unarchiveAccount: (id: number) => invokeWithTimeout('unarchive-account', id),
  isAccountInUse: (id: number) => invokeWithTimeout('is-account-in-use', id),

  // Settings
  getSettings: () => invokeWithTimeout('get-settings'),
  updateSetting: (data: any) => invokeWithTimeout('update-setting', data),
  saveSettings: (settings: any) => invokeWithTimeout('save-settings', settings),

  // Budgets
  getBudgets: () => invokeWithTimeout('get-budgets'),
  setBudget: (
    category: string,
    amount: number,
    period: string,
    startDate: string,
    endDate: string
  ) => invokeWithTimeout('set-budget', { category, amount, period, startDate, endDate }),
  getBudgetSummary: () => invokeWithTimeout('get-budget-summary'),
  updateBudget: (
    id: number,
    category: string,
    amount: number,
    period: string,
    startDate: string,
    endDate: string
  ) => invokeWithTimeout('update-budget', { id, category, amount, period, startDate, endDate }),
  deleteBudget: (id: number) => invokeWithTimeout('delete-budget', id),

  // Goals
  getGoals: () => invokeWithTimeout('get-goals'),
  getActiveGoals: () => invokeWithTimeout('get-active-goals'),
  getGoal: (id: number) => invokeWithTimeout('get-goal', id),
  createGoal: (data: any) => invokeWithTimeout('create-goal', data),
  updateGoal: (id: number, data: any) => invokeWithTimeout('update-goal', { id, data }),
  deleteGoal: (id: number) => invokeWithTimeout('delete-goal', id),
  contributeToGoal: (goalId: number, amount: number, source: string, notes: string) =>
    invokeWithTimeout('contribute-to-goal', { goalId, amount, source, notes }),
  getGoalContributions: (goalId: number) => invokeWithTimeout('get-goal-contributions', goalId),
  getGoalsSummary: () => invokeWithTimeout('get-goals-summary'),

  // Recurring Charges
  getRecurringCharges: () => invokeWithTimeout('get-recurring-charges'),
  getActiveRecurringCharges: () => invokeWithTimeout('get-active-recurring-charges'),
  createRecurringCharge: (data: any) => invokeWithTimeout('create-recurring-charge', data),
  updateRecurringCharge: (id: number, data: any) =>
    invokeWithTimeout('update-recurring-charge', { id, data }),
  deleteRecurringCharge: (id: number) => invokeWithTimeout('delete-recurring-charge', id),
  getMonthlyRecurringTotal: () => invokeWithTimeout('get-monthly-recurring-total'),

  // Financial Summary
  getAvailableForGoals: () => invokeWithTimeout('get-available-for-goals'),

  // Data Export/Import
  exportData: () => invokeWithTimeout('export-data'),
  importData: () => invokeWithTimeout('import-data'),
  exportExcel: () => invokeWithTimeout('export-excel'),

  // Auto-Backup
  pickBackupDirectory: () => invokeWithTimeout('pick-backup-directory'),
  runBackupNow: () => invokeWithTimeout('run-backup-now'),

  // AI
  getAISettings: () => invokeWithTimeout('get-ai-settings'),
  getAIDefaults: () => invokeWithTimeout('get-ai-defaults'),
  saveAISettings: (settings: any) => invokeWithTimeout('save-ai-settings', settings),
  getAIModels: (url: string) => invokeWithTimeout('get-ai-models', url),
  getOllamaModels: (url: string) => invokeWithTimeout('get-ai-models', url), // Alias for compatibility
  checkAIConnection: () => invokeWithTimeout('check-ai-connection'),
  getAIHealth: () => invokeWithTimeout('get-ai-health'),
  parseTransactionAI: (text: string) => invokeWithTimeout('parse-transaction-ai', text),
  getAIInsight: (summary: any) => invokeWithTimeout('get-ai-insight', summary),
  chatSandbox: (text: string, context: any) =>
    invokeWithTimeout('chat-sandbox', { text, context }),
  onChatSandboxChunk: (callback: (chunk: any) => void) => {
    ipcRenderer.on('chat-sandbox-chunk', (_event: IpcRendererEvent, chunk: any) => callback(chunk));
  },

  // Bills
  getBillTypes: () => invokeWithTimeout('get-bill-types'),
  addBillType: (data: any) => invokeWithTimeout('add-bill-type', data),
  updateBillType: (data: any) => invokeWithTimeout('update-bill-type', data),
  deleteBillType: (id: number) => invokeWithTimeout('delete-bill-type', id),
  getBillReadings: (filters: any) => invokeWithTimeout('get-bill-readings', filters),
  getBillReadingsPaginated: (options: any) =>
    invokeWithTimeout('get-bill-readings-paginated', options),
  addBillReading: (data: any) => invokeWithTimeout('add-bill-reading', data),
  updateBillReading: (id: number, data: any) =>
    invokeWithTimeout('update-bill-reading', { id, data }),
  deleteBillReading: (id: number) => invokeWithTimeout('delete-bill-reading', id),
  getBillProjections: (months?: number) => invokeWithTimeout('get-bill-projections', months),

  // Exchange Rates
  getExchangeRates: () => invokeWithTimeout('get-exchange-rates'),
  getExchangeRate: (from: string, to: string) =>
    invokeWithTimeout('get-exchange-rate', { from, to }),
  setExchangeRate: (data: { from: string; to: string; rate: number; source?: string }) =>
    invokeWithTimeout('set-exchange-rate', data),
  deleteExchangeRate: (id: number) => invokeWithTimeout('delete-exchange-rate', id),
  convertCurrency: (amount: number, from: string, to: string) =>
    invokeWithTimeout('convert-currency', { amount, from, to }),
  getUsedCurrencies: () => invokeWithTimeout('get-used-currencies'),
  getAccountsConverted: (baseCurrency: string) =>
    invokeWithTimeout('get-accounts-converted', baseCurrency),
  getRateSyncStatus: () => invokeWithTimeout('get-rate-sync-status'),
  getTotalBalance: (baseCurrency: string) => invokeWithTimeout('get-total-balance', baseCurrency),
  syncExchangeRates: (data: { provider: string; baseCurrency: string; customUrl?: string }) =>
    invokeWithTimeout('sync-exchange-rates', data),
  testCurrencyAPI: (data: { provider: string; baseCurrency?: string; customUrl?: string }) =>
    invokeWithTimeout('test-currency-api', data),
  getCurrencyProviders: () => invokeWithTimeout('get-currency-providers'),

  // Remote Access
  getHostInfo: () => invokeWithTimeout('get-host-info'),
  restartWebServer: () => ipcRenderer.send('restart-web-server'),

  // Analytics
  getSummaryStats: () => invokeWithTimeout('get-summary-stats'),
  getDashboardData: (months?: number) => invokeWithTimeout('get-dashboard-data', months),
  getCategorySpending: (startDate: string, endDate: string) =>
    invokeWithTimeout('get-category-spending', { startDate, endDate }),
  onNativeThemeChanged: (callback: (isDark: boolean) => void) => {
    ipcRenderer.on('native-theme-changed', (_event, isDark: boolean) => callback(isDark));
  },

  // Audit
  getAuditLogs: (options: any) => invokeWithTimeout('get-audit-logs', options),

  // Anomaly Detection
  detectAnomalies: (data: { transaction: any }) => invokeWithTimeout('detect-anomalies', data),
  getCategoryStats: () => invokeWithTimeout('get-category-stats'),

  version: '1.1.1',
});
