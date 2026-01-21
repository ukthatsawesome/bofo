/**
 * IPC Handlers - Streamlined with Generic CRUD Pattern
 *
 * This module registers all IPC handlers for the Electron main process.
 * Uses a routing table pattern to reduce code duplication.
 */

import { ipcMain, dialog, app, IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

// =============================================================================
// FINANCE MODEL (Lazy Loaded to avoid circular dependency)
// =============================================================================

let _financeModel: typeof import('../models/finance').FinanceModel | null = null;
function getFinanceModel() {
  if (!_financeModel) {
    const module = require('../models/finance');
    _financeModel = module.FinanceModel;
  }
  return _financeModel!;
}

// =============================================================================
// AI SERVICE (Lazy Loaded)
// =============================================================================

let aiService: any = null;
function getAIService() {
  // using require for lazy load in Node process
  if (!aiService) {
    const module = require('../services/aiService');
    aiService = module.aiService;
  }
  return aiService;
}

async function syncAIService() {
  const ai = getAIService();
  const settings = await getFinanceModel().getAISettings();
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

type HandlerFunction = (event: IpcMainInvokeEvent | null, data: any) => Promise<any> | any;

export const SIMPLE_ROUTES: Record<string, HandlerFunction> = {
  // Transactions (using generic CRUD)
  // 'get-transactions' - Handled by TransactionController
  'get-transaction': (_, id) => getFinanceModel().getById('transaction', id),
  'add-transaction': (_, data) => {
      const { _auditContext, ...rest } = data;
      return getFinanceModel().create('transaction', rest, _auditContext || { source: 'USER' });
  },
  'update-transaction': (_, { id, data }) => {
      const { _auditContext, ...rest } = data;
      return getFinanceModel().update('transaction', id, rest, _auditContext || { source: 'USER' });
  },
  'delete-transaction': async (_, id) => {
    const model = getFinanceModel();
    const tx = await model.getById('transaction', id);
    const result = await model.delete('transaction', id, true, { source: 'USER' });
    // Sync balances after delete (triggers handle insert/update)
    if (tx) {
      if (tx.account_id) await model.syncAccountBalance(tx.account_id);
      if (tx.to_account_id) await model.syncAccountBalance(tx.to_account_id);
    }
    return result;
  },
  // 'get-transactions-paginated' - Handled by TransactionController
  'get-transaction-count': (_, options) => getFinanceModel().getTransactionCount(options),

  // Accounts (using generic CRUD)
  'get-accounts': () => getFinanceModel().getAllAccounts(),
  'add-account': (_, data) => {
    const { _auditContext, ...rest } = data;
    return getFinanceModel().create('account', { ...rest, initial_balance: rest.balance || 0 }, _auditContext || { source: 'USER' });
  },
  'update-account': (_, data) => {
    const { _auditContext, ...rest } = data;
    return getFinanceModel().update('account', rest.id, rest, _auditContext || { source: 'USER' });
  },
  'delete-account': (_, id) => getFinanceModel().delete('account', id, false, { source: 'USER' }), // Accounts usually deleted by user
  'archive-account': (_, id) => getFinanceModel().archive('account', id),
  'unarchive-account': (_, id) => getFinanceModel().unarchive('account', id),
  'is-account-in-use': async (_, id) => {
    const model = getFinanceModel();
    const row = await model.getById('account', id);
    if (!row) return false;
    // Check transactions
    const count = await model.getTransactionCount({ accountId: id });
    return count > 0;
  },

  // Categories (using generic CRUD)
  'get-categories': () => getFinanceModel().getAllCategories(),
  'add-category': async (_, { type, name, _auditContext }) => {
    try {
      return await getFinanceModel().create('category', { type, name }, _auditContext || { source: 'USER' });
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT' || err.message.includes('UNIQUE constraint')) {
        throw new Error('A category with this name already exists.');
      }
      throw err;
    }
  },
  'update-category': async (_, { id, data }) => {
    try {
      const { _auditContext, ...rest } = data;
      return await getFinanceModel().update('category', id, rest, _auditContext || { source: 'USER' });
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT' || err.message.includes('UNIQUE constraint')) {
        throw new Error('A category with this name already exists.');
      }
      throw err;
    }
  },
  'delete-category': (_, id) => getFinanceModel().delete('category', id),
  'archive-category': (_, id) => getFinanceModel().archive('category', id),
  'unarchive-category': (_, id) => getFinanceModel().unarchive('category', id),
  'is-category-in-use': (_, name) => getFinanceModel().isCategoryInUse(name),

  // Settings
  'get-settings': () => getFinanceModel().getAllSettings(),
  'update-setting': (_, { key, value }) => getFinanceModel().updateSetting(key, value),
  'save-settings': (_, settings) => getFinanceModel().saveSettings(settings),

  // Budgets (using generic CRUD)
  'get-budgets': () => getFinanceModel().getAllBudgets(),
  'set-budget': (_, { category, amount, period, startDate, endDate, _auditContext }) =>
    getFinanceModel().create('budget', {
      category,
      amount,
      period,
      start_date: startDate,
      end_date: endDate,
    }, _auditContext || { source: 'USER' }),
  'update-budget': (_, { id, category, amount, period, startDate, endDate, _auditContext }) =>
    getFinanceModel().update('budget', id, {
      category,
      amount,
      period,
      start_date: startDate,
      end_date: endDate,
    }, _auditContext || { source: 'USER' }),
  'delete-budget': (_, id) => getFinanceModel().delete('budget', id, true),

  // Goals (using generic CRUD + specialized methods)
  'get-goals': () => getFinanceModel().getAllGoals(),
  'get-active-goals': () => getFinanceModel().getAll('goal', { where: { status: 'active' } }),
  'get-goal': (_, id) => getFinanceModel().getById('goal', id),
  'create-goal': (_, data) => getFinanceModel().create('goal', data),
  'update-goal': async (_, { id, data }) => {
    // Auto-complete if target reached
    if (data.current_amount !== undefined && data.target_amount !== undefined) {
      if (data.current_amount >= data.target_amount && data.status !== 'completed') {
        data.status = 'completed';
        // cast to any to allow setting completed_at which might not be in partial but is validation-checked?
        // Actually entity schema allows extra fields if dynamic but TS enforces schema.
        // We add it to data.
        (data as any).completed_at = new Date().toISOString();
      }
    }
    return await getFinanceModel().update('goal', id, data);
  },
  'delete-goal': (_, id) => getFinanceModel().deleteGoal(id),
  'contribute-to-goal': (_, { goalId, amount, source, notes }) =>
    getFinanceModel().contributeToGoal(goalId, amount, source, notes),
  'get-goal-contributions': (_, goalId) => getFinanceModel().getGoalContributions(goalId),
  'get-goals-summary': () => getFinanceModel().getGoalsSummary(),
  'get-available-for-goals': () => getFinanceModel().getAvailableForGoals(),

  // Recurring Charges (using generic CRUD)
  'get-recurring-charges': () => getFinanceModel().getAllRecurringCharges(),
  'get-active-recurring-charges': () =>
    getFinanceModel().getAll('recurringCharge', { where: { is_active: 1 } }),
  'create-recurring-charge': (_, data) => getFinanceModel().create('recurringCharge', data),
  'update-recurring-charge': (_, { id, data }) =>
    getFinanceModel().update('recurringCharge', id, data),
  'delete-recurring-charge': (_, id) => getFinanceModel().delete('recurringCharge', id, true),
  'get-monthly-recurring-total': () => getFinanceModel().getMonthlyRecurringTotal(),

  // Bills (using generic CRUD)
  'get-bill-types': () => getFinanceModel().getBillTypes(),
  'add-bill-type': (_, data) => getFinanceModel().create('billType', data),
  'update-bill-type': (_, { id, data }) => getFinanceModel().update('billType', id, data),
  'delete-bill-type': (_, id) => getFinanceModel().delete('billType', id, true),
  'get-bill-readings': (_, filters) => getFinanceModel().getBillReadings(filters),
  'get-bill-readings-paginated': (_, options) =>
    getFinanceModel().getBillReadingsPaginated(options),
  'add-bill-reading': (_, data) => getFinanceModel().create('billReading', data),
  'update-bill-reading': (_, { id, data }) => getFinanceModel().update('billReading', id, data),
  'delete-bill-reading': (_, id) => getFinanceModel().delete('billReading', id, true),
  'get-bill-projections': () => getFinanceModel().getBillProjections(),

  // Exchange Rates (using generic CRUD where applicable)
  'get-exchange-rates': () => getFinanceModel().getExchangeRates(),
  'get-exchange-rate': (_, { from, to }) => getFinanceModel().getExchangeRate(from, to),
  'set-exchange-rate': (_, { from, to, rate, source }) =>
    getFinanceModel().setExchangeRate(from, to, rate, source || 'manual'),
  'delete-exchange-rate': (_, id) => getFinanceModel().delete('exchangeRate', id, true),
  'convert-currency': (_, { amount, from, to }) =>
    getFinanceModel().convertCurrency(amount, from, to),
  'get-used-currencies': () => getFinanceModel().getUsedCurrencies(),
  'get-accounts-converted': (_, baseCurrency) =>
    getFinanceModel().getAccountsWithConvertedBalances(baseCurrency),
  'get-rate-sync-status': () => getFinanceModel().getRateSyncStatus(),
  'get-total-balance': (_, baseCurrency) =>
    getFinanceModel().getTotalBalanceInBaseCurrency(baseCurrency),

  // AI Handlers (Mirrored from complex handlers for easy routing)
  'get-ai-settings': async () => {
    try {
      return await syncAIService();
    } catch (e) {
      return { enabled: false, url: 'http://127.0.0.1:11434', model: 'gemma3:4b' };
    }
  },
  'get-ai-defaults': () => {
    try {
      return getAIService().DEFAULTS || {};
    } catch (e) {
      return {};
    }
  },
  'save-ai-settings': (_, settings) => {
    return SIMPLE_ROUTES['save-ai-settings-internal'](null, settings);
  },
  'save-ai-settings-internal': async (_, settings) => {
    try {
      await getFinanceModel().saveAISettings(settings);
      await syncAIService();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  'get-ai-models': async (_, url) => {
    try {
      const ai = getAIService();
      if (url) ai.baseUrl = url;
      return await ai.getInstalledModels();
    } catch (e: any) {
      console.warn('[IPC] get-ai-models failed:', e.message);
      return [];
    }
  },
  'check-ai-connection': async () => {
    try {
      return await getAIService().checkConnection();
    } catch (e) {
      return false;
    }
  },
  'get-ai-health': async () => {
    try {
      const ai = getAIService();
      const health = ai.getHealthStatus();
      return {
        ...health,
        baseUrl: ai.baseUrl,
        model: ai.model,
      };
    } catch (e: any) {
      return { isConnected: false, lastError: e.message, circuitOpen: true };
    }
  },
  'parse-transaction-ai': async (_, { text, categories, accounts }) => {
    try {
      const result = await getAIService().parseTransactionFromText(
        text,
        categories || [],
        accounts || []
      );
      return { success: true, data: result };
    } catch (e: any) {
      console.warn('[IPC] parse-transaction-ai failed:', e.message);
      return { success: false, error: e.message, data: null };
    }
  },
  'get-ai-insight': async (_, summary) => {
    try {
      return await getAIService().getFinancialInsight(summary);
    } catch (e: any) {
      console.warn('[IPC] get-ai-insight failed:', e.message);
      return 'Keep tracking your spending to stay on top of your goals!';
    }
  },

  // Metadata Handlers
  'get-audit-logs': async (_, options) => {
      // Just exposing raw logs for now, filtered by entity/source via options if needed (later)
      // For now, return recent 100
      const { all } = require('../database/helpers').createDbHelpers(require('../database/db').db);
      // Combine transaction_history and audit_logs
      // This is a bit complex SQL, let's keep it simple: fetch both and merge in memory or just use two lists
      // Actually the view should handle this. Let's just expose a direct SQL helper for the view.
      
      const txLogs = await all(`
        SELECT 
            h.id, 'transaction' as entity_type, h.transaction_id as entity_id, 
            h.action, h.source, h.old_data, h.new_data as changes, h.metadata, h.changed_at as created_at,
            t.description as entity_name
        FROM transaction_history h
        LEFT JOIN transactions t ON h.transaction_id = t.id
        ORDER BY h.changed_at DESC LIMIT 50
      `);
      
      const genericLogs = await all(`
        SELECT 
            l.id, l.entity_type, l.entity_id, l.action, l.source, NULL as old_data, l.changes, l.metadata, l.created_at,
            NULL as entity_name
        FROM audit_logs l
        ORDER BY l.created_at DESC LIMIT 50
      `);
      
      // Merge and sort
      const combined = [...txLogs, ...genericLogs].sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ).slice(0, 50);
      
      return combined;
  },

  'get-host-info': () => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const results = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          results.push(iface.address);
        }
      }
    }
    return {
      ips: results,
      hostname: os.hostname(),
      platform: os.platform(),
    };
  },

  // Web-compatible raw data export
  'get-backup-data': () => getFinanceModel().exportData(),
  'import-backup-data': (_, data) => getFinanceModel().importData(data),

  // Web-compatible versions of complex handlers (no dialogs, no streaming)
  // Note: For IPC, 'chat-sandbox' also has a separate handler with streaming support
  'chat-sandbox': async (_, { text, context }) => {
    try {
      // Non-streaming version for HTTP calls
      return await getAIService().chatSandbox(text, context, null, null);
    } catch (e: any) {
      console.warn('[IPC] chat-sandbox failed:', e.message);
      if (e.message.includes('timed out')) return 'The AI is taking too long to respond.';
      return "I'm having trouble connecting to the AI engine.";
    }
  },

  // 'calculate-forecast' - Handled by FinanceController

  'sync-exchange-rates': async (_, { provider, baseCurrency, customUrl }) => {
    try {
      const model = getFinanceModel();
      const { CurrencyService } = require('../services/currencyService');
      const rates = await CurrencyService.fetchRates(provider, baseCurrency, customUrl);
      const usedCurrencies = await model.getUsedCurrencies();
      usedCurrencies.push(baseCurrency);
      const relevantRates = CurrencyService.filterRelevantRates(rates, usedCurrencies);
      await model.setExchangeRatesBulk(relevantRates, 'api');
      await model.updateSetting('currency_last_sync', new Date().toISOString());
      return {
        success: true,
        message: `Synced ${relevantRates.length} exchange rates`,
        ratesUpdated: relevantRates.length,
      };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  },

  'test-currency-api': async (_, { provider, baseCurrency, customUrl }) => {
    try {
      const { CurrencyService } = require('../services/currencyService');
      return await CurrencyService.testConnection(provider, baseCurrency, customUrl);
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  },

  'get-currency-providers': () => {
    const { CurrencyService } = require('../services/currencyService');
    return CurrencyService.getProviders();
  },
};

// =============================================================================
// REGISTER HANDLERS
// =============================================================================

export function registerIpcHandlers(excludeChannels: string[] = []): void {

  // Channels that have separate IPC handlers with special features (e.g., streaming)
  const skipForIpc = new Set(['chat-sandbox']);

  // Register all simple routes (available via both IPC and HTTP)
  for (const [channel, handler] of Object.entries(SIMPLE_ROUTES)) {
    // Skip channels that have custom IPC handlers
    if (skipForIpc.has(channel)) continue;
    
    // Skip channels explicitly excluded (e.g. handled by new Controllers)
    if (excludeChannels?.includes(channel)) continue;

    ipcMain.handle(channel, async (event, data) => {
      try {
        return await handler(event, data);
      } catch (error: any) {
        console.error(`[IPC] ${channel} error:`, error.message);
        throw error;
      }
    });
  }

  // ==========================================================================
  // COMPLEX HANDLERS (require special logic or dialogs)
  // ==========================================================================

  // Export Data (with dialog)
  ipcMain.handle('export-data', async () => {
    try {
      const data = await getFinanceModel().exportData();
      const { filePath } = await dialog.showSaveDialog({
        buttonLabel: 'Export Data',
        defaultPath: `bofo-export-${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
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
      properties: ['openFile'],
    });

    if (canceled || !filePaths?.length) {
      return { success: false, message: 'Import cancelled' };
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
      if (!data.accounts && !data.transactions) {
        return { success: false, message: 'Invalid backup file format' };
      }
      await getFinanceModel().importData(data);
      return { success: true, message: 'Data imported successfully!' };
    } catch (err: any) {
      console.error('Import error:', err);
      return { success: false, message: `Import failed: ${err.message}` };
    }
  });

  // Export Excel
  ipcMain.handle('export-excel', async () => {
    try {
      const model = getFinanceModel();
      const workbook = XLSX.utils.book_new();
      const addSheet = (data: any[], name: string, headers: string[]) => {
        const sheetData = data?.length ? data.map((row) => headers.map((h) => row[h] ?? '')) : [];
        const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetData]);
        XLSX.utils.book_append_sheet(workbook, ws, name);
      };

      addSheet(await model.getAllAccounts(), 'Accounts', [
        'id',
        'name',
        'type',
        'balance',
        'initial_balance',
        'currency',
        'status',
      ]);
      addSheet(await model.getAllTransactions(), 'Transactions', [
        'id',
        'start_date',
        'type',
        'category',
        'amount',
        'currency',
        'account_id',
        'to_account_id',
        'description',
        'frequency',
        'is_active',
      ]);
      addSheet(await model.getAllCategories(), 'Categories', [
        'id',
        'type',
        'name',
        'status',
        'is_default',
        'color',
        'icon',
      ]);
      addSheet(await model.getAllBudgets(), 'Budgets', [
        'id',
        'category',
        'amount',
        'period',
        'start_date',
        'end_date',
        'created_at',
      ]);
      addSheet(await model.getAllGoals(), 'Goals', [
        'id',
        'name',
        'description',
        'target_amount',
        'current_amount',
        'monthly_contribution',
        'target_date',
        'status',
        'priority',
      ]);
      addSheet(await model.getAllRecurringCharges(), 'Recurring Charges', [
        'id',
        'category',
        'name',
        'amount',
        'frequency',
        'due_day',
        'next_due_date',
        'is_active',
        'notes',
      ]);
      addSheet(await model.getBillTypes(), 'Bill Types', [
        'id',
        'name',
        'unit_name',
        'cost_per_unit',
        'category_name',
        'account_id',
        'auto_transaction',
      ]);
      addSheet(await model.getBillReadings({}), 'Bill Readings', [
        'id',
        'bill_type_id',
        'date',
        'units_used',
        'total_cost',
        'notes',
      ]);

      const { filePath, canceled } = await dialog.showSaveDialog({
        buttonLabel: 'Export Excel',
        defaultPath: `bofo-export-${new Date().toISOString().split('T')[0]}.xlsx`,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
      });

      if (canceled || !filePath) return false;
      XLSX.writeFile(workbook, filePath);
      return true;
    } catch (err) {
      console.error('Excel export error:', err);
      return false;
    }
  });

  ipcMain.handle('chat-sandbox', async (event, { text, context }) => {
    try {
      // Safely handle streaming - event may be null when called via HTTP
      const streamCallback = event?.sender
        ? (chunk: any) => event.sender.send('chat-sandbox-chunk', chunk)
        : null; // No streaming for HTTP calls

      return await getAIService().chatSandbox(text, context, null, streamCallback);
    } catch (e: any) {
      console.warn('[IPC] chat-sandbox failed:', e.message);
      if (e.message.includes('timed out')) return 'The AI is taking too long to respond.';
      return "I'm having trouble connecting to the AI engine.";
    }
  });

  ipcMain.handle('pick-backup-directory', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Select Backup Directory',
      properties: ['openDirectory', 'createDirectory'],
    });
    return canceled || !filePaths?.length ? null : filePaths[0];
  });

  ipcMain.handle('run-backup-now', async () => {
    try {
      const model = getFinanceModel();
      const settings = await model.getAllSettings();
      const backupDir = settings.auto_backup_directory;
      if (!backupDir || !fs.existsSync(backupDir))
        return { success: false, message: 'Invalid backup directory' };

      const data = await model.exportData();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      fs.writeFileSync(
        path.join(backupDir, `bofo-backup-${timestamp}.json`),
        JSON.stringify(data, null, 2)
      );
      await model.updateSetting('auto_backup_last', new Date().toISOString());
      return { success: true, message: 'Backup saved' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });
}

export async function performAutoBackup() {
  try {
    const model = getFinanceModel();
    const settings = await model.getAllSettings();
    if (settings.auto_backup_enabled !== 'true' || !settings.auto_backup_directory) return;
    if (!fs.existsSync(settings.auto_backup_directory)) return;

    const lastBackup = settings.auto_backup_last;
    if (lastBackup && new Date(lastBackup).toDateString() === new Date().toDateString()) return;

    const data = await model.exportData();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    fs.writeFileSync(
      path.join(settings.auto_backup_directory, `bofo-backup-${timestamp}.json`),
      JSON.stringify(data, null, 2)
    );
    await model.updateSetting('auto_backup_last', new Date().toISOString());
  } catch (err) {
    console.error('Auto-backup failed:', err);
  }
}
