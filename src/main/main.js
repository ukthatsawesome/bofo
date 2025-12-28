const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const FinanceService = require('../services/financeService');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, '../../assets/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile(path.join(__dirname, '../ui/index.html'));

    // Open DevTools for debugging
    win.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handlers - Delegating to FinanceService
ipcMain.handle('get-transactions', async () => {
    try {
        return await FinanceService.getTransactions();
    } catch (err) {
        console.error('IPC get-transactions error:', err);
        return [];
    }
});

ipcMain.handle('add-transaction', async (event, transaction) => {
    try {
        return await FinanceService.addTransaction(transaction);
    } catch (err) {
        console.error('IPC add-transaction error:', err);
        throw err;
    }
});

ipcMain.handle('update-transaction', async (event, { id, data }) => {
    try {
        return await FinanceService.updateTransaction(id, data);
    } catch (err) {
        console.error('IPC update-transaction error:', err);
        throw err;
    }
});

ipcMain.handle('delete-transaction', async (event, id) => {
    try {
        return await FinanceService.deleteTransaction(id);
    } catch (err) {
        console.error('IPC delete-transaction error:', err);
        throw err;
    }
});

ipcMain.handle('calculate-forecast', async (event, { transactions, months, accounts }) => {
    try {
        return await FinanceService.calculateForecast(transactions, months, accounts);
    } catch (err) {
        console.error('IPC calculate-forecast error:', err);
        throw err;
    }
});

ipcMain.handle('get-categories', async () => {
    try {
        return await FinanceService.getCategories();
    } catch (err) {
        console.error('IPC get-categories error:', err);
        return [];
    }
});

ipcMain.handle('is-category-in-use', async (event, name) => {
    try {
        return await FinanceService.isCategoryInUse(name);
    } catch (err) {
        console.error('IPC is-category-in-use error:', err);
        return false;
    }
});

ipcMain.handle('add-category', async (event, { type, name }) => {
    try {
        return await FinanceService.addCategory(type, name);
    } catch (err) {
        console.error('IPC add-category error:', err);
        throw err;
    }
});

ipcMain.handle('delete-category', async (event, id) => {
    try {
        return await FinanceService.deleteCategory(id);
    } catch (err) {
        console.error('IPC delete-category error:', err);
        throw err;
    }
});

ipcMain.handle('archive-category', async (event, id) => {
    try {
        return await FinanceService.archiveCategory(id);
    } catch (err) {
        console.error('IPC archive-category error:', err);
        throw err;
    }
});

ipcMain.handle('unarchive-category', async (event, id) => {
    try {
        return await FinanceService.unarchiveCategory(id);
    } catch (err) {
        console.error('IPC unarchive-category error:', err);
        throw err;
    }
});

// Account Handlers
ipcMain.handle('get-accounts', async () => {
    try {
        return await FinanceService.getAccounts();
    } catch (err) {
        console.error('IPC get-accounts error:', err);
        return [];
    }
});

ipcMain.handle('add-account', async (event, data) => {
    try {
        return await FinanceService.addAccount(data);
    } catch (err) {
        console.error('IPC add-account error:', err);
        throw err;
    }
});

ipcMain.handle('update-account', async (event, { id, data }) => {
    try {
        return await FinanceService.updateAccount(id, data);
    } catch (err) {
        console.error('IPC update-account error:', err);
        throw err;
    }
});

ipcMain.handle('delete-account', async (event, id) => {
    try {
        return await FinanceService.deleteAccount(id);
    } catch (err) {
        console.error('IPC delete-account error:', err);
        throw err;
    }
});

ipcMain.handle('get-settings', async () => {
    try {
        return await FinanceService.getSettings();
    } catch (err) {
        console.error('IPC get-settings error:', err);
        return {};
    }
});

ipcMain.handle('update-setting', async (event, { key, value }) => {
    try {
        return await FinanceService.updateSetting(key, value);
    } catch (err) {
        console.error('IPC update-setting error:', err);
        throw err;
    }
});

// Budget Handlers
ipcMain.handle('get-budgets', async () => {
    try {
        return await FinanceService.getBudgets();
    } catch (err) {
        console.error('IPC get-budgets error:', err);
        return [];
    }
});

ipcMain.handle('set-budget', async (event, { category, amount, period, startDate, endDate }) => {
    try {
        return await FinanceService.setBudget(category, amount, period, startDate, endDate);
    } catch (err) {
        console.error('IPC set-budget error:', err);
        throw err;
    }
});

ipcMain.handle('update-budget', async (event, { id, category, amount, period, startDate, endDate }) => {
    try {
        return await FinanceService.updateBudget(id, category, amount, period, startDate, endDate);
    } catch (err) {
        console.error('IPC update-budget error:', err);
        throw err;
    }
});

ipcMain.handle('delete-budget', async (event, id) => {
    try {
        return await FinanceService.deleteBudget(id);
    } catch (err) {
        console.error('IPC delete-budget error:', err);
        throw err;
    }
});

// Data Transfer Handlers
ipcMain.handle('export-data', async () => {
    try {
        return await FinanceService.exportData();
    } catch (err) {
        console.error('IPC export-data error:', err);
        throw err;
    }
});

ipcMain.handle('import-data', async (event, jsonData) => {
    try {
        return await FinanceService.importData(jsonData);
    } catch (err) {
        console.error('IPC import-data error:', err);
        throw err;
    }
});

ipcMain.handle('export-csv', async () => {
    try {
        return await FinanceService.exportCSV();
    } catch (err) {
        console.error('IPC export-csv error:', err);
        throw err;
    }
});

// AI Handlers
ipcMain.handle('get-ai-settings', async () => {
    return await FinanceService.getAISettings();
});

ipcMain.handle('get-ai-defaults', async () => {
    const AIService = require('../services/aiService');
    return AIService.DEFAULTS;
});

ipcMain.handle('save-ai-settings', async (event, { url, model, enabled, promptTx, promptInsight, promptChat }) => {
    return await FinanceService.saveAISettings(url, model, enabled, promptTx, promptInsight, promptChat);
});

ipcMain.handle('check-ai-connection', async () => {
    return await FinanceService.checkAIConnection();
});

ipcMain.handle('get-ai-models', async (event, url) => {
    return await FinanceService.getAvailableModels(url);
});

ipcMain.handle('parse-transaction-ai', async (event, text) => {
    return await FinanceService.parseTransactionAI(text);
});

ipcMain.handle('get-ai-insight', async (event, summary) => {
    return await FinanceService.getMonthlyInsightAI(summary);
});

ipcMain.handle('chat-sandbox', async (event, { text, context }) => {
    return await FinanceService.chatSandbox(text, context, (chunk) => {
        event.sender.send('chat-sandbox-chunk', chunk);
    });
});
