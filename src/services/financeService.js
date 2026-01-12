const FinanceModel = require('../models/finance');
const ForecastEngine = require('../utils/forecast');

class FinanceService {
    async getTransactions() {
        return await FinanceModel.getAllTransactions();
    }

    async addTransaction(transaction) {
        const txId = await FinanceModel.createTransaction(transaction);

        // Auto-sync account balances after transaction (Model handles this internally too, but Service orchestrates)
        // FinanceModel.createTransaction calls syncAccountBalance internally.

        return txId;
    }

    async updateTransaction(id, data) {
        return await FinanceModel.updateTransaction(id, data);
    }

    async deleteTransaction(id) {
        return await FinanceModel.deleteTransaction(id);
    }

    async getCategories() {
        return await FinanceModel.getAllCategories();
    }

    async isCategoryInUse(name) {
        return await FinanceModel.isCategoryInUse(name);
    }

    async addCategory(type, name) {
        return await FinanceModel.addCategory(type, name);
    }

    async deleteCategory(id) {
        const categories = await FinanceModel.getAllCategories();
        const category = categories.find(c => c.id === id);
        if (category) {
            const inUse = await FinanceModel.isCategoryInUse(category.name);
            if (inUse) throw new Error('Category is in use and cannot be deleted.');
        }
        return await FinanceModel.deleteCategory(id);
    }

    async archiveCategory(id) {
        return await FinanceModel.archiveCategory(id);
    }

    async unarchiveCategory(id) {
        return await FinanceModel.unarchiveCategory(id);
    }

    async getAccounts() {
        return await FinanceModel.getAllAccounts();
    }

    async addAccount(data) {
        return await FinanceModel.addAccount(data);
    }

    async updateAccount(id, data) {
        return await FinanceModel.updateAccount(id, data);
    }

    async deleteAccount(id) {
        return await FinanceModel.deleteAccount(id);
    }

    async getSettings() {
        return await FinanceModel.getAllSettings();
    }

    async updateSetting(key, value) {
        return await FinanceModel.updateSetting(key, value);
    }

    async calculateForecast(transactions, months, accounts = [], recurringCharges = null) {
        let txs = transactions;
        if (!txs) {
            txs = await FinanceModel.getAllTransactions();
        }
        let accs = accounts;
        if (!accs || accs.length === 0) {
            accs = await FinanceModel.getAllAccounts();
        }
        let rcs = recurringCharges;
        if (!rcs) {
            rcs = await FinanceModel.getAll('recurringCharge');
        }
        const settings = await FinanceModel.getAllSettings();
        const engine = new ForecastEngine(txs, accs, settings, rcs);
        return engine.generateForecast(months);
    }

    async getBudgets() {
        return await FinanceModel.getAllBudgets();
    }

    async setBudget(category, amount, period, startDate, endDate) {
        return await FinanceModel.setBudget(category, amount, period, startDate, endDate);
    }

    async updateBudget(id, category, amount, period, startDate, endDate) {
        return await FinanceModel.updateBudget(id, category, amount, period, startDate, endDate);
    }

    async deleteBudget(id) {
        return await FinanceModel.deleteBudget(id);
    }

    async exportData() {
        return await FinanceModel.exportData();
    }

    async importData(jsonData) {
        return await FinanceModel.importData(jsonData);
    }

    async exportCSV() {
        return await FinanceModel.exportTransactionsToCSV();
    }

    // AI Features
    async getAISettings() {
        const settings = await FinanceModel.getAllSettings();
        return {
            url: settings['ai_url'] || 'http://127.0.0.1:11434',
            model: settings['ai_model'] || 'gemma3:4b',
            enabled: settings['ai_enabled'] === 'true',
            promptTx: settings['ai_prompt_tx'] || '',
            promptInsight: settings['ai_prompt_insight'] || '',
            promptChat: settings['ai_prompt_chat'] || ''
        };
    }

    async saveAISettings(url, model, enabled, promptTx, promptInsight, promptChat) {
        await FinanceModel.updateSetting('ai_url', url);
        await FinanceModel.updateSetting('ai_model', model);
        await FinanceModel.updateSetting('ai_enabled', String(enabled));
        await FinanceModel.updateSetting('ai_prompt_tx', promptTx || '');
        await FinanceModel.updateSetting('ai_prompt_insight', promptInsight || '');
        await FinanceModel.updateSetting('ai_prompt_chat', promptChat || '');

        // Update live service
        const aiService = require('./aiService');
        aiService.setConfig(url, model);
        return true;
    }

    async checkAIConnection() {
        const aiService = require('./aiService');
        const settings = await this.getAISettings();
        aiService.setConfig(settings.url, settings.model);
        return await aiService.checkConnection();
    }

    async getAvailableModels(url) {
        const aiService = require('./aiService');
        // Use provided URL if we are testing/listing from settings input
        if (url) aiService.setConfig(url, 'llama2');
        else {
            const settings = await this.getAISettings();
            aiService.setConfig(settings.url, settings.model);
        }
        return await aiService.getInstalledModels();
    }

    async parseTransactionAI(text) {
        const aiService = require('./aiService');
        const settings = await this.getAISettings();
        if (!settings.enabled) throw new Error("AI is disabled");

        await aiService.setConfig(settings.url, settings.model);

        const categories = (await FinanceModel.getAllCategories()).map(c => c.name);
        const accounts = (await FinanceModel.getAllAccounts()).map(a => a.name);
        return await aiService.parseTransactionFromText(text, categories, accounts, settings.promptTx);
    }

    async getMonthlyInsightAI(summary) {
        const aiService = require('./aiService');
        const settings = await this.getAISettings();
        if (!settings.enabled) return null;

        await aiService.setConfig(settings.url, settings.model);
        return await aiService.getFinancialInsight(summary, settings.promptInsight);
    }

    async chatSandbox(text, context, onChunk = null) {
        const aiService = require('./aiService');
        const settings = await this.getAISettings();
        if (!settings.enabled) throw new Error("AI is disabled");

        await aiService.setConfig(settings.url, settings.model);
        return await aiService.chatSandbox(text, context, settings.promptChat, onChunk);
    }
}

module.exports = new FinanceService();
