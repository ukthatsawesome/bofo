import { FinanceModel } from '../models/finance';
import { ForecastEngine } from '../utils/forecast';
import { aiService, SandboxContext, ChunkCallback } from './aiService';
import type { Transaction, Account, RecurringCharge } from '../database/types';
import { SETTING_KEYS } from '../../shared/settings/keys';
import { AIConfigService } from '../config/AIConfig';

class FinanceService {
  /**
   * Retrieve all transactions from the database.
   * @returns Promise resolving to an array of Transaction objects.
   */
  async getTransactions() {
    return await FinanceModel.getAllTransactions();
  }

  /**
   * Add a new transaction and auto-sync account balances.
   * Note: Balance sync is handled automatically by FinanceModel.create's afterWrite hook.
   * @param transaction Partial transaction data (amount, type, etc.)
   * @returns Promise resolving to the new transaction ID.
   */
  async addTransaction(transaction: Partial<Transaction>) {
    const result = await FinanceModel.create('transaction', transaction);
    return result.id;
  }

  /**
   * Update an existing transaction.
   * @param id Transaction ID
   * @param data Partial transaction data to update
   * @returns Promise resolving to the number of rows affected.
   */
  async updateTransaction(id: number, data: Partial<Transaction>) {
    return await FinanceModel.update('transaction', id, data);
  }

  /**
   * Delete a transaction.
   * @param id Transaction ID
   */
  async deleteTransaction(id: number) {
    return await FinanceModel.delete('transaction', id);
  }

  /**
   * Retrieve all categories.
   */
  async getCategories() {
    return await FinanceModel.getAllCategories();
  }

  /**
   * Check if a category name is currently in use.
   * @param name Category name
   */
  async isCategoryInUse(name: string) {
    return await FinanceModel.isCategoryInUse(name);
  }

  /**
   * Create a new category.
   * @param type 'expense' or 'income'
   * @param name Category name
   */
  async addCategory(type: string, name: string) {
    return await FinanceModel.create('category', { type, name });
  }

  /**
   * Delete a category if not in use.
   * @param id Category ID
   * @throws Error if category is in use.
   */
  async deleteCategory(id: number) {
    const categories = await FinanceModel.getAllCategories();
    const category = categories.find((c) => c.id === id);
    if (category) {
      const inUse = await FinanceModel.isCategoryInUse(category.name);
      if (inUse) throw new Error('Category is in use and cannot be deleted.');
    }
    return await FinanceModel.delete('category', id);
  }

  async archiveCategory(id: number) {
    return await FinanceModel.archive('category', id);
  }

  async unarchiveCategory(id: number) {
    return await FinanceModel.unarchive('category', id);
  }

  // =========================================================================
  // ACCOUNT MANAGEMENT
  // =========================================================================

  async getAccounts() {
    return await FinanceModel.getAllAccounts();
  }

  async addAccount(data: Partial<Account>) {
    return await FinanceModel.create('account', data);
  }

  async updateAccount(id: number, data: Partial<Account>) {
    return await FinanceModel.update('account', id, data);
  }

  async deleteAccount(id: number) {
    return await FinanceModel.delete('account', id);
  }

  // =========================================================================
  // SETTINGS
  // =========================================================================

  async getSettings() {
    return await FinanceModel.getAllSettings();
  }

  async updateSetting(key: string, value: string) {
    return await FinanceModel.updateSetting(key, value);
  }

  /**
   * Generate financial forecast.
   * @param transactions Optional override for transactions
   * @param months Number of months to forecast
   * @param accounts Optional override for accounts
   * @param recurringCharges Optional override for recurring charges
   * @returns ForecastResult object
   */
  async calculateForecast(
    transactions: Transaction[] | null,
    months: number,
    accounts: Account[] | null = null,
    recurringCharges: RecurringCharge[] | null = null
  ) {
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
      rcs = await FinanceModel.getAllRecurringCharges();
    }

    // Pass only the properties ForecastEngine expects for settings
    const dbSettings = await FinanceModel.getAllSettings();
    const forecastSettings = {
      [SETTING_KEYS.FORECAST.HORIZON]: dbSettings[SETTING_KEYS.FORECAST.HORIZON],
      [SETTING_KEYS.FORECAST.INFLATION_ENABLED]: dbSettings[SETTING_KEYS.FORECAST.INFLATION_ENABLED],
      [SETTING_KEYS.FORECAST.INFLATION_RATE]: dbSettings[SETTING_KEYS.FORECAST.INFLATION_RATE],
    };

    // Map DB types to Forecast types
    const forecastTxs: any[] = txs.map((t) => ({ ...t, is_active: t.is_active === 1 }));
    const forecastAccs: any[] = accs.map((a) => ({ ...a }));
    const forecastRcs: any[] = rcs.map((r) => ({ ...r, is_active: r.is_active === 1 }));

    const engine = new ForecastEngine(forecastTxs, forecastAccs, forecastSettings, forecastRcs);
    return engine.generateForecast(months);
  }

  // =========================================================================
  // BUDGETS
  // =========================================================================

  async getBudgets() {
    return await FinanceModel.getAllBudgets();
  }

  async setBudget(
    category: string,
    amount: number,
    period: string,
    startDate: string,
    endDate: string
  ) {
    return await FinanceModel.create('budget', {
      category,
      amount,
      period,
      start_date: startDate,
      end_date: endDate,
    });
  }

  async updateBudget(
    id: number,
    category: string,
    amount: number,
    period: string,
    startDate: string,
    endDate: string
  ) {
    return await FinanceModel.update('budget', id, {
      category,
      amount,
      period,
      start_date: startDate,
      end_date: endDate,
    });
  }

  async deleteBudget(id: number) {
    return await FinanceModel.delete('budget', id);
  }

  // =========================================================================
  // DATA EXPORT/IMPORT
  // =========================================================================

  async exportData() {
    return await FinanceModel.exportData();
  }

  async importData(jsonData: any) {
    return await FinanceModel.importData(jsonData);
  }

  async exportCSV() {
    return await FinanceModel.exportAllToCSV();
  }

  // =========================================================================
  // AI FEATURES
  // =========================================================================

  async getAISettings() {
    // Return flat structure for compatibility
    const config = await AIConfigService.getEffectiveConfig();
    return {
      enabled: config.enabled,
      url: config.url,
      model: config.model,
      promptTx: config.prompts.tx,
      promptInsight: config.prompts.insight,
      promptChat: config.prompts.chat
    };
  }

  async saveAISettings(
    url: string,
    model: string,
    enabled: boolean,
    promptTx: string,
    promptInsight: string,
    promptChat: string
  ) {
    await FinanceModel.saveAISettings({
      url,
      model,
      enabled,
      promptTx,
      promptInsight,
      promptChat,
    });

    // Update live service
    await aiService.setConfig(url, model);
    return true;
  }

  async checkAIConnection() {
    const settings = await this.getAISettings();
    await aiService.setConfig(settings.url, settings.model);
    return await aiService.checkConnection();
  }

  async getAvailableModels(url?: string) {
    // Use provided URL if we are testing/listing from settings input
    if (url)
      await aiService.setConfig(url, 'llama2'); // dummy model for check
    else {
      const settings = await this.getAISettings();
      await aiService.setConfig(settings.url, settings.model);
    }
    return await aiService.getInstalledModels();
  }

  /**
   * Parse a transaction description string using AI.
   * @param text Raw transaction text (e.g. "Spent 50 on groceries")
   */
  async parseTransactionAI(text: string) {
    const settings = await this.getAISettings();
    if (!settings.enabled) throw new Error('AI is disabled');

    await aiService.setConfig(settings.url, settings.model);

    const categories = (await FinanceModel.getAllCategories()).map((c) => c.name);
    const accounts = (await FinanceModel.getAllAccounts()).map((a) => a.name);
    return await aiService.parseTransactionFromText(
      text,
      categories,
      accounts,
      settings.promptTx || null
    );
  }

  async getMonthlyInsightAI(summary: any) {
    const settings = await this.getAISettings();
    if (!settings.enabled) return null;

    await aiService.setConfig(settings.url, settings.model);
    return await aiService.getFinancialInsight(summary, settings.promptInsight || null);
  }

  async chatSandbox(text: string, context: SandboxContext, onChunk: ChunkCallback | null = null) {
    const settings = await this.getAISettings();
    if (!settings.enabled) throw new Error('AI is disabled');

    await aiService.setConfig(settings.url, settings.model);
    return await aiService.chatSandbox(text, context, settings.promptChat || null, onChunk);
  }
}

export const financeService = new FinanceService();
