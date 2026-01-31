/*
 * Finance Model - Streamlined CRUD with Validation
 *
 * This module provides database operations for all financial entities.
 * Uses generic CRUD patterns to reduce code duplication.
 * Includes automatic validation via the validators module.
 */

import { dbInstance, dbInitialized } from '../database/db';
import { createDbHelpers } from '../database/helpers';
import { EntityValidators, validateAmount, sanitizeData } from '../utils/validators';
import { DateUtils } from '../../shared/utils/dateUtils';
import type {
  Account,
  Transaction,
  Category,
  Budget,
  Goal,
  RecurringCharge,
  BillType,
  BillReading,
  ExchangeRate,
  Setting,
  GoalContribution,
} from '../database/types';
import { TransactionListDTO } from '../../shared/types';

import { Mutex } from '../utils/mutex';

const { run, get, all } = createDbHelpers(dbInstance);
const writeMutex = new Mutex();

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Cache-friendly structure for exchange rates to avoid N+1 queries in loops.
 * Format: { "USD-EUR": 0.9, "EUR-USD": 1.11 }
 */
type RateMap = Record<string, number>;

/**
 * Fetches all exchange rates and organizes them into a map for O(1) lookups.
 */
const getExchangeRateMap = async (): Promise<RateMap> => {
  const rows = await all<{ from_currency: string; to_currency: string; rate: number }>(
    `SELECT from_currency, to_currency, rate FROM exchange_rates`
  );

  const map: RateMap = {};
  for (const row of rows) {
    map[`${row.from_currency}-${row.to_currency}`] = row.rate;
    if (row.rate !== 0) {
      map[`${row.to_currency}-${row.from_currency}`] = 1 / row.rate;
    }
  }
  return map;
};

/**
 * Retrieves the user's base currency with a fallback.
 */
const getBaseCurrency = async (): Promise<string> => {
  const settings = await FinanceModel.getAllSettings();
  return settings.currency_base || 'USD';
};

/**
 * Converts an amount to the base currency using a provided rate map.
 */
const convertToBase = async (amount: number, currency: string, baseCurrency: string, rateMap: RateMap): Promise<number> => {
  if (currency === baseCurrency) return amount;
  const rate = rateMap[`${currency}-${baseCurrency}`] || 1;
  return amount * rate;
};

// =============================================================================
// ENTITY SCHEMAS
// =============================================================================

interface EntitySchema<T> {
  table: string;
  fields: string[];
  defaults?: Partial<T>;
  orderBy?: string;
  checkInUse?: (id: number) => Promise<boolean>;
  afterWrite?: (data: T & { id?: number }) => Promise<void>;
  afterDelete?: (data: T) => Promise<void>;
}

const ENTITY_SCHEMAS: Record<string, EntitySchema<any>> = {
  transaction: {
    table: 'transactions',
    fields: [
      'account_id', 'to_account_id', 'type', 'category', 'category_id',
      'amount', 'description', 'attachment', 'frequency', 'start_date',
      'end_date', 'currency', 'exchange_rate', 'to_amount', 'base_currency',
      'base_amount', 'tags', 'is_active',
    ],
    defaults: { currency: 'USD', frequency: 'once', is_active: 1, tags: '', exchange_rate: 1 },
    orderBy: 'start_date DESC',
  },
  account: {
    table: 'accounts',
    fields: ['name', 'type', 'balance', 'initial_balance', 'currency', 'status'],
    defaults: { currency: 'USD', status: 'active', balance: 0 },
    orderBy: 'type, name',
    checkInUse: async (id: number) => {
      const row = await get<{ count: number }>(
        `SELECT COUNT(*) as count FROM transactions WHERE account_id = ? OR to_account_id = ?`,
        [id, id]
      );
      return (row?.count || 0) > 0;
    },
  },
  category: {
    table: 'categories',
    fields: ['type', 'name', 'status', 'is_default', 'color', 'icon'],
    defaults: { status: 'active', is_default: 0, color: '#7b68ee', icon: '📂' },
    orderBy: 'type, name',
    checkInUse: async (id: number) => {
      const cat = await get<Category>(`SELECT name FROM categories WHERE id = ?`, [id]);
      if (!cat) return false;
      const row = await get<{ count: number }>(
        `SELECT COUNT(*) as count FROM transactions WHERE category = ?`,
        [cat.name]
      );
      return (row?.count || 0) > 0;
    },
  },
  budget: {
    table: 'budgets',
    fields: ['category', 'category_id', 'amount', 'period', 'start_date', 'end_date', 'currency'],
    defaults: { period: 'monthly', currency: 'USD' },
    orderBy: 'start_date DESC',
  },
  goal: {
    table: 'goals',
    fields: [
      'name', 'description', 'target_amount', 'current_amount', 'monthly_contribution',
      'icon', 'color', 'priority', 'target_date', 'status', 'auto_contribute', 'currency',
    ],
    defaults: {
      current_amount: 0, monthly_contribution: 0, icon: 'target', color: '#a29bfe',
      priority: 1, status: 'active', auto_contribute: 0, currency: 'USD',
    },
    orderBy: 'priority ASC, created_at DESC',
  },
  recurringCharge: {
    table: 'recurring_charges',
    fields: [
      'category', 'category_id', 'name', 'amount', 'frequency', 'due_day',
      'next_due_date', 'is_active', 'notes', 'currency',
    ],
    defaults: { frequency: 'monthly', due_day: 1, is_active: 1, currency: 'USD' },
    orderBy: 'category, name',
  },
  billType: {
    table: 'bill_types',
    fields: [
      'name', 'unit_name', 'cost_per_unit', 'category_name', 'account_id',
      'auto_transaction', 'icon', 'color', 'currency',
    ],
    defaults: {
      unit_name: 'Units', cost_per_unit: 0, auto_transaction: 0,
      icon: 'file-text', color: '#7c3aed', currency: 'USD',
    },
    orderBy: 'name ASC',
  },
  billReading: {
    table: 'bill_readings',
    fields: ['bill_type_id', 'date', 'units_used', 'total_cost', 'notes'],
    defaults: {},
    orderBy: 'date DESC',
    afterWrite: async (data: BillReading) => {
      const billType = await get<BillType>(
        `SELECT name, category_name, account_id, auto_transaction FROM bill_types WHERE id = ?`,
        [data.bill_type_id]
      );
      if (billType?.auto_transaction && billType.category_name) {
        let accountId = billType.account_id;
        if (!accountId) {
          const defaultAcc = await get<Account>(
            `SELECT id FROM accounts WHERE type IN ('bank', 'wallet') AND status = 'active' LIMIT 1`
          );
          accountId = defaultAcc?.id || null;
        }
        if (accountId) {
          // Use internal create to avoid deadlock (mutex is already held by parent create)
          await FinanceModel.createInternal('transaction', {
            account_id: accountId,
            type: 'expense',
            category: billType.category_name,
            amount: data.total_cost,
            description: `Bill: ${billType.name} (${data.units_used} units)`,
            frequency: 'once',
            start_date: data.date,
            tags: 'bill-auto',
          }, { source: 'SYSTEM', skipAudit: false });
        }
      }
    },
  },
  exchangeRate: {
    table: 'exchange_rates',
    fields: ['from_currency', 'to_currency', 'rate', 'source'],
    defaults: { source: 'manual' },
    orderBy: 'from_currency, to_currency',
  },
  setting: {
    table: 'settings',
    fields: ['key', 'value', 'category'],
    defaults: { category: 'general' },
    orderBy: 'key',
  },
  goalContribution: {
    table: 'goal_contributions',
    fields: ['goal_id', 'amount', 'source', 'notes'],
    defaults: {},
    orderBy: 'contributed_at DESC',
  },
};

// =============================================================================
// GENERIC CRUD OPERATIONS
// =============================================================================

export const FinanceModel = {
  /**
   * Internal Create (No locking, assumes transaction/lock exists)
   */
  createInternal: async (entityType: string, data: any, auditContext: any): Promise<{ id: number; changes: number }> => {
    const schema = ENTITY_SCHEMAS[entityType];
    if (!schema) throw new Error(`Unknown entity type: ${entityType}`);

    const validator = (EntityValidators as any)[entityType];
    if (validator) data = validator(data, true);

    const finalData = { ...schema.defaults, ...sanitizeData(data, schema.fields) };
    const fields = Object.keys(finalData);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map((f) => finalData[f]);

    const result = await run(`INSERT INTO ${schema.table} (${fields.join(', ')}) VALUES (${placeholders})`, values);

    if (!auditContext?.skipAudit) {
      await FinanceModel.logAudit(entityType, result.id, 'CREATE', null, finalData, auditContext);
    }

    if (schema.afterWrite) await schema.afterWrite({ ...finalData, id: result.id });

    return result;
  },

  /**
   * Create a new entity (Atomic & Serialized)
   */
  create: async (entityType: string, data: any, auditContext: { source?: string; metadata?: any; skipAudit?: boolean } = {}): Promise<{ id: number; changes: number }> => {
    await dbInitialized;
    return await writeMutex.runExclusive(async () => {
      await run('BEGIN TRANSACTION');
      try {
        const result = await FinanceModel.createInternal(entityType, data, auditContext);
        await run('COMMIT');
        return result;
      } catch (err) {
        await run('ROLLBACK');
        throw err;
      }
    });
  },

  /**
   * Update an entity by ID (Atomic & Serialized)
   */
  update: async (
    entityType: string,
    id: number,
    data: any,
    auditContext: { source?: string; metadata?: any; skipAudit?: boolean } = {}
  ): Promise<{ id: number; changes: number }> => {
    await dbInitialized;
    return await writeMutex.runExclusive(async () => {
      await run('BEGIN TRANSACTION');
      try {
        const schema = ENTITY_SCHEMAS[entityType];
        if (!schema) throw new Error(`Unknown entity type: ${entityType}`);

        const validator = (EntityValidators as any)[entityType];
        if (validator) data = validator(data, false);

        const sanitized = sanitizeData(data, schema.fields);
        const fields = Object.keys(sanitized);

        if (fields.length === 0) {
          await run('COMMIT');
          return { id, changes: 0 };
        }

        const setClause = fields.map((f) => `${f} = ?`).join(', ');
        const values = [...fields.map((f) => sanitized[f]), id];

        const sql = `UPDATE ${schema.table} SET ${setClause} WHERE id = ?`;
        const oldData = await FinanceModel.getById(entityType, id);

        const result = await run(sql, values);

        if (!auditContext.skipAudit) {
          await FinanceModel.logAudit(entityType, id, 'UPDATE', oldData, sanitized, auditContext);
        }

        if (schema.afterWrite) await schema.afterWrite({ ...sanitized, id });

        await run('COMMIT');
        return result;
      } catch (err) {
        await run('ROLLBACK');
        throw err;
      }
    });
  },

  /**
   * Delete an entity by ID (Atomic & Serialized)
   */
  delete: async (
    entityType: string,
    id: number,
    force: boolean = false,
    auditContext: { source?: string; metadata?: any; skipAudit?: boolean } = {}
  ): Promise<{ id: number; changes: number }> => {
    await dbInitialized;
    return await writeMutex.runExclusive(async () => {
      await run('BEGIN TRANSACTION');
      try {
        const schema = ENTITY_SCHEMAS[entityType];
        if (!schema) throw new Error(`Unknown entity type: ${entityType}`);

        if (!force && schema.checkInUse) {
          const inUse = await schema.checkInUse(id);
          if (inUse) {
            throw new Error(`Cannot delete: ${entityType} is in use. Archive it instead.`);
          }
        }

        const oldData = await FinanceModel.getById(entityType, id);
        const result = await run(`DELETE FROM ${schema.table} WHERE id = ?`, [id]);

        if (oldData && !auditContext.skipAudit) {
          await FinanceModel.logAudit(entityType, id, 'DELETE', oldData, null, auditContext);
        }

        if (schema.afterDelete && oldData) await schema.afterDelete(oldData);

        await run('COMMIT');
        return result;
      } catch (err) {
        await run('ROLLBACK');
        throw err;
      }
    });
  },

  /**
   * Get single entity by ID
   */
  getById: async (entityType: string, id: number): Promise<any> => {
    await dbInitialized;
    const schema = ENTITY_SCHEMAS[entityType];
    if (!schema) throw new Error(`Unknown entity type: ${entityType}`);
    return await get(`SELECT * FROM ${schema.table} WHERE id = ?`, [id]);
  },

  /**
   * Log an audit event
   */
  logAudit: async (
    entityType: string,
    entityId: number,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    oldData: any,
    newData: any,
    context: { source?: string; metadata?: any } = {}
  ) => {
    try {
      const source = context.source || 'USER';
      const metadata = context.metadata ? JSON.stringify(context.metadata) : null;

      if (entityType === 'transaction') {
        await run(
          `INSERT INTO transaction_history (transaction_id, action, old_data, new_data, source, metadata)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            entityId,
            action,
            oldData ? JSON.stringify(oldData) : null,
            newData ? JSON.stringify(newData) : null,
            source,
            metadata,
          ]
        );
      } else {
        let changes: string | null = null;
        if (action === 'UPDATE' && oldData && newData) {
          const diff: Record<string, any> = {};
          Object.keys(newData).forEach((key) => {
            if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
              diff[key] = { from: oldData[key], to: newData[key] };
            }
          });
          changes = JSON.stringify(diff);
        } else if (action === 'CREATE') {
          changes = JSON.stringify(newData);
        } else {
          changes = JSON.stringify(oldData);
        }

        await run(
          `INSERT INTO audit_logs (entity_type, entity_id, action, source, changes, metadata)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [entityType, entityId, action, source, changes, metadata]
        );
      }
    } catch (e) {
      console.error('[Audit] Failed to log:', e);
    }
  },

  /**
   * Get all entities of a type
   */
  getAll: async <T = any>(
    entityType: string,
    options: { where?: Record<string, any>; orderBy?: string } = {}
  ): Promise<T[]> => {
    await dbInitialized;
    const schema = ENTITY_SCHEMAS[entityType];
    if (!schema) throw new Error(`Unknown entity type: ${entityType}`);

    let sql = `SELECT * FROM ${schema.table}`;
    const params: any[] = [];

    if (options.where) {
      const conditions: string[] = [];
      for (const [field, value] of Object.entries(options.where)) {
        if (schema.fields.includes(field) || field === 'id' || field === 'status') {
          conditions.push(`${field} = ?`);
          params.push(value);
        }
      }
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }
    }

    sql += ` ORDER BY ${options.orderBy || schema.orderBy || 'id'}`;

    return await all<T>(sql, params);
  },

  archive: async (entityType: string, id: number) => {
    return await FinanceModel.update(entityType, id, { status: 'archived' });
  },

  unarchive: async (entityType: string, id: number) => {
    return await FinanceModel.update(entityType, id, { status: 'active' });
  },

  isCategoryInUse: async (name: string): Promise<boolean> => {
    const row = await get<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions WHERE category = ?`,
      [name]
    );
    return (row?.count || 0) > 0;
  },

  deleteGoal: async (id: number) => {
    return await FinanceModel.delete('goal', id, true);
  },

  // =========================================================================
  // SPECIALIZED OPERATIONS
  // =========================================================================

  syncAccountBalance: async (accountId: number) => {
    await dbInitialized;
    const acc = await get<Account>(`SELECT initial_balance FROM accounts WHERE id = ?`, [accountId]);
    if (!acc) return;

    const agg = await get<{ total_in: number; total_out: number }>(
      `
      SELECT 
        COALESCE(SUM(CASE 
          WHEN type = 'income' AND account_id = ? THEN ROUND(amount * 100) / 100
          WHEN type = 'transfer' AND to_account_id = ? THEN ROUND(COALESCE(to_amount, amount) * 100) / 100
          ELSE 0 
        END), 0) as total_in,
        COALESCE(SUM(CASE 
          WHEN type = 'expense' AND account_id = ? THEN ROUND(amount * 100) / 100
          WHEN type = 'transfer' AND account_id = ? THEN ROUND(amount * 100) / 100
          ELSE 0 
        END), 0) as total_out
      FROM transactions 
      WHERE (account_id = ? OR to_account_id = ?) AND is_active = 1
      `,
      [accountId, accountId, accountId, accountId, accountId, accountId]
    );

    if (!agg) return;

    const balance =
      Math.round(((acc.initial_balance || 0) + (agg.total_in || 0) - (agg.total_out || 0)) * 100) / 100;
    return await run(`UPDATE accounts SET balance = ? WHERE id = ?`, [balance, accountId]);
  },

  getTransactionsPaginated: async (
    options: {
      limit?: number;
      offset?: number;
      activeOnly?: boolean;
      sortBy?: string;
      sortOrder?: string;
      accountId?: number;
      category?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    } = {}
  ) => {
    const limit = Math.min(Math.max(1, options.limit || 50), 500);
    const offset = Math.max(0, options.offset || 0);
    const activeOnly = options.activeOnly !== false;
    const allowedSorts = ['start_date', 'amount', 'category', 'created_at', 'category_name', 'account_name', 'description'];
    const sortBy = allowedSorts.includes(options.sortBy || '') ? options.sortBy : 'start_date';
    const sortOrder = (options.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const params: any[] = [];

    if (activeOnly) conditions.push('t.is_active = 1');
    if (options.accountId) {
      conditions.push('(t.account_id = ? OR t.to_account_id = ?)');
      params.push(options.accountId, options.accountId);
    }
    if (options.category) {
      conditions.push('t.category = ?');
      params.push(options.category);
    }
    if (options.type) {
      conditions.push('t.type = ?');
      params.push(options.type);
    }
    if (options.startDate) {
      conditions.push('t.start_date >= ?');
      params.push(options.startDate);
    }
    if (options.endDate) {
      conditions.push('t.start_date <= ?');
      params.push(options.endDate);
    }
    if (options.search) {
      conditions.push('t.description LIKE ?');
      params.push(`%${options.search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await get<{ total: number }>(
      `SELECT COUNT(*) as total FROM transactions t ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

    const data = await all<TransactionListDTO>(
      `SELECT 
        t.id, 
        t.account_id,
        t.start_date, 
        t.amount, 
        t.description, 
        COALESCE(t.category, 'Uncategorized') as category_name, 
        t.type,
        CASE 
          WHEN t.type = 'transfer' THEN COALESCE(a.name, 'Unknown') || ' → ' || COALESCE(to_a.name, 'Unknown')
          ELSE COALESCE(a.name, 'Unknown Account')
        END as account_name
       FROM transactions t
       LEFT JOIN accounts a ON t.account_id = a.id
       LEFT JOIN accounts to_a ON t.to_account_id = to_a.id
       ${whereClause} 
       ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { data, total, limit, offset, hasMore: offset + data.length < total };
  },

  getTransactionStats: async (options: any = {}) => {
    const conditions = ['t.is_active = 1'];
    const params: any[] = [];

    if (options.startDate) {
      conditions.push('t.start_date >= ?');
      params.push(options.startDate);
    }
    if (options.endDate) {
      conditions.push('t.start_date <= ?');
      params.push(options.endDate);
    }
    if (options.type && options.type !== 'all') {
      conditions.push('t.type = ?');
      params.push(options.type);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const rows = await all<{ currency: string; income: number; expense: number; transfers: number; count: number }>(`
      SELECT 
        COALESCE(a.currency, 'USD') as currency,
        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as expense,
        COALESCE(SUM(CASE WHEN t.type = 'transfer' THEN t.amount ELSE 0 END), 0) as transfers,
        COUNT(*) as count
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      ${whereClause}
      GROUP BY COALESCE(a.currency, 'USD')
    `, params);

    const totalStats = {
      income: 0,
      expense: 0,
      transfers: 0,
      count: 0,
      byCurrency: {} as Record<string, { income: number; expense: number; transfers: number }>
    };

    for (const r of rows) {
      totalStats.income += r.income;
      totalStats.expense += r.expense;
      totalStats.transfers += r.transfers;
      totalStats.count += r.count;

      totalStats.byCurrency[r.currency] = {
        income: r.income,
        expense: r.expense,
        transfers: r.transfers
      };
    }

    return totalStats;
  },

  getBudgetSummary: async () => {
    const budgets = await FinanceModel.getAll<Budget>('budget');
    return budgets.map(b => ({
      ...b,
      spent: 0,
      remaining: b.amount
    }));
  },

  getMonthlyTotals: async (startDate: string, endDate: string, baseCurrency?: string) => {
    if (!baseCurrency) {
      const result = await get<{ income: number; expense: number }>(
        `SELECT 
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
        FROM transactions 
        WHERE start_date BETWEEN ? AND ? AND is_active = 1`,
        [startDate, endDate]
      );
      return result || { income: 0, expense: 0 };
    }

    const rows = await all<{ currency: string; income: number; expense: number }>(
      `SELECT 
        COALESCE(t.currency, ?) as currency,
        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as expense
      FROM transactions t
      WHERE t.start_date BETWEEN ? AND ? AND t.is_active = 1
      GROUP BY COALESCE(t.currency, ?)`,
      [baseCurrency, startDate, endDate, baseCurrency]
    );

    // Use the rate map helper for efficiency
    const rateMap = await getExchangeRateMap();
    let totalIncome = 0;
    let totalExpense = 0;

    for (const row of rows) {
      const rate = row.currency === baseCurrency ? 1 : (rateMap[`${row.currency}-${baseCurrency}`] || 1);
      totalIncome += row.income * rate;
      totalExpense += row.expense * rate;
    }

    return { income: totalIncome, expense: totalExpense };
  },

  getTransactionCount: async (
    options: { activeOnly?: boolean; accountId?: number; type?: string } = {}
  ) => {
    const conditions = [];
    const params = [];
    if (options.activeOnly !== false) conditions.push('is_active = 1');
    if (options.accountId) {
      conditions.push('(account_id = ? OR to_account_id = ?)');
      params.push(options.accountId, options.accountId);
    }
    if (options.type) {
      conditions.push('type = ?');
      params.push(options.type);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await get<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions ${whereClause}`,
      params
    );
    return result?.count || 0;
  },

  getAllTransactions: async () =>
    FinanceModel.getAll<Transaction>('transaction', { orderBy: 'start_date DESC' }),
  getAllAccounts: async () => FinanceModel.getAll<Account>('account'),
  getAllCategories: async () => FinanceModel.getAll<Category>('category'),
  getAllBudgets: async () => FinanceModel.getAll<Budget>('budget'),
  getAllGoals: async () => FinanceModel.getAll<Goal>('goal'),
  getAllRecurringCharges: async () => FinanceModel.getAll<RecurringCharge>('recurringCharge'),

  // Settings
  getAllSettings: async () => {
    const rows = await all<Setting>(`SELECT * FROM settings`);
    const settings: Record<string, string> = {};
    rows.forEach((r) => (settings[r.key] = r.value));
    return settings;
  },

  updateSetting: async (key: string, value: string) => {
    return await run(
      `INSERT INTO settings (key, value, category) VALUES (?, ?, 'general') 
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
      [key, value, value]
    );
  },

  saveSettings: async (settings: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(settings)) {
      await FinanceModel.updateSetting(key, String(value));
    }
    return true;
  },

  getAISettings: async () => {
    const settings = await FinanceModel.getAllSettings();
    return {
      enabled: settings['ai_enabled'] === 'true',
      url: settings['ai_url'] || 'http://127.0.0.1:11434',
      model: settings['ai_model'] || 'gemma3:4b',
      promptTx: settings['ai_prompt_tx'],
      promptInsight: settings['ai_prompt_insight'],
      promptChat: settings['ai_prompt_chat'],
    };
  },

  saveAISettings: async (settings: any) => {
    const dbSettings: any = {};
    if (settings.url) dbSettings.ai_url = settings.url;
    if (settings.model) dbSettings.ai_model = settings.model;
    if (settings.enabled !== undefined) dbSettings.ai_enabled = String(settings.enabled);
    if (settings.promptTx) dbSettings.ai_prompt_tx = settings.promptTx;
    if (settings.promptInsight) dbSettings.ai_prompt_insight = settings.promptInsight;
    if (settings.promptChat) dbSettings.ai_prompt_chat = settings.promptChat;
    return await FinanceModel.saveSettings(dbSettings);
  },

  getAICategoryCorrections: async (limit: number = 20) => {
    await dbInitialized;
    const sql = `
      SELECT th.old_data, th.new_data, t.description
      FROM transaction_history th
      JOIN transactions t ON th.transaction_id = t.id
      WHERE th.action = 'UPDATE' 
        AND th.source = 'USER'
        AND (JSON_EXTRACT(th.old_data, '$.category') != JSON_EXTRACT(th.new_data, '$.category'))
        AND EXISTS (
          SELECT 1 FROM transaction_history th2 
          WHERE th2.transaction_id = th.transaction_id 
            AND th2.action = 'CREATE' 
            AND th2.source = 'AI'
        )
      ORDER BY th.changed_at DESC
      LIMIT ?
    `;
    const rows = await all<any>(sql, [limit]);
    return rows.map((row) => {
      const oldData = JSON.parse(row.old_data || '{}');
      const newData = JSON.parse(row.new_data || '{}');
      return {
        original: oldData.category,
        corrected: newData.category,
        description: row.description,
      };
    });
  },

  // Goals
  contributeToGoal: async (
    goalId: number,
    amount: number,
    source: string | null = null,
    notes: string | null = null
  ) => {
    amount = validateAmount(amount);
    await FinanceModel.create('goalContribution', { goal_id: goalId, amount, source, notes });

    const goal = await get<Goal>(`SELECT current_amount, target_amount FROM goals WHERE id = ?`, [goalId]);
    if (!goal) throw new Error('Goal not found');

    const newAmount = Math.round(((goal.current_amount || 0) + amount) * 100) / 100;

    const updates: any = { current_amount: newAmount };
    if (newAmount >= goal.target_amount) {
      updates.status = 'completed';
    }
    return await FinanceModel.update('goal', goalId, updates);
  },

  getGoalContributions: async (goalId: number) => {
    return await all<GoalContribution>(
      `SELECT * FROM goal_contributions WHERE goal_id = ? ORDER BY contributed_at DESC`,
      [goalId]
    );
  },

  getGoalsSummary: async () => {
    const baseCurrency = await getBaseCurrency();
    const goals = await all<Goal & { currency?: string }>(`SELECT * FROM goals WHERE status = 'active'`);
    const rateMap = await getExchangeRateMap();

    let totalTarget = 0;
    let totalSaved = 0;
    let totalMonthlyContribution = 0;

    for (const goal of goals) {
      const rate = await convertToBase(1, goal.currency || baseCurrency, baseCurrency, rateMap);

      totalTarget += goal.target_amount * rate;
      totalSaved += goal.current_amount * rate;
      totalMonthlyContribution += (goal.monthly_contribution || 0) * rate;
    }

    return {
      activeGoals: goals.length,
      totalTarget,
      totalSaved,
      totalProgress: totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0,
      totalMonthlyContribution,
    };
  },

  getAvailableForGoals: async () => {
    const baseCurrency = await getBaseCurrency();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const startDate = DateUtils.toDateString(threeMonthsAgo);

    const incomeByCurrency = await all<{ currency: string; total: number }>(
      `SELECT 
        COALESCE(currency, 'USD') as currency, 
        COALESCE(SUM(amount), 0) as total 
      FROM transactions 
      WHERE type = 'income' AND start_date >= ? AND is_active = 1
      GROUP BY COALESCE(currency, 'USD')`,
      [startDate]
    );

    const rateMap = await getExchangeRateMap();
    let totalIncome = 0;
    for (const row of incomeByCurrency) {
      totalIncome += await convertToBase(row.total, row.currency, baseCurrency, rateMap);
    }

    const avgMonthlyIncome = totalIncome / 3;
    const recurringTotal = await FinanceModel.getMonthlyRecurringTotal();
    const goalsSummary = await FinanceModel.getGoalsSummary();

    return {
      avgMonthlyIncome,
      recurringCharges: recurringTotal,
      goalContributions: goalsSummary.totalMonthlyContribution,
      available: avgMonthlyIncome - recurringTotal - goalsSummary.totalMonthlyContribution,
    };
  },

  getMonthlyRecurringTotal: async () => {
    const baseCurrency = await getBaseCurrency();
    const charges = await all<RecurringCharge & { currency?: string }>(
      `SELECT amount, frequency, currency FROM recurring_charges WHERE is_active = 1`
    );

    const rateMap = await getExchangeRateMap();
    let monthlyTotal = 0;

    for (const c of charges) {
      const convertedAmount = await convertToBase(c.amount, c.currency || baseCurrency, baseCurrency, rateMap);

      if (c.frequency === 'weekly') monthlyTotal += convertedAmount * 4.33;
      else if (c.frequency === 'monthly') monthlyTotal += convertedAmount;
      else if (c.frequency === 'yearly') monthlyTotal += convertedAmount / 12;
    }

    return Math.round(monthlyTotal * 100) / 100;
  },

  // Bills
  getBillTypes: async () => {
    return await all<BillType & { account_name: string }>(`
      SELECT b.*, a.name as account_name 
      FROM bill_types b
      LEFT JOIN accounts a ON b.account_id = a.id
      ORDER BY b.name ASC
    `);
  },

  getBillReadings: async (
    filters: { bill_type_id?: number; year?: number; month?: number } = {}
  ) => {
    let sql = `
      SELECT r.id, r.bill_type_id, r.date as reading_date, r.units_used as usage_amount,
             r.total_cost as cost, 0 as is_paid, NULL as paid_at, r.notes, r.created_at,
             b.name as bill_name, b.unit_name, b.color, b.icon, b.category_name
      FROM bill_readings r
      JOIN bill_types b ON r.bill_type_id = b.id
    `;
    const params: any[] = [];
    const conditions = [];

    if (filters.bill_type_id) {
      conditions.push('r.bill_type_id = ?');
      params.push(filters.bill_type_id);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY r.date DESC';
    return await all<any>(sql, params);
  },

  getBillReadingsPaginated: async (options: any) => {
    return { data: [], total: 0, limit: options.limit || 50, offset: options.offset || 0, hasMore: false };
  },

  getBillProjections: async () => {
    const billTypes = await all<any>(`
      SELECT 
        bt.id, bt.name, bt.color, bt.cost_per_unit,
        AVG(br.total_cost) as avg_cost,
        AVG(br.units_used) as avg_units
      FROM bill_types bt
      LEFT JOIN bill_readings br ON bt.id = br.bill_type_id
      WHERE bt.deleted_at IS NULL
      GROUP BY bt.id
    `);

    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const lastMonthRaw = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastMonthRaw.toISOString().slice(0, 7);

    const actuals = await all<any>(`
      SELECT 
        bill_type_id,
        SUM(CASE WHEN strftime('%Y-%m', date) = ? THEN total_cost ELSE 0 END) as this_month,
        SUM(CASE WHEN strftime('%Y-%m', date) = ? THEN total_cost ELSE 0 END) as last_month
      FROM bill_readings
      GROUP BY bill_type_id
    `, [thisMonth, lastMonth]);

    return billTypes.map(bt => {
      const actual = actuals.find(a => a.bill_type_id === bt.id);
      return {
        name: bt.name,
        color: bt.color || '#7c3aed',
        projected_cost: bt.avg_cost || (bt.avg_units || 0) * (bt.cost_per_unit || 0),
        this_month_actual: actual?.this_month || 0,
        last_month_actual: actual?.last_month || 0
      };
    });
  },

  getExchangeRates: async () => {
    return all<any>(`SELECT * FROM exchange_rates ORDER BY from_currency, to_currency`);
  },

  getExchangeRate: async (from: string, to: string): Promise<number | null> => {
    if (from === to) return 1;

    const directRate = await get<{ rate: number }>(`
      SELECT rate FROM exchange_rates WHERE from_currency = ? AND to_currency = ?
    `, [from, to]);
    if (directRate?.rate) return directRate.rate;

    const reverseRate = await get<{ rate: number }>(`
      SELECT rate FROM exchange_rates WHERE from_currency = ? AND to_currency = ?
    `, [to, from]);
    if (reverseRate?.rate && reverseRate.rate !== 0) {
      return 1 / reverseRate.rate;
    }

    return null;
  },

  setExchangeRate: async (from: string, to: string, rate: number, source: string) => {
    await run(`
      INSERT INTO exchange_rates (from_currency, to_currency, rate, source, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(from_currency, to_currency) DO UPDATE SET
        rate = excluded.rate,
        source = excluded.source,
        updated_at = CURRENT_TIMESTAMP
    `, [from, to, rate, source]);
    return { success: true };
  },

  setExchangeRatesBulk: async (rates: Array<{ from: string; to: string; rate: number }>, source: string) => {
    for (const { from, to, rate } of rates) {
      await FinanceModel.setExchangeRate(from, to, rate, source);
    }
    return true;
  },

  convertCurrency: async (amount: number, from: string, to: string) => {
    const rate = await FinanceModel.getExchangeRate(from, to);
    return rate ? amount * rate : null;
  },

  getUsedCurrencies: async () => {
    const currencies = await all<{ currency: string }>(`
      SELECT DISTINCT currency FROM accounts WHERE deleted_at IS NULL
      UNION
      SELECT DISTINCT currency FROM transactions WHERE deleted_at IS NULL
    `);
    return currencies.length > 0 ? currencies.map(c => c.currency) : ['USD'];
  },

  getAccountsWithConvertedBalances: async (baseCurrency: string) => {
    const accounts = await FinanceModel.getAllAccounts();
    const rateMap = await getExchangeRateMap();
    const result = [];

    for (const acc of accounts) {
      const rate = rateMap[`${acc.currency || 'USD'}-${baseCurrency}`];
      const convertedBalance = rate ? (acc.balance || 0) * rate : (acc.currency === baseCurrency ? acc.balance : null);

      result.push({ ...acc, converted_balance: convertedBalance });
    }
    return result;
  },

  getRateSyncStatus: async () => {
    const settings = await FinanceModel.getAllSettings();
    const lastSync = settings.currency_last_sync || null;
    const autoSync = settings.currency_auto_sync === 'true';
    const rateCount = await get<{ count: number }>(`SELECT COUNT(*) as count FROM exchange_rates`);

    let hoursSinceSync = 0;
    let isStale = true;
    if (lastSync) {
      const lastSyncDate = new Date(lastSync);
      hoursSinceSync = (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60);
      isStale = hoursSinceSync > 24;
    }

    return { lastSync, autoSync, rateCount: rateCount?.count || 0, hoursSinceSync, isStale };
  },

  getTotalBalanceInBaseCurrency: async (baseCurrency: string) => {
    const accounts = await FinanceModel.getAccountsWithConvertedBalances(baseCurrency);
    return accounts.reduce((sum, a) => sum + (a.converted_balance || 0), 0);
  },

  getCategoryStats: async () => {
    const baseCurrency = await getBaseCurrency();
    const rows = await all<{
      id: number;
      name: string;
      type: string;
      color: string;
      icon: string;
      currency: string;
      transaction_count: number;
      total_amount: number;
    }>(`
      SELECT c.id, c.name, c.type, c.color, c.icon,
        COALESCE(t.currency, ?) as currency,
        COUNT(t.id) as transaction_count,
        COALESCE(SUM(t.amount), 0) as total_amount
      FROM categories c
      LEFT JOIN transactions t ON t.category_id = c.id AND t.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
      GROUP BY c.id, COALESCE(t.currency, ?)
      ORDER BY c.name
    `, [baseCurrency, baseCurrency]);

    const rateMap = await getExchangeRateMap();
    const categoryMap = new Map<number, any>();

    for (const row of rows) {
      const convertedAmount = await convertToBase(row.total_amount, row.currency, baseCurrency, rateMap);

      const existing = categoryMap.get(row.id);
      if (existing) {
        existing.transaction_count += row.transaction_count;
        existing.total_amount += convertedAmount;
      } else {
        categoryMap.set(row.id, {
          id: row.id,
          name: row.name,
          type: row.type,
          color: row.color,
          icon: row.icon,
          transaction_count: row.transaction_count,
          total_amount: convertedAmount,
        });
      }
    }

    const result = Array.from(categoryMap.values());
    result.sort((a, b) => b.total_amount - a.total_amount);

    return result.map(cat => ({
      ...cat,
      avg_amount: cat.transaction_count > 0 ? cat.total_amount / cat.transaction_count : 0,
    }));
  },

  getDashboardData: async (months: number = 6) => {
    const labels: string[] = [];
    const income: number[] = [];
    const expenses: number[] = [];
    const netWorth: number[] = [];

    const baseCurrency = await getBaseCurrency();
    const rateMap = await getExchangeRateMap();

    const now = new Date();
    const firstMonthStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const startStr = firstMonthStart.toISOString().split('T')[0];

    // Initial Balance from Accounts
    const accounts = await FinanceModel.getAllAccounts();
    let initialAccountBalance = 0;
    for (const a of accounts) {
      const rate = rateMap[`${a.currency || 'USD'}-${baseCurrency}`] || 0;
      initialAccountBalance += (a.initial_balance || 0) * rate;
    }

    // Net Change from transactions before start date
    const prePeriodStats = await all<{ currency: string; income: number; expense: number }>(`
      SELECT 
        COALESCE(currency, ?) as currency, 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
      FROM transactions 
      WHERE is_active = 1 AND start_date < ?
      GROUP BY COALESCE(currency, ?)
    `, [baseCurrency, startStr, baseCurrency]);

    let prePeriodNetChange = 0;
    for (const row of prePeriodStats) {
      const convertedIncome = await convertToBase(row.income, row.currency, baseCurrency, rateMap);
      const convertedExpense = await convertToBase(row.expense, row.currency, baseCurrency, rateMap);
      prePeriodNetChange += (convertedIncome - convertedExpense);
    }

    let runningNetWorth = initialAccountBalance + prePeriodNetChange;

    for (let i = months - 1; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      labels.push(monthLabel);

      const mStartStr = monthDate.toISOString().split('T')[0];
      const mEndStr = monthEnd.toISOString().split('T')[0];

      const totals = await FinanceModel.getMonthlyTotals(mStartStr, mEndStr, baseCurrency);
      income.push(totals.income || 0);
      expenses.push(totals.expense || 0);

      const monthNetChange = (totals.income || 0) - (totals.expense || 0);
      runningNetWorth += monthNetChange;
      netWorth.push(runningNetWorth);
    }

    return {
      labels,
      income,
      expenses,
      netWorth,
      summary: {
        totalIncome: income.reduce((a, b) => a + b, 0),
        totalExpense: expenses.reduce((a, b) => a + b, 0),
      }
    };
  },

  getCategorySpending: async (startDate: string, endDate: string) => {
    return all<{ category: string; amount: number; color: string; icon: string }>(`
      SELECT 
        COALESCE(c.name, t.category) as category,
        c.color,
        c.icon,
        SUM(t.amount) as amount
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'expense' 
        AND t.deleted_at IS NULL
        AND t.start_date BETWEEN ? AND ?
        AND t.is_active = 1
      GROUP BY COALESCE(c.name, t.category)
      ORDER BY amount DESC
    `, [startDate, endDate]);
  },

  exportData: async () => {
    const accounts = await all(`SELECT * FROM accounts WHERE deleted_at IS NULL`);
    const categories = await all(`SELECT * FROM categories WHERE deleted_at IS NULL`);
    const transactions = await all(`SELECT * FROM transactions WHERE deleted_at IS NULL`);
    const budgets = await all(`SELECT * FROM budgets WHERE deleted_at IS NULL`);
    const goals = await all(`SELECT * FROM goals WHERE deleted_at IS NULL`);
    const recurringCharges = await all(`SELECT * FROM recurring_charges WHERE deleted_at IS NULL`);
    const billTypes = await all(`SELECT * FROM bill_types WHERE deleted_at IS NULL`);
    const billReadings = await all(`SELECT * FROM bill_readings`);
    const exchangeRates = await all(`SELECT * FROM exchange_rates`);
    const settings = await all(`SELECT * FROM settings`);

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      data: {
        accounts,
        categories,
        transactions,
        budgets,
        goals,
        recurringCharges,
        billTypes,
        billReadings,
        exchangeRates,
        settings,
      }
    };
  },

  /**
   * Get estimated database size in bytes using SQLite pragmas.
   */
  getDatabaseSize: async (): Promise<number> => {
    const result = await get<{ size: number }>(
      `SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()`
    );
    return result?.size || 0;
  },

  /**
   * Export tables info for chunked export.
   * Returns table names and their row counts.
   */
  getExportTableInfo: async (): Promise<Array<{ table: string; count: number; whereClause: string }>> => {
    const tables = [
      { table: 'accounts', whereClause: 'deleted_at IS NULL' },
      { table: 'categories', whereClause: 'deleted_at IS NULL' },
      { table: 'transactions', whereClause: 'deleted_at IS NULL' },
      { table: 'budgets', whereClause: 'deleted_at IS NULL' },
      { table: 'goals', whereClause: 'deleted_at IS NULL' },
      { table: 'recurring_charges', whereClause: 'deleted_at IS NULL' },
      { table: 'bill_types', whereClause: 'deleted_at IS NULL' },
      { table: 'bill_readings', whereClause: '1=1' },
      { table: 'exchange_rates', whereClause: '1=1' },
      { table: 'settings', whereClause: '1=1' },
    ];

    const result = [];
    for (const t of tables) {
      const countResult = await get<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${t.table} WHERE ${t.whereClause}`
      );
      result.push({ ...t, count: countResult?.count || 0 });
    }
    return result;
  },

  /**
   * Export a chunk of data from a specific table.
   * Used for memory-efficient exports of large databases.
   */
  exportTableChunk: async (table: string, whereClause: string, limit: number, offset: number): Promise<unknown[]> => {
    return await all(`SELECT * FROM ${table} WHERE ${whereClause} LIMIT ? OFFSET ?`, [limit, offset]);
  },

  importData: async (jsonData: any) => {
    if (!jsonData.version || !jsonData.data) {
      return { success: false, error: 'Invalid export format' };
    }
    return { success: true, message: 'Import functionality requires full implementation' };
  },

  exportAllToCSV: async () => {
    const transactions = await all<any>(`
      SELECT 
        t.id, t.type, t.amount, t.description, t.start_date,
        COALESCE(c.name, t.category) as category,
        a.name as account_name, t.currency
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.deleted_at IS NULL
      ORDER BY t.start_date DESC
    `);

    if (transactions.length === 0) {
      return 'id,type,amount,description,date,category,account,currency\n';
    }

    const headers = ['id', 'type', 'amount', 'description', 'date', 'category', 'account', 'currency'];
    const rows = transactions.map(t => [
      t.id,
      t.type,
      t.amount,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.start_date,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      `"${(t.account_name || '').replace(/"/g, '""')}"`,
      t.currency || 'USD'
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }
};