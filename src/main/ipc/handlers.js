/**
 * IPC Handlers - Streamlined with Generic CRUD Pattern
 * 
 * This module registers all IPC handlers for the Electron main process.
 * Uses a routing table pattern to reduce code duplication.
 */

const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const FinanceModel = require('../../models/finance');

// =============================================================================
// AI SERVICE (Lazy Loaded)
// =============================================================================

let aiService = null;
function getAIService() {
    if (!aiService) aiService = require('../../services/aiService');
    return aiService;
}

async function syncAIService() {
    const ai = getAIService();
    const settings = await FinanceModel.getAISettings();
    ai.baseUrl = settings.url;
    ai.model = settings.model;
    ai.promptTx = settings.promptTx;
    ai.promptInsight = settings.promptInsight;
    ai.promptChat = settings.promptChat;
    return settings;
}

// =============================================================================
// HANDLER ROUTE TABLE - Maps IPC channels to model methods
// =============================================================================

const SIMPLE_ROUTES = {
    // Transactions (using generic CRUD)
    'get-transactions': () => FinanceModel.getAll('transaction', { orderBy: 'start_date DESC' }),
    'add-transaction': (_, data) => FinanceModel.create('transaction', data),
    'update-transaction': (_, { id, data }) => FinanceModel.update('transaction', id, data),
    'delete-transaction': async (_, id) => {
        const tx = await FinanceModel.getById('transaction', id);
        const result = await FinanceModel.delete('transaction', id, true);
        // Sync balances after delete (triggers handle insert/update)
        if (tx) {
            if (tx.account_id) await FinanceModel.syncAccountBalance(tx.account_id);
            if (tx.to_account_id) await FinanceModel.syncAccountBalance(tx.to_account_id);
        }
        return result;
    },
    'get-transactions-paginated': (_, options) => FinanceModel.getTransactionsPaginated(options),
    'get-transaction-count': (_, options) => FinanceModel.getTransactionCount(options),

    // Accounts (using generic CRUD)
    'get-accounts': () => FinanceModel.getAll('account'),
    'add-account': (_, data) => FinanceModel.create('account', { ...data, initial_balance: data.balance || 0 }),
    'update-account': (_, data) => FinanceModel.update('account', data.id, data),
    'delete-account': (_, id) => FinanceModel.delete('account', id),
    'archive-account': (_, id) => FinanceModel.archive('account', id),
    'unarchive-account': (_, id) => FinanceModel.unarchive('account', id),
    'is-account-in-use': async (_, id) => {
        const row = await FinanceModel.getById('account', id);
        if (!row) return false;
        const result = await FinanceModel.getAll('transaction', { where: { account_id: id } });
        return result.length > 0;
    },

    // Categories (using generic CRUD)
    'get-categories': () => FinanceModel.getAll('category'),
    'add-category': (_, { type, name }) => FinanceModel.create('category', { type, name }),
    'update-category': (_, { id, data }) => FinanceModel.update('category', id, data),
    'delete-category': (_, id) => FinanceModel.delete('category', id),
    'archive-category': (_, id) => FinanceModel.archive('category', id),
    'unarchive-category': (_, id) => FinanceModel.unarchive('category', id),
    'is-category-in-use': (_, name) => FinanceModel.isCategoryInUse(name),

    // Settings
    'get-settings': () => FinanceModel.getAllSettings(),
    'update-setting': (_, { key, value }) => FinanceModel.updateSetting(key, value),
    'save-settings': (_, settings) => FinanceModel.saveSettings(settings),

    // Budgets (using generic CRUD)
    'get-budgets': () => FinanceModel.getAll('budget'),
    'set-budget': (_, { category, amount, period, startDate, endDate }) =>
        FinanceModel.create('budget', { category, amount, period, start_date: startDate, end_date: endDate }),
    'update-budget': (_, { id, category, amount, period, startDate, endDate }) =>
        FinanceModel.update('budget', id, { category, amount, period, start_date: startDate, end_date: endDate }),
    'delete-budget': (_, id) => FinanceModel.delete('budget', id, true),

    // Goals (using generic CRUD + specialized methods)
    'get-goals': () => FinanceModel.getAll('goal'),
    'get-active-goals': () => FinanceModel.getAll('goal', { where: { status: 'active' } }),
    'get-goal': (_, id) => FinanceModel.getById('goal', id),
    'create-goal': (_, data) => FinanceModel.create('goal', data),
    'update-goal': async (_, { id, data }) => {
        // Auto-complete if target reached
        if (data.current_amount !== undefined && data.target_amount !== undefined) {
            if (data.current_amount >= data.target_amount && data.status !== 'completed') {
                data.status = 'completed';
                data.completed_at = new Date().toISOString();
            }
        }
        return await FinanceModel.update('goal', id, data);
    },
    'delete-goal': (_, id) => FinanceModel.deleteGoal(id),
    'contribute-to-goal': (_, { goalId, amount, source, notes }) =>
        FinanceModel.contributeToGoal(goalId, amount, source, notes),
    'get-goal-contributions': (_, goalId) => FinanceModel.getGoalContributions(goalId),
    'get-goals-summary': () => FinanceModel.getGoalsSummary(),
    'get-available-for-goals': () => FinanceModel.getAvailableForGoals(),

    // Recurring Charges (using generic CRUD)
    'get-recurring-charges': () => FinanceModel.getAll('recurringCharge'),
    'get-active-recurring-charges': () => FinanceModel.getAll('recurringCharge', { where: { is_active: 1 } }),
    'create-recurring-charge': (_, data) => FinanceModel.create('recurringCharge', data),
    'update-recurring-charge': (_, { id, data }) => FinanceModel.update('recurringCharge', id, data),
    'delete-recurring-charge': (_, id) => FinanceModel.delete('recurringCharge', id, true),
    'get-monthly-recurring-total': () => FinanceModel.getMonthlyRecurringTotal(),

    // Bills (using generic CRUD)
    'get-bill-types': () => FinanceModel.getBillTypes(),
    'add-bill-type': (_, data) => FinanceModel.create('billType', data),
    'update-bill-type': (_, { id, data }) => FinanceModel.update('billType', id, data),
    'delete-bill-type': (_, id) => FinanceModel.delete('billType', id, true),
    'get-bill-readings': (_, filters) => FinanceModel.getBillReadings(filters),
    'get-bill-readings-paginated': (_, options) => FinanceModel.getBillReadingsPaginated(options),
    'add-bill-reading': (_, data) => FinanceModel.create('billReading', data),
    'update-bill-reading': (_, { id, data }) => FinanceModel.update('billReading', id, data),
    'delete-bill-reading': (_, id) => FinanceModel.delete('billReading', id, true),
    'get-bill-projections': () => FinanceModel.getBillProjections(),

    // Exchange Rates (using generic CRUD where applicable)
    'get-exchange-rates': () => FinanceModel.getExchangeRates(),
    'get-exchange-rate': (_, { from, to }) => FinanceModel.getExchangeRate(from, to),
    'set-exchange-rate': (_, { from, to, rate, source }) =>
        FinanceModel.setExchangeRate(from, to, rate, source || 'manual'),
    'delete-exchange-rate': (_, id) => FinanceModel.delete('exchangeRate', id, true),
    'convert-currency': (_, { amount, from, to }) => FinanceModel.convertCurrency(amount, from, to),
    'get-used-currencies': () => FinanceModel.getUsedCurrencies(),
    'get-accounts-converted': (_, baseCurrency) => FinanceModel.getAccountsWithConvertedBalances(baseCurrency),
};

// =============================================================================
// REGISTER HANDLERS
// =============================================================================

function registerIpcHandlers() {
    // Register all simple routes
    for (const [channel, handler] of Object.entries(SIMPLE_ROUTES)) {
        ipcMain.handle(channel, async (event, data) => {
            try {
                return await handler(event, data);
            } catch (error) {
                console.error(`[IPC] ${channel} error:`, error.message);
                throw error;
            }
        });
    }

    // ==========================================================================
    // COMPLEX HANDLERS (require special logic)
    // ==========================================================================

    // Export Data (with dialog)
    ipcMain.handle('export-data', async () => {
        try {
            const data = await FinanceModel.exportData();
            const { filePath } = await dialog.showSaveDialog({
                buttonLabel: 'Export Data',
                defaultPath: `bofo-export-${new Date().toISOString().split('T')[0]}.json`,
                filters: [{ name: 'JSON', extensions: ['json'] }]
            });
            if (filePath) {
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                return true;
            }
            return false;
        } catch (err) {
            console.error('Export error:', err);
            return false;
        }
    });

    // Import Data (with dialog)
    ipcMain.handle('import-data', async () => {
        const { filePaths, canceled } = await dialog.showOpenDialog({
            title: 'Import Backup',
            buttonLabel: 'Import',
            filters: [{ name: 'JSON Backup', extensions: ['json'] }],
            properties: ['openFile']
        });

        if (canceled || !filePaths?.length) {
            return { success: false, message: 'Import cancelled' };
        }

        try {
            const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
            if (!data.accounts && !data.transactions) {
                return { success: false, message: 'Invalid backup file format' };
            }
            await FinanceModel.importData(data);
            return { success: true, message: 'Data imported successfully!' };
        } catch (err) {
            console.error('Import error:', err);
            return { success: false, message: `Import failed: ${err.message}` };
        }
    });

    // Export Excel
    ipcMain.handle('export-excel', async () => {
        try {
            const workbook = XLSX.utils.book_new();
            const addSheet = (data, name, headers) => {
                const sheetData = data?.length
                    ? data.map(row => headers.map(h => row[h] ?? ''))
                    : [];
                const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetData]);
                XLSX.utils.book_append_sheet(workbook, ws, name);
            };

            addSheet(await FinanceModel.getAllAccounts(), 'Accounts',
                ['id', 'name', 'type', 'balance', 'initial_balance', 'currency', 'status']);
            addSheet(await FinanceModel.getAllTransactions(), 'Transactions',
                ['id', 'start_date', 'type', 'category', 'amount', 'currency', 'account_id', 'to_account_id', 'description', 'frequency', 'is_active']);
            addSheet(await FinanceModel.getAllCategories(), 'Categories',
                ['id', 'type', 'name', 'status', 'is_default', 'color', 'icon']);
            addSheet(await FinanceModel.getAllBudgets(), 'Budgets',
                ['id', 'category', 'amount', 'period', 'start_date', 'end_date', 'created_at']);
            addSheet(await FinanceModel.getAllGoals(), 'Goals',
                ['id', 'name', 'description', 'target_amount', 'current_amount', 'monthly_contribution', 'target_date', 'status', 'priority']);
            addSheet(await FinanceModel.getAllRecurringCharges(), 'Recurring Charges',
                ['id', 'category', 'name', 'amount', 'frequency', 'due_day', 'next_due_date', 'is_active', 'notes']);
            addSheet(await FinanceModel.getBillTypes(), 'Bill Types',
                ['id', 'name', 'unit_name', 'cost_per_unit', 'category_name', 'account_id', 'auto_transaction']);
            addSheet(await FinanceModel.getBillReadings({}), 'Bill Readings',
                ['id', 'bill_type_id', 'date', 'units_used', 'total_cost', 'notes']);

            const { filePath, canceled } = await dialog.showSaveDialog({
                buttonLabel: 'Export Excel',
                defaultPath: `bofo-export-${new Date().toISOString().split('T')[0]}.xlsx`,
                filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
            });

            if (canceled || !filePath) return false;
            XLSX.writeFile(workbook, filePath);
            return true;
        } catch (err) {
            console.error('Excel export error:', err);
            return false;
        }
    });

    // ==========================================================================
    // AI HANDLERS
    // ==========================================================================

    ipcMain.handle('get-ai-settings', async () => {
        try { return await syncAIService(); }
        catch (e) { return { enabled: false, url: 'http://127.0.0.1:11434', model: 'gemma3:4b' }; }
    });

    ipcMain.handle('get-ai-defaults', async () => {
        try { return getAIService().DEFAULTS || {}; }
        catch (e) { return {}; }
    });

    ipcMain.handle('save-ai-settings', async (_, settings) => {
        try {
            await FinanceModel.saveAISettings(settings);
            await syncAIService();
            return true;
        } catch (e) { return false; }
    });

    ipcMain.handle('get-ai-models', async (_, url) => {
        try {
            const ai = getAIService();
            if (url) ai.baseUrl = url;
            return await ai.getInstalledModels();
        } catch (e) { return []; }
    });

    ipcMain.handle('check-ai-connection', async () => {
        try { return await getAIService().checkConnection(); }
        catch (e) { return false; }
    });

    ipcMain.handle('parse-transaction-ai', async (_, { text, categories, accounts }) => {
        try { return await getAIService().parseTransactionFromText(text, categories || [], accounts || []); }
        catch (e) { return null; }
    });

    ipcMain.handle('get-ai-insight', async (_, summary) => {
        try { return await getAIService().getFinancialInsight(summary); }
        catch (e) { return "Keep tracking your spending to stay on top of your goals!"; }
    });

    ipcMain.handle('chat-sandbox', async (event, { text, context }) => {
        try {
            return await getAIService().chatSandbox(text, context, null, (chunk) => {
                event.sender.send('chat-sandbox-chunk', chunk);
            });
        } catch (e) { return "I'm having trouble connecting to the AI engine."; }
    });

    // ==========================================================================
    // FORECAST HANDLER
    // ==========================================================================

    ipcMain.handle('calculate-forecast', async (_, data) => {
        try {
            const ForecastEngine = require('../../utils/forecast');
            const engine = new ForecastEngine(
                data.transactions || [],
                data.accounts || [],
                data.settings || {}
            );
            return engine.generateForecast(data.months || 6);
        } catch (e) {
            console.error('Forecast error:', e);
            return { timeline: [], summary: {}, insights: [] };
        }
    });

    // ==========================================================================
    // CURRENCY SYNC HANDLER
    // ==========================================================================

    ipcMain.handle('sync-exchange-rates', async (_, { provider, baseCurrency, customUrl }) => {
        try {
            const CurrencyService = require('../../services/currencyService');
            const rates = await CurrencyService.fetchRates(provider, baseCurrency, customUrl);
            const usedCurrencies = await FinanceModel.getUsedCurrencies();
            usedCurrencies.push(baseCurrency);
            const relevantRates = CurrencyService.filterRelevantRates(rates, usedCurrencies);
            await FinanceModel.setExchangeRatesBulk(relevantRates, 'api');
            await FinanceModel.updateSetting('currency_last_sync', new Date().toISOString());
            return { success: true, message: `Synced ${relevantRates.length} exchange rates`, ratesUpdated: relevantRates.length };
        } catch (err) {
            return { success: false, message: err.message };
        }
    });

    ipcMain.handle('test-currency-api', async (_, { provider, baseCurrency, customUrl }) => {
        try {
            const CurrencyService = require('../../services/currencyService');
            return await CurrencyService.testConnection(provider, baseCurrency, customUrl);
        } catch (err) {
            return { success: false, message: err.message };
        }
    });

    ipcMain.handle('get-currency-providers', async () => {
        return require('../../services/currencyService').getProviders();
    });

    // ==========================================================================
    // BACKUP HANDLERS
    // ==========================================================================

    ipcMain.handle('pick-backup-directory', async () => {
        const { filePaths, canceled } = await dialog.showOpenDialog({
            title: 'Select Backup Directory',
            properties: ['openDirectory', 'createDirectory']
        });
        return canceled || !filePaths?.length ? null : filePaths[0];
    });

    ipcMain.handle('run-backup-now', async () => {
        try {
            const settings = await FinanceModel.getAllSettings();
            const backupDir = settings.auto_backup_directory;

            if (!backupDir) return { success: false, message: 'No backup directory configured' };
            if (!fs.existsSync(backupDir)) return { success: false, message: 'Backup directory does not exist' };

            const data = await FinanceModel.exportData();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const filename = `bofo-backup-${timestamp}.json`;
            fs.writeFileSync(path.join(backupDir, filename), JSON.stringify(data, null, 2));
            await FinanceModel.updateSetting('auto_backup_last', new Date().toISOString());

            return { success: true, message: `Backup saved to ${filename}` };
        } catch (err) {
            return { success: false, message: err.message };
        }
    });
}

// =============================================================================
// AUTO-BACKUP ON APP CLOSE
// =============================================================================

async function performAutoBackup() {
    try {
        const settings = await FinanceModel.getAllSettings();
        if (settings.auto_backup_enabled !== 'true' || !settings.auto_backup_directory) return;

        const backupDir = settings.auto_backup_directory;
        if (!fs.existsSync(backupDir)) return;

        // Check if already backed up today
        const lastBackup = settings.auto_backup_last;
        if (lastBackup && new Date(lastBackup).toDateString() === new Date().toDateString()) return;

        const data = await FinanceModel.exportData();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const filepath = path.join(backupDir, `bofo-backup-${timestamp}.json`);
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        await FinanceModel.updateSetting('auto_backup_last', new Date().toISOString());

        console.log('Auto-backup completed:', filepath);
    } catch (err) {
        console.error('Auto-backup failed:', err);
    }
}

module.exports = { registerIpcHandlers, performAutoBackup };
