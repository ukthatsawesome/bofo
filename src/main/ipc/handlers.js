const { ipcMain, dialog } = require('electron');
const fs = require('fs');
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

    ipcMain.handle('import-data', async (event, data) => {
        return await FinanceModel.importData(data);
    });

    ipcMain.handle('export-csv', async () => {
        const csv = await FinanceModel.exportTransactionsToCSV();
        const { filePath } = await dialog.showSaveDialog({
            buttonLabel: 'Export CSV',
            defaultPath: `bofo-transactions-${new Date().toISOString().split('T')[0]}.csv`,
            filters: [{ name: 'CSV', extensions: ['csv'] }]
        });

        if (filePath) {
            fs.writeFileSync(filePath, csv);
            return true;
        }
        return false;
    });

    // AI Handlers
    ipcMain.handle('get-ai-settings', async () => {
        try {
            return await syncAIService();
        } catch (e) {
            return { enabled: false, url: 'http://127.0.0.1:11434', model: 'gemma3:4b' };
        }
    });

    ipcMain.handle('get-ai-defaults', async () => {
        try {
            const ai = getAIService();
            return ai.DEFAULTS || {};
        } catch (e) {
            return {};
        }
    });

    ipcMain.handle('save-ai-settings', async (event, settings) => {
        try {
            await FinanceModel.saveAISettings(settings);
            await syncAIService();
            return true;
        } catch (e) {
            return false;
        }
    });

    ipcMain.handle('get-ai-models', async (event, url) => {
        try {
            const ai = getAIService();
            if (url) ai.baseUrl = url;
            return await ai.getInstalledModels();
        } catch (e) {
            return [];
        }
    });

    ipcMain.handle('check-ai-connection', async () => {
        try {
            const ai = getAIService();
            return await ai.checkConnection();
        } catch (e) {
            return false;
        }
    });

    ipcMain.handle('parse-transaction-ai', async (event, { text, categories, accounts }) => {
        try {
            const ai = getAIService();
            return await ai.parseTransactionFromText(text, categories || [], accounts || []);
        } catch (e) {
            return null;
        }
    });

    ipcMain.handle('get-ai-insight', async (event, summary) => {
        try {
            const ai = getAIService();
            return await ai.getFinancialInsight(summary);
        } catch (e) {
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
}

module.exports = { registerIpcHandlers };
