const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const FinanceModel = require('../../models/finance');

// AI Service (lazy loaded)
let aiService = null;
function getAIService() {
    if (!aiService) {
        aiService = require('../../services/aiService');
    }
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

function registerIpcHandlers() {
    // Transaction Handlers
    ipcMain.handle('get-transactions', async () => {
        return await FinanceModel.getAllTransactions();
    });

    ipcMain.handle('add-transaction', async (event, data) => {
        return await FinanceModel.createTransaction(data);
    });

    ipcMain.handle('update-transaction', async (event, { id, data }) => {
        return await FinanceModel.updateTransaction(id, data);
    });

    ipcMain.handle('delete-transaction', async (event, id) => {
        return await FinanceModel.deleteTransaction(id);
    });

    // Category Handlers
    ipcMain.handle('get-categories', async () => {
        return await FinanceModel.getAllCategories();
    });

    ipcMain.handle('add-category', async (event, { type, name }) => {
        return await FinanceModel.addCategory(type, name);
    });

    ipcMain.handle('delete-category', async (event, id) => {
        return await FinanceModel.deleteCategory(id);
    });

    ipcMain.handle('update-category', async (event, { id, data }) => {
        return await FinanceModel.updateCategory(id, data);
    });

    ipcMain.handle('archive-category', async (event, id) => {
        return await FinanceModel.archiveCategory(id);
    });

    ipcMain.handle('unarchive-category', async (event, id) => {
        return await FinanceModel.unarchiveCategory(id);
    });

    ipcMain.handle('is-category-in-use', async (event, name) => {
        return await FinanceModel.isCategoryInUse(name);
    });

    // Account Handlers
    ipcMain.handle('get-accounts', async () => {
        return await FinanceModel.getAllAccounts();
    });

    ipcMain.handle('add-account', async (event, data) => {
        return await FinanceModel.addAccount(data);
    });

    ipcMain.handle('update-account', async (event, data) => {
        return await FinanceModel.updateAccount(data.id, data);
    });

    ipcMain.handle('delete-account', async (event, id) => {
        return await FinanceModel.deleteAccount(id);
    });

    ipcMain.handle('archive-account', async (event, id) => {
        return await FinanceModel.archiveAccount(id);
    });

    ipcMain.handle('unarchive-account', async (event, id) => {
        return await FinanceModel.unarchiveAccount(id);
    });

    ipcMain.handle('is-account-in-use', async (event, id) => {
        return await FinanceModel.isAccountInUse(id);
    });

    // Settings Handlers
    ipcMain.handle('get-settings', async () => {
        return await FinanceModel.getAllSettings();
    });

    ipcMain.handle('update-setting', async (event, { key, value }) => {
        return await FinanceModel.updateSetting(key, value);
    });

    ipcMain.handle('save-settings', async (event, settings) => {
        return await FinanceModel.saveSettings(settings);
    });

    // Budget Handlers
    ipcMain.handle('get-budgets', async () => {
        return await FinanceModel.getAllBudgets();
    });

    ipcMain.handle('set-budget', async (event, { category, amount, period, startDate, endDate }) => {
        return await FinanceModel.setBudget(category, amount, period, startDate, endDate);
    });

    ipcMain.handle('update-budget', async (event, { id, category, amount, period, startDate, endDate }) => {
        return await FinanceModel.updateBudget(id, category, amount, period, startDate, endDate);
    });

    ipcMain.handle('delete-budget', async (event, id) => {
        return await FinanceModel.deleteBudget(id);
    });

    // ==================== GOALS HANDLERS ====================

    ipcMain.handle('get-goals', async () => {
        return await FinanceModel.getAllGoals();
    });

    ipcMain.handle('get-active-goals', async () => {
        return await FinanceModel.getActiveGoals();
    });

    ipcMain.handle('get-goal', async (event, id) => {
        return await FinanceModel.getGoalById(id);
    });

    ipcMain.handle('create-goal', async (event, data) => {
        return await FinanceModel.createGoal(data);
    });

    ipcMain.handle('update-goal', async (event, { id, data }) => {
        return await FinanceModel.updateGoal(id, data);
    });

    ipcMain.handle('delete-goal', async (event, id) => {
        return await FinanceModel.deleteGoal(id);
    });

    ipcMain.handle('contribute-to-goal', async (event, { goalId, amount, source, notes }) => {
        return await FinanceModel.contributeToGoal(goalId, amount, source, notes);
    });

    ipcMain.handle('get-goal-contributions', async (event, goalId) => {
        return await FinanceModel.getGoalContributions(goalId);
    });

    ipcMain.handle('get-goals-summary', async () => {
        return await FinanceModel.getGoalsSummary();
    });

    // ==================== RECURRING CHARGES HANDLERS ====================

    ipcMain.handle('get-recurring-charges', async () => {
        return await FinanceModel.getAllRecurringCharges();
    });

    ipcMain.handle('get-active-recurring-charges', async () => {
        return await FinanceModel.getActiveRecurringCharges();
    });

    ipcMain.handle('create-recurring-charge', async (event, data) => {
        return await FinanceModel.createRecurringCharge(data);
    });

    ipcMain.handle('update-recurring-charge', async (event, { id, data }) => {
        return await FinanceModel.updateRecurringCharge(id, data);
    });

    ipcMain.handle('delete-recurring-charge', async (event, id) => {
        return await FinanceModel.deleteRecurringCharge(id);
    });

    ipcMain.handle('get-monthly-recurring-total', async () => {
        return await FinanceModel.getMonthlyRecurringTotal();
    });

    // ==================== FINANCIAL SUMMARY ====================

    ipcMain.handle('get-available-for-goals', async () => {
        return await FinanceModel.getAvailableForGoals();
    });

    // Data Import/Export
    ipcMain.handle('export-data', async () => {
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
    });

    ipcMain.handle('import-data', async () => {
        const { filePaths, canceled } = await dialog.showOpenDialog({
            title: 'Import Backup',
            buttonLabel: 'Import',
            filters: [{ name: 'JSON Backup', extensions: ['json'] }],
            properties: ['openFile']
        });

        if (canceled || !filePaths || filePaths.length === 0) {
            return { success: false, message: 'Import cancelled' };
        }

        try {
            const fileContent = fs.readFileSync(filePaths[0], 'utf8');
            const data = JSON.parse(fileContent);

            // Validate it looks like a Bofo backup
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

    ipcMain.handle('export-excel', async () => {
        try {
            const workbook = XLSX.utils.book_new();

            // Helper to add sheet
            const addSheet = (data, name, headers) => {
                if (!data || data.length === 0) {
                    // Add empty sheet with headers only
                    const ws = XLSX.utils.aoa_to_sheet([headers]);
                    XLSX.utils.book_append_sheet(workbook, ws, name);
                    return;
                }
                const sheetData = data.map(row => headers.map(h => row[h] ?? ''));
                const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetData]);
                XLSX.utils.book_append_sheet(workbook, ws, name);
            };

            // Accounts
            const accounts = await FinanceModel.getAllAccounts();
            addSheet(accounts, 'Accounts', ['id', 'name', 'type', 'balance', 'initial_balance', 'currency', 'status']);

            // Transactions
            const transactions = await FinanceModel.getAllTransactions();
            addSheet(transactions, 'Transactions', ['id', 'start_date', 'type', 'category', 'amount', 'currency', 'account_id', 'to_account_id', 'description', 'frequency', 'is_active']);

            // Categories
            const categories = await FinanceModel.getAllCategories();
            addSheet(categories, 'Categories', ['id', 'type', 'name', 'status', 'is_default', 'color', 'icon']);

            // Budgets
            const budgets = await FinanceModel.getAllBudgets();
            addSheet(budgets, 'Budgets', ['id', 'category', 'amount', 'period', 'start_date', 'end_date', 'created_at']);

            // Goals
            const goals = await FinanceModel.getAllGoals();
            addSheet(goals, 'Goals', ['id', 'name', 'description', 'target_amount', 'current_amount', 'monthly_contribution', 'target_date', 'status', 'priority']);

            // Recurring Charges
            const recurring = await FinanceModel.getAllRecurringCharges();
            addSheet(recurring, 'Recurring Charges', ['id', 'category', 'name', 'amount', 'frequency', 'due_day', 'next_due_date', 'is_active', 'notes']);

            // Bill Types
            const billTypes = await FinanceModel.getBillTypes();
            addSheet(billTypes, 'Bill Types', ['id', 'name', 'unit_name', 'cost_per_unit', 'category_name', 'account_id', 'auto_transaction']);

            // Bill Readings
            const billReadings = await FinanceModel.getBillReadings({});
            addSheet(billReadings, 'Bill Readings', ['id', 'bill_type_id', 'date', 'units_used', 'total_cost', 'notes']);

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

    // AI Handlers
    ipcMain.handle('get-ai-settings', async () => {
        try {
            return await syncAIService();
        } catch (e) {
            console.error('Failed to get AI settings:', e.message);
            return { enabled: false, url: 'http://127.0.0.1:11434', model: 'gemma3:4b' };
        }
    });

    ipcMain.handle('get-ai-defaults', async () => {
        try {
            const ai = getAIService();
            return ai.DEFAULTS || {};
        } catch (e) {
            console.error('Failed to get AI defaults:', e.message);
            return {};
        }
    });

    ipcMain.handle('save-ai-settings', async (event, settings) => {
        try {
            await FinanceModel.saveAISettings(settings);
            await syncAIService();
            return true;
        } catch (e) {
            console.error('Failed to save AI settings:', e.message);
            return false;
        }
    });

    ipcMain.handle('get-ai-models', async (event, url) => {
        try {
            const ai = getAIService();
            if (url) ai.baseUrl = url;
            return await ai.getInstalledModels();
        } catch (e) {
            console.error('Failed to get AI models:', e.message);
            return [];
        }
    });

    ipcMain.handle('check-ai-connection', async () => {
        try {
            const ai = getAIService();
            return await ai.checkConnection();
        } catch (e) {
            console.error('AI connection check failed:', e.message);
            return false;
        }
    });

    ipcMain.handle('parse-transaction-ai', async (event, { text, categories, accounts }) => {
        try {
            const ai = getAIService();
            return await ai.parseTransactionFromText(text, categories || [], accounts || []);
        } catch (e) {
            console.error('AI transaction parsing failed:', e.message);
            return null;
        }
    });

    ipcMain.handle('get-ai-insight', async (event, summary) => {
        try {
            const ai = getAIService();
            return await ai.getFinancialInsight(summary);
        } catch (e) {
            console.error('Failed to get AI insight:', e.message);
            return "Keep tracking your spending to stay on top of your goals!";
        }
    });

    ipcMain.handle('chat-sandbox', async (event, { text, context }) => {
        try {
            const ai = getAIService();
            // For streaming, we need to handle it differently
            return await ai.chatSandbox(text, context, null, (chunk) => {
                event.sender.send('chat-sandbox-chunk', chunk);
            });
        } catch (e) {
            console.error('Chat sandbox error:', e.message);
            return "I'm having trouble connecting to the AI engine.";
        }
    });

    // Forecast (uses ForecastEngine class)
    ipcMain.handle('calculate-forecast', async (event, data) => {
        try {
            const ForecastEngine = require('../../utils/forecast');
            const engine = new ForecastEngine(
                data.transactions || [],
                data.accounts || [],
                data.settings || {}
            );
            return engine.generateForecast(data.months || 6);
        } catch (e) {
            console.error('Forecast calculation error:', e);
            return { timeline: [], summary: {}, insights: [] };
        }
    });

    // ==================== BILLS HANDLERS ====================

    ipcMain.handle('get-bill-types', async () => {
        return await FinanceModel.getBillTypes();
    });

    ipcMain.handle('add-bill-type', async (event, data) => {
        return await FinanceModel.addBillType(data);
    });

    ipcMain.handle('update-bill-type', async (event, { id, data }) => {
        return await FinanceModel.updateBillType(id, data);
    });

    ipcMain.handle('delete-bill-type', async (event, id) => {
        return await FinanceModel.deleteBillType(id);
    });

    ipcMain.handle('get-bill-readings', async (event, filters) => {
        return await FinanceModel.getBillReadings(filters);
    });

    ipcMain.handle('add-bill-reading', async (event, data) => {
        return await FinanceModel.addBillReading(data);
    });

    ipcMain.handle('update-bill-reading', async (event, { id, data }) => {
        return await FinanceModel.updateBillReading(id, data);
    });

    ipcMain.handle('get-bill-projections', async (event, months) => {
        return await FinanceModel.getBillProjections(months);
    });

    ipcMain.handle('delete-bill-reading', async (event, id) => {
        return await FinanceModel.deleteBillReading(id);
    });

    // ==================== AUTO-BACKUP HANDLERS ====================

    ipcMain.handle('pick-backup-directory', async () => {
        const { filePaths, canceled } = await dialog.showOpenDialog({
            title: 'Select Backup Directory',
            properties: ['openDirectory', 'createDirectory']
        });

        if (canceled || !filePaths || filePaths.length === 0) {
            return null;
        }
        return filePaths[0];
    });

    ipcMain.handle('run-backup-now', async () => {
        try {
            const settings = await FinanceModel.getAllSettings();
            const backupDir = settings.auto_backup_directory;

            if (!backupDir) {
                return { success: false, message: 'No backup directory configured' };
            }

            // Check if directory exists
            if (!fs.existsSync(backupDir)) {
                return { success: false, message: 'Backup directory does not exist' };
            }

            const data = await FinanceModel.exportData();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const filename = `bofo-backup-${timestamp}.json`;
            const filepath = path.join(backupDir, filename);

            fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

            // Update last backup time
            await FinanceModel.updateSetting('auto_backup_last', new Date().toISOString());

            return { success: true, message: `Backup saved to ${filename}` };
        } catch (err) {
            console.error('Backup error:', err);
            return { success: false, message: err.message };
        }
    });
}

// Auto-backup on app close (called from main.js)
async function performAutoBackup() {
    try {
        const settings = await FinanceModel.getAllSettings();

        if (settings.auto_backup_enabled !== 'true' || !settings.auto_backup_directory) {
            return;
        }

        const backupDir = settings.auto_backup_directory;
        if (!fs.existsSync(backupDir)) {
            console.warn('Auto-backup directory does not exist:', backupDir);
            return;
        }

        // Check if we already backed up today
        const lastBackup = settings.auto_backup_last;
        if (lastBackup) {
            const lastDate = new Date(lastBackup).toDateString();
            const today = new Date().toDateString();
            if (lastDate === today) {
                console.log('Already backed up today, skipping...');
                return;
            }
        }

        const data = await FinanceModel.exportData();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const filename = `bofo-backup-${timestamp}.json`;
        const filepath = path.join(backupDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        await FinanceModel.updateSetting('auto_backup_last', new Date().toISOString());

        console.log('Auto-backup completed:', filepath);
    } catch (err) {
        console.error('Auto-backup failed:', err);
    }
}

module.exports = { registerIpcHandlers, performAutoBackup };
