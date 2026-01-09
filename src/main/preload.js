const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Transactions
    getTransactions: () => ipcRenderer.invoke('get-transactions'),
    addTransaction: (data) => ipcRenderer.invoke('add-transaction', data),
    updateTransaction: (id, data) => ipcRenderer.invoke('update-transaction', { id, data }),
    deleteTransaction: (id) => ipcRenderer.invoke('delete-transaction', id),
    calculateForecast: (data) => ipcRenderer.invoke('calculate-forecast', data),

    // Categories
    getCategories: () => ipcRenderer.invoke('get-categories'),
    isCategoryInUse: (name) => ipcRenderer.invoke('is-category-in-use', name),
    addCategory: (data) => ipcRenderer.invoke('add-category', data),
    updateCategory: (id, data) => ipcRenderer.invoke('update-category', { id, data }),
    deleteCategory: (id) => ipcRenderer.invoke('delete-category', id),
    archiveCategory: (id) => ipcRenderer.invoke('archive-category', id),
    unarchiveCategory: (id) => ipcRenderer.invoke('unarchive-category', id),

    // Accounts
    getAccounts: () => ipcRenderer.invoke('get-accounts'),
    addAccount: (data) => ipcRenderer.invoke('add-account', data),
    updateAccount: (data) => ipcRenderer.invoke('update-account', data),
    deleteAccount: (id) => ipcRenderer.invoke('delete-account', id),
    archiveAccount: (id) => ipcRenderer.invoke('archive-account', id),
    unarchiveAccount: (id) => ipcRenderer.invoke('unarchive-account', id),
    isAccountInUse: (id) => ipcRenderer.invoke('is-account-in-use', id),

    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    updateSetting: (data) => ipcRenderer.invoke('update-setting', data),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

    // Budgets
    getBudgets: () => ipcRenderer.invoke('get-budgets'),
    setBudget: (category, amount, period, startDate, endDate) =>
        ipcRenderer.invoke('set-budget', { category, amount, period, startDate, endDate }),
    updateBudget: (id, category, amount, period, startDate, endDate) =>
        ipcRenderer.invoke('update-budget', { id, category, amount, period, startDate, endDate }),
    deleteBudget: (id) => ipcRenderer.invoke('delete-budget', id),

    // Goals
    getGoals: () => ipcRenderer.invoke('get-goals'),
    getActiveGoals: () => ipcRenderer.invoke('get-active-goals'),
    getGoal: (id) => ipcRenderer.invoke('get-goal', id),
    createGoal: (data) => ipcRenderer.invoke('create-goal', data),
    updateGoal: (id, data) => ipcRenderer.invoke('update-goal', { id, data }),
    deleteGoal: (id) => ipcRenderer.invoke('delete-goal', id),
    contributeToGoal: (goalId, amount, source, notes) =>
        ipcRenderer.invoke('contribute-to-goal', { goalId, amount, source, notes }),
    getGoalContributions: (goalId) => ipcRenderer.invoke('get-goal-contributions', goalId),
    getGoalsSummary: () => ipcRenderer.invoke('get-goals-summary'),

    // Recurring Charges
    getRecurringCharges: () => ipcRenderer.invoke('get-recurring-charges'),
    getActiveRecurringCharges: () => ipcRenderer.invoke('get-active-recurring-charges'),
    createRecurringCharge: (data) => ipcRenderer.invoke('create-recurring-charge', data),
    updateRecurringCharge: (id, data) => ipcRenderer.invoke('update-recurring-charge', { id, data }),
    deleteRecurringCharge: (id) => ipcRenderer.invoke('delete-recurring-charge', id),
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
    saveAISettings: (settings) => ipcRenderer.invoke('save-ai-settings', settings),
    getAIModels: (url) => ipcRenderer.invoke('get-ai-models', url),
    checkAIConnection: () => ipcRenderer.invoke('check-ai-connection'),
    parseTransactionAI: (text) => ipcRenderer.invoke('parse-transaction-ai', text),
    getAIInsight: (summary) => ipcRenderer.invoke('get-ai-insight', summary),
    chatSandbox: (text, context) => ipcRenderer.invoke('chat-sandbox', { text, context }),
    onChatSandboxChunk: (callback) => { ipcRenderer.on('chat-sandbox-chunk', (event, chunk) => callback(chunk)); },

    // Bills
    getBillTypes: () => ipcRenderer.invoke('get-bill-types'),
    addBillType: (data) => ipcRenderer.invoke('add-bill-type', data),
    updateBillType: (data) => ipcRenderer.invoke('update-bill-type', data),
    deleteBillType: (id) => ipcRenderer.invoke('delete-bill-type', id),
    getBillReadings: (filters) => ipcRenderer.invoke('get-bill-readings', filters),
    addBillReading: (data) => ipcRenderer.invoke('add-bill-reading', data),
    updateBillReading: (id, data) => ipcRenderer.invoke('update-bill-reading', { id, data }),
    deleteBillReading: (id) => ipcRenderer.invoke('delete-bill-reading', id),
    getBillProjections: (months) => ipcRenderer.invoke('get-bill-projections', months),

    // Exchange Rates
    getExchangeRates: () => ipcRenderer.invoke('get-exchange-rates'),
    getExchangeRate: (from, to) => ipcRenderer.invoke('get-exchange-rate', { from, to }),
    setExchangeRate: (from, to, rate, source) => ipcRenderer.invoke('set-exchange-rate', { from, to, rate, source }),
    deleteExchangeRate: (id) => ipcRenderer.invoke('delete-exchange-rate', id),
    convertCurrency: (amount, from, to) => ipcRenderer.invoke('convert-currency', { amount, from, to }),
    getUsedCurrencies: () => ipcRenderer.invoke('get-used-currencies'),
    getAccountsConverted: (baseCurrency) => ipcRenderer.invoke('get-accounts-converted', baseCurrency),
    syncExchangeRates: (provider, baseCurrency, customUrl) =>
        ipcRenderer.invoke('sync-exchange-rates', { provider, baseCurrency, customUrl }),
    testCurrencyAPI: (provider, baseCurrency, customUrl) =>
        ipcRenderer.invoke('test-currency-api', { provider, baseCurrency, customUrl }),
    getCurrencyProviders: () => ipcRenderer.invoke('get-currency-providers'),
});
