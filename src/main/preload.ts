import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Transactions
  getTransactions: () => ipcRenderer.invoke('get-transactions'),
  getTransactionsPaginated: (options: any) =>
    ipcRenderer.invoke('get-transactions-paginated', options),
  getTransactionCount: (options: any) => ipcRenderer.invoke('get-transaction-count', options),
  addTransaction: (data: any) => ipcRenderer.invoke('add-transaction', data),
  updateTransaction: (id: number, data: any) =>
    ipcRenderer.invoke('update-transaction', { id, data }),
  deleteTransaction: (id: number) => ipcRenderer.invoke('delete-transaction', id),
  calculateForecast: (data: any) => ipcRenderer.invoke('calculate-forecast', data),

  // Categories
  getCategories: () => ipcRenderer.invoke('get-categories'),
  isCategoryInUse: (name: string) => ipcRenderer.invoke('is-category-in-use', name),
  addCategory: (data: any) => ipcRenderer.invoke('add-category', data),
  updateCategory: (id: number, data: any) => ipcRenderer.invoke('update-category', { id, data }),
  deleteCategory: (id: number) => ipcRenderer.invoke('delete-category', id),
  archiveCategory: (id: number) => ipcRenderer.invoke('archive-category', id),
  unarchiveCategory: (id: number) => ipcRenderer.invoke('unarchive-category', id),

  // Accounts
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  addAccount: (data: any) => ipcRenderer.invoke('add-account', data),
  updateAccount: (data: any) => ipcRenderer.invoke('update-account', data),
  deleteAccount: (id: number) => ipcRenderer.invoke('delete-account', id),
  archiveAccount: (id: number) => ipcRenderer.invoke('archive-account', id),
  unarchiveAccount: (id: number) => ipcRenderer.invoke('unarchive-account', id),
  isAccountInUse: (id: number) => ipcRenderer.invoke('is-account-in-use', id),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSetting: (data: any) => ipcRenderer.invoke('update-setting', data),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),

  // Budgets
  getBudgets: () => ipcRenderer.invoke('get-budgets'),
  setBudget: (
    category: string,
    amount: number,
    period: string,
    startDate: string,
    endDate: string
  ) => ipcRenderer.invoke('set-budget', { category, amount, period, startDate, endDate }),
  updateBudget: (
    id: number,
    category: string,
    amount: number,
    period: string,
    startDate: string,
    endDate: string
  ) => ipcRenderer.invoke('update-budget', { id, category, amount, period, startDate, endDate }),
  deleteBudget: (id: number) => ipcRenderer.invoke('delete-budget', id),

  // Goals
  getGoals: () => ipcRenderer.invoke('get-goals'),
  getActiveGoals: () => ipcRenderer.invoke('get-active-goals'),
  getGoal: (id: number) => ipcRenderer.invoke('get-goal', id),
  createGoal: (data: any) => ipcRenderer.invoke('create-goal', data),
  updateGoal: (id: number, data: any) => ipcRenderer.invoke('update-goal', { id, data }),
  deleteGoal: (id: number) => ipcRenderer.invoke('delete-goal', id),
  contributeToGoal: (goalId: number, amount: number, source: string, notes: string) =>
    ipcRenderer.invoke('contribute-to-goal', { goalId, amount, source, notes }),
  getGoalContributions: (goalId: number) => ipcRenderer.invoke('get-goal-contributions', goalId),
  getGoalsSummary: () => ipcRenderer.invoke('get-goals-summary'),

  // Recurring Charges
  getRecurringCharges: () => ipcRenderer.invoke('get-recurring-charges'),
  getActiveRecurringCharges: () => ipcRenderer.invoke('get-active-recurring-charges'),
  createRecurringCharge: (data: any) => ipcRenderer.invoke('create-recurring-charge', data),
  updateRecurringCharge: (id: number, data: any) =>
    ipcRenderer.invoke('update-recurring-charge', { id, data }),
  deleteRecurringCharge: (id: number) => ipcRenderer.invoke('delete-recurring-charge', id),
  getMonthlyRecurringTotal: () => ipcRenderer.invoke('get-monthly-recurring-total'),

  // Financial Summary
  getAvailableForGoals: () => ipcRenderer.invoke('get-available-for-goals'),

  // Data Export/Import
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: () => ipcRenderer.invoke('import-data'),
  exportExcel: () => ipcRenderer.invoke('export-excel'),

  // Auto-Backup
  pickBackupDirectory: () => ipcRenderer.invoke('pick-backup-directory'),
  runBackupNow: () => ipcRenderer.invoke('run-backup-now'),

  // AI
  getAISettings: () => ipcRenderer.invoke('get-ai-settings'),
  getAIDefaults: () => ipcRenderer.invoke('get-ai-defaults'),
  saveAISettings: (settings: any) => ipcRenderer.invoke('save-ai-settings', settings),
  getAIModels: (url: string) => ipcRenderer.invoke('get-ai-models', url),
  getOllamaModels: (url: string) => ipcRenderer.invoke('get-ai-models', url), // Alias for compatibility
  checkAIConnection: () => ipcRenderer.invoke('check-ai-connection'),
  getAIHealth: () => ipcRenderer.invoke('get-ai-health'),
  parseTransactionAI: (text: string) => ipcRenderer.invoke('parse-transaction-ai', text),
  getAIInsight: (summary: any) => ipcRenderer.invoke('get-ai-insight', summary),
  chatSandbox: (text: string, context: any) =>
    ipcRenderer.invoke('chat-sandbox', { text, context }),
  onChatSandboxChunk: (callback: (chunk: any) => void) => {
    ipcRenderer.on('chat-sandbox-chunk', (_event: IpcRendererEvent, chunk: any) => callback(chunk));
  },

  // Bills
  getBillTypes: () => ipcRenderer.invoke('get-bill-types'),
  addBillType: (data: any) => ipcRenderer.invoke('add-bill-type', data),
  updateBillType: (data: any) => ipcRenderer.invoke('update-bill-type', data),
  deleteBillType: (id: number) => ipcRenderer.invoke('delete-bill-type', id),
  getBillReadings: (filters: any) => ipcRenderer.invoke('get-bill-readings', filters),
  getBillReadingsPaginated: (options: any) =>
    ipcRenderer.invoke('get-bill-readings-paginated', options),
  addBillReading: (data: any) => ipcRenderer.invoke('add-bill-reading', data),
  updateBillReading: (id: number, data: any) =>
    ipcRenderer.invoke('update-bill-reading', { id, data }),
  deleteBillReading: (id: number) => ipcRenderer.invoke('delete-bill-reading', id),
  getBillProjections: (months?: number) => ipcRenderer.invoke('get-bill-projections', months),

  // Exchange Rates
  getExchangeRates: () => ipcRenderer.invoke('get-exchange-rates'),
  getExchangeRate: (from: string, to: string) =>
    ipcRenderer.invoke('get-exchange-rate', { from, to }),
  setExchangeRate: (data: { from: string; to: string; rate: number; source?: string }) =>
    ipcRenderer.invoke('set-exchange-rate', data),
  deleteExchangeRate: (id: number) => ipcRenderer.invoke('delete-exchange-rate', id),
  convertCurrency: (amount: number, from: string, to: string) =>
    ipcRenderer.invoke('convert-currency', { amount, from, to }),
  getUsedCurrencies: () => ipcRenderer.invoke('get-used-currencies'),
  getAccountsConverted: (baseCurrency: string) =>
    ipcRenderer.invoke('get-accounts-converted', baseCurrency),
  getRateSyncStatus: () => ipcRenderer.invoke('get-rate-sync-status'),
  getTotalBalance: (baseCurrency: string) => ipcRenderer.invoke('get-total-balance', baseCurrency),
  syncExchangeRates: (data: { provider: string; baseCurrency: string; customUrl?: string }) =>
    ipcRenderer.invoke('sync-exchange-rates', data),
  testCurrencyAPI: (data: { provider: string; baseCurrency?: string; customUrl?: string }) =>
    ipcRenderer.invoke('test-currency-api', data),
  getCurrencyProviders: () => ipcRenderer.invoke('get-currency-providers'),

  // Remote Access
  getHostInfo: () => ipcRenderer.invoke('get-host-info'),
  restartWebServer: () => ipcRenderer.send('restart-web-server'),
  onNativeThemeChanged: (callback: (isDark: boolean) => void) => {
    ipcRenderer.on('native-theme-changed', (_event, isDark: boolean) => callback(isDark));
  },
  version: '1.1.1',
});
