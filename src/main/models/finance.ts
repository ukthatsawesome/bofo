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
import { SETTING_KEYS, SETTING_CATEGORIES } from '../../shared/settings/keys';
import { AI_DEFAULTS } from '../config/AIConfig';
import { DEFAULT_SETTINGS, DEFAULT_CURRENCY } from '../../shared/settings/defaults';

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
  return settings[SETTING_KEYS.CURRENCY.BASE] || DEFAULT_CURRENCY;
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

export type EntityType =
  | 'transaction'
  | 'account'
  | 'category'
  | 'budget'
  | 'goal'
  | 'recurringCharge'
  | 'billType'
  | 'billReading'
  | 'exchangeRate'
  | 'setting'
  | 'goalContribution';

interface EntitySchema<T> {
  table: string;
  fields: string[];
  defaults?: Partial<T>;
  orderBy?: string;
  checkInUse?: (id: number) => Promise<boolean>;
  beforeWrite?: (data: T, isCreate: boolean) => Promise<T>;
  afterWrite?: (data: T & { id?: number }) => Promise<void>;
  afterDelete?: (data: T) => Promise<void>;
}

const ENTITY_SCHEMAS: Record<EntityType, EntitySchema<any>> = {
  transaction: {
    table: 'transactions',
    fields: [
      'account_id', 'to_account_id', 'type', 'category', 'category_id',
      'amount', 'description', 'attachment', 'frequency', 'start_date',
      'end_date', 'currency', 'exchange_rate', 'to_amount', 'base_currency',
      'base_amount', 'tags', 'is_active',
    ],
    defaults: { frequency: 'once', is_active: 1, tags: '', exchange_rate: 1 },
    orderBy: 'start_date DESC',
    beforeWrite: async (data: Transaction, isCreate: boolean) => {
      // Fetch user's preference for base currency from settings
      const setting = await get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [SETTING_KEYS.CURRENCY.BASE]);
      const BASE_CURRENCY = setting?.value || DEFAULT_CURRENCY;

      // 1. Handle Transfer Category
      if (data.type === 'transfer') {
        let transferCat = await get<Category>(`SELECT * FROM categories WHERE type = 'transfer' AND name = 'Transfer' LIMIT 1`);
        if (!transferCat) {
          const result = await run(`INSERT INTO categories (type, name, status, color, icon) VALUES ('transfer', 'Transfer', 'active', '#2563eb', 'arrow-right-left')`);
          transferCat = { id: result.id, name: 'Transfer', type: 'transfer' } as Category;
        }
        data.category = transferCat.name;
        data.category_id = transferCat.id;
      }

      // 2. Handle Currency Conversion & Exchange Rates
      if (data.account_id) {
        // Fetch source account
        const sourceAcc = await get<Account>('SELECT currency FROM accounts WHERE id = ?', [data.account_id]);

        if (sourceAcc) {
          // Set transaction currency to account currency if available, else fallback to user's base currency
          data.currency = sourceAcc.currency || BASE_CURRENCY;

          // If Transfer, check destination account
          if (data.type === 'transfer' && data.to_account_id) {
            const destAcc = await get<Account>('SELECT currency FROM accounts WHERE id = ?', [data.to_account_id]);
            if (destAcc) {
              if (destAcc.currency !== sourceAcc.currency) {
                // Currency Mismatch: Use getExchangeRate which handles direct + reverse lookups
                const rate = await FinanceModel.getExchangeRate(sourceAcc.currency, destAcc.currency) || 1;
                // If user provided a specific rate for this transaction, use it, otherwise use DB rate
                if (!data.exchange_rate || data.exchange_rate === 1) {
                  data.exchange_rate = rate;
                }

                // Calculate to_amount
                data.to_amount = Math.round(data.amount * data.exchange_rate * 100) / 100;
              } else {
                // Same currency
                data.exchange_rate = 1;
                data.to_amount = data.amount;
              }
            }
          } else {
            // Not a transfer, or no dest account
            data.to_amount = null; // Ensure null if not transfer
          }

          // 3. Base Currency Normalization (for aggregation)
          if (data.currency === BASE_CURRENCY) {
            data.base_amount = data.amount;
            data.base_currency = BASE_CURRENCY;
          } else {
            const toBaseRate = await FinanceModel.getExchangeRate(data.currency, BASE_CURRENCY);
            if (toBaseRate) {
              data.base_amount = Math.round(data.amount * toBaseRate * 100) / 100;
            } else {
              // Fallback: If no rate found, keep as is (imperfect, but better than 0)
              data.base_amount = data.amount;
            }
            data.base_currency = BASE_CURRENCY;
          }
        }
      }

      return data;
    },
    afterWrite: async (data: Transaction) => {
      // Balance sync handled by application code (after Migration 25 removed triggers)
      if (data.account_id) {
        await FinanceModel.syncAccountBalance(data.account_id);
      }
      if (data.to_account_id) {
        await FinanceModel.syncAccountBalance(data.to_account_id);
      }
    },
    afterDelete: async (data: Transaction) => {
      // Balance sync handled by application code (after Migration 25 removed triggers)
      if (data.account_id) {
        await FinanceModel.syncAccountBalance(data.account_id);
      }
      if (data.to_account_id) {
        await FinanceModel.syncAccountBalance(data.to_account_id);
      }
    }
  },
  account: {
    table: 'accounts',
    fields: ['name', 'type', 'balance', 'initial_balance', 'currency', 'status'],
    defaults: { status: 'active', balance: 0 },
    beforeWrite: async (data: Account) => {
      if (!data.currency) {
        const setting = await get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [SETTING_KEYS.CURRENCY.BASE]);
        data.currency = setting?.value || DEFAULT_CURRENCY;
      }
      // If initial_balance is not set but balance is provided, use balance as initial
      if (data.initial_balance === undefined && data.balance !== undefined) {
        data.initial_balance = data.balance;
      }
      return data;
    },
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
    defaults: { period: 'monthly' },
    beforeWrite: async (data: Budget) => {
      if (!data.currency) {
        const setting = await get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [SETTING_KEYS.CURRENCY.BASE]);
        data.currency = setting?.value || DEFAULT_CURRENCY;
      }
      return data;
    },
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
      priority: 1, status: 'active', auto_contribute: 0,
    },
    beforeWrite: async (data: Goal) => {
      if (!data.currency) {
        const setting = await get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [SETTING_KEYS.CURRENCY.BASE]);
        data.currency = setting?.value || DEFAULT_CURRENCY;
      }
      return data;
    },
    orderBy: 'priority ASC, created_at DESC',
  },
  recurringCharge: {
    table: 'recurring_charges',
    fields: [
      'category', 'category_id', 'name', 'amount', 'frequency', 'due_day',
      'next_due_date', 'is_active', 'notes', 'currency',
    ],
    defaults: { frequency: 'monthly', due_day: 1, is_active: 1 },
    beforeWrite: async (data: RecurringCharge) => {
      if (!data.currency) {
        const setting = await get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [SETTING_KEYS.CURRENCY.BASE]);
        data.currency = setting?.value || DEFAULT_CURRENCY;
      }
      return data;
    },
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
      icon: 'file-text', color: '#7c3aed',
    },
    beforeWrite: async (data: BillType) => {
      if (!data.currency) {
        const setting = await get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [SETTING_KEYS.CURRENCY.BASE]);
        data.currency = setting?.value || DEFAULT_CURRENCY;
      }
      return data;
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
  createInternal: async (entityType: EntityType, data: any, auditContext: any): Promise<{ id: number; changes: number }> => {
    const schema = ENTITY_SCHEMAS[entityType];
    if (!schema) throw new Error(`Unknown entity type: ${entityType}`);

    const validator = (EntityValidators as any)[entityType];
    if (validator) data = validator(data, true);

    if (schema.beforeWrite) {
      data = await schema.beforeWrite(data, true);
    }



    // Resolve category name from category_id for transactions
    if (entityType === 'transaction' && data.category_id && (!data.category || data.category === 'Uncategorized')) {
      const cat = await get<{ name: string }>('SELECT name FROM categories WHERE id = ?', [data.category_id]);
      if (cat) data.category = cat.name;
    }

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
  create: async (entityType: EntityType, data: any, auditContext: { source?: string; metadata?: any; skipAudit?: boolean } = {}): Promise<{ id: number; changes: number }> => {
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
    entityType: EntityType,
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
    entityType: EntityType,
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
  getById: async (entityType: EntityType, id: number): Promise<any> => {
    await dbInitialized;
    const schema = ENTITY_SCHEMAS[entityType];
    if (!schema) throw new Error(`Unknown entity type: ${entityType}`);
    return await get(`SELECT * FROM ${schema.table} WHERE id = ?`, [id]);
  },

  /**
   * Log an audit event
   */
  logAudit: async (
    entityType: EntityType,
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

  getAuditLogs: async (options: { limit?: number; offset?: number; source?: string } = {}) => {
    const limit = Math.min(Math.max(1, options.limit || 50), 100);
    const offset = Math.max(0, options.offset || 0);
    const conditions = [];
    const params = [];

    if (options.source) {
      conditions.push('source = ?');
      params.push(options.source);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await all<any>(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const countResult = await get<{ count: number }>(
      `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
      params
    );

    return {
      data: rows.map(r => ({
        ...r,
        changes: r.changes ? JSON.parse(r.changes) : null,
        metadata: r.metadata ? JSON.parse(r.metadata) : null
      })),
      total: countResult?.count || 0,
      limit,
      offset
    };
  },

  /**
   * Get all entities of a type
   */
  getAll: async <T = any>(
    entityType: EntityType,
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

  archive: async (entityType: EntityType, id: number) => {
    return await FinanceModel.update(entityType, id, { status: 'archived' });
  },

  unarchive: async (entityType: EntityType, id: number) => {
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

  /**
   * Recalculate balances for ALL accounts.
   * Use this to fix balances after removing triggers or correcting duplicate calculations.
   */
  recalculateAllBalances: async () => {
    await dbInitialized;
    const accounts = await FinanceModel.getAllAccounts();
    const results: Array<{ accountId: number; oldBalance: number; newBalance: number }> = [];

    for (const account of accounts) {
      const oldBalance = account.balance;

      // Recalculate this account's balance
      await FinanceModel.syncAccountBalance(account.id);

      // Fetch the new balance
      const updated = await get<Account>(`SELECT balance FROM accounts WHERE id = ?`, [account.id]);
      const newBalance = updated?.balance || 0;

      results.push({
        accountId: account.id,
        oldBalance: oldBalance || 0,
        newBalance
      });
    }

    return results;
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
        t.to_account_id,
        t.category_id,
        t.category,
        t.start_date, 
        t.amount,
        t.to_amount,
        t.exchange_rate,
        t.currency,
        t.description, 
        CASE 
          WHEN t.type = 'transfer' THEN 'Transfer'
          ELSE COALESCE(c.name, t.category, 'Uncategorized')
        END as category_name, 
        t.type,
        CASE 
          WHEN t.type = 'transfer' THEN COALESCE(a.name, 'Unknown') || ' → ' || COALESCE(to_a.name, 'Unknown')
          ELSE COALESCE(a.name, 'Unknown Account')
        END as account_name
       FROM transactions t
       LEFT JOIN accounts a ON t.account_id = a.id
       LEFT JOIN accounts to_a ON t.to_account_id = to_a.id
       LEFT JOIN categories c ON t.category_id = c.id
       ${whereClause} 
       ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { data, total, limit, offset, hasMore: offset + data.length < total };
  },

  /**
   * Get single transaction with full details (joins)
   */
  getTransactionById: async (id: number): Promise<TransactionListDTO | null> => {
    const rows = await all<TransactionListDTO>(
      `SELECT 
        t.id, 
        t.account_id,
        t.to_account_id,
        t.category_id,
        t.category,
        t.start_date, 
        t.amount,
        t.to_amount,
        t.exchange_rate,
        t.currency,
        t.base_currency,
        t.base_amount,
        t.description, 
        CASE 
          WHEN t.type = 'transfer' THEN 'Transfer'
          ELSE COALESCE(c.name, t.category, 'Uncategorized')
        END as category_name, 
        t.type,
        CASE 
          WHEN t.type = 'transfer' THEN COALESCE(a.name, 'Unknown') || ' → ' || COALESCE(to_a.name, 'Unknown')
          ELSE COALESCE(a.name, 'Unknown Account')
        END as account_name
       FROM transactions t
       LEFT JOIN accounts a ON t.account_id = a.id
       LEFT JOIN accounts to_a ON t.to_account_id = to_a.id
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.id = ?`,
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
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
        COALESCE(a.currency, '${DEFAULT_CURRENCY}') as currency,
        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as expense,
        COALESCE(SUM(CASE WHEN t.type = 'transfer' THEN t.amount ELSE 0 END), 0) as transfers,
        COUNT(*) as count
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      ${whereClause}
      GROUP BY COALESCE(a.currency, '${DEFAULT_CURRENCY}')
    `, params);

    const totalStats = {
      income: 0,
      expense: 0,
      transfers: 0,
      count: 0,
      byCurrency: {} as Record<string, { income: number; expense: number; transfers: number }>
    };

    const baseCurrency = await getBaseCurrency();
    const rateMap = await getExchangeRateMap();

    for (const r of rows) {
      const rate = r.currency === baseCurrency ? 1 : (rateMap[`${r.currency}-${baseCurrency}`] || 1);

      const convIncome = r.income * rate;
      const convExpense = r.expense * rate;
      const convTransfers = r.transfers * rate;

      totalStats.income += convIncome;
      totalStats.expense += convExpense;
      totalStats.transfers += convTransfers;
      totalStats.count += r.count;

      totalStats.byCurrency[r.currency] = {
        income: r.income,
        expense: r.expense,
        transfers: r.transfers
      };
    }

    // Top Categories (Calculated in base currency)
    const catRows = await all<{ category: string; amount: number; currency: string }>(`
      SELECT 
        COALESCE(c.name, t.category) as category,
        t.amount,
        COALESCE(t.currency, '${DEFAULT_CURRENCY}') as currency
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      ${whereClause} AND t.type = 'expense'
    `, params);

    const catStats: Record<string, number> = {};
    for (const row of catRows) {
      const rate = row.currency === baseCurrency ? 1 : (rateMap[`${row.currency}-${baseCurrency}`] || 1);
      const convAmount = row.amount * rate;
      catStats[row.category] = (catStats[row.category] || 0) + convAmount;
    }

    const topCategories = Object.entries(catStats)
      .map(([category, amount]) => ({
        category,
        amount,
        percent: totalStats.expense > 0 ? ((amount / totalStats.expense) * 100).toFixed(1) : '0'
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return { ...totalStats, topCategories };
  },

  getBudgetSummary: async () => {
    const budgets = await FinanceModel.getAll<Budget>('budget');
    const baseCurrency = await getBaseCurrency();
    const rateMap = await getExchangeRateMap();

    const results = [];
    for (const b of budgets) {
      const rows = await all<{ amount: number; currency: string }>(`
        SELECT t.amount, COALESCE(t.currency, ?) as currency
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.type = 'expense' AND t.is_active = 1 AND t.deleted_at IS NULL
          AND COALESCE(c.name, t.category) = ?
          AND t.start_date BETWEEN ? AND ?
      `, [baseCurrency, b.category, b.start_date, b.end_date]);

      let spent = 0;
      for (const r of rows) {
        spent += await convertToBase(r.amount, r.currency, baseCurrency, rateMap);
      }
      results.push({ ...b, spent, remaining: b.amount - spent });
    }
    return results;
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
    const defaultSetting = DEFAULT_SETTINGS.find(s => s.key === key);
    const category = defaultSetting?.category || 'general';

    return await run(
      `INSERT INTO settings (key, value, category) VALUES (?, ?, ?) 
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
      [key, value, category, value]
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
      enabled: settings[SETTING_KEYS.AI.ENABLED] === 'true',
      url: settings[SETTING_KEYS.AI.URL] || AI_DEFAULTS.URL,
      model: settings[SETTING_KEYS.AI.MODEL] || AI_DEFAULTS.MODEL,
      promptTx: settings[SETTING_KEYS.AI.PROMPT_TX],
      promptInsight: settings[SETTING_KEYS.AI.PROMPT_INSIGHT],
      promptChat: settings[SETTING_KEYS.AI.PROMPT_CHAT],
    };
  },

  saveAISettings: async (settings: any) => {
    const dbSettings: any = {};
    if (settings.url) dbSettings[SETTING_KEYS.AI.URL] = settings.url;
    if (settings.model) dbSettings[SETTING_KEYS.AI.MODEL] = settings.model;
    if (settings.enabled !== undefined) dbSettings[SETTING_KEYS.AI.ENABLED] = String(settings.enabled);
    if (settings.promptTx) dbSettings[SETTING_KEYS.AI.PROMPT_TX] = settings.promptTx;
    if (settings.promptInsight) dbSettings[SETTING_KEYS.AI.PROMPT_INSIGHT] = settings.promptInsight;
    if (settings.promptChat) dbSettings[SETTING_KEYS.AI.PROMPT_CHAT] = settings.promptChat;
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
    const startDate = DateUtils.toISODateString(threeMonthsAgo);

    const incomeByCurrency = await all<{ currency: string; total: number }>(
      `SELECT 
        COALESCE(currency, '${DEFAULT_CURRENCY}') as currency, 
        COALESCE(SUM(amount), 0) as total 
      FROM transactions 
      WHERE type = 'income' AND start_date >= ? AND is_active = 1
      GROUP BY COALESCE(currency, '${DEFAULT_CURRENCY}')`,
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

    // Cross-rate: find a common intermediary currency X where X→from and X→to both exist
    // e.g., NPR→SGD and NPR→USD exist → SGD→USD = (NPR→USD) / (NPR→SGD)
    const crossRate = await get<{ rate_to: number; rate_from: number }>(`
      SELECT r1.rate as rate_from, r2.rate as rate_to
      FROM exchange_rates r1
      JOIN exchange_rates r2 ON r1.from_currency = r2.from_currency
      WHERE r1.to_currency = ? AND r2.to_currency = ?
      LIMIT 1
    `, [from, to]);
    if (crossRate?.rate_from && crossRate.rate_from !== 0) {
      return crossRate.rate_to / crossRate.rate_from;
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
    const valid = currencies.map(c => c.currency).filter(Boolean);
    return valid.length > 0 ? valid : [DEFAULT_CURRENCY];
  },

  getAccountsWithConvertedBalances: async (baseCurrency: string) => {
    const accounts = await FinanceModel.getAllAccounts();
    const rateMap = await getExchangeRateMap();
    const result = [];

    for (const acc of accounts) {
      const currency = acc.currency || baseCurrency;
      if (currency === baseCurrency) {
        result.push({ ...acc, converted_balance: acc.balance || 0 });
        continue;
      }
      const rate = rateMap[`${currency}-${baseCurrency}`];
      const convertedBalance = rate != null ? (acc.balance || 0) * rate : (acc.balance || 0);
      result.push({ ...acc, converted_balance: convertedBalance });
    }
    return result;
  },

  getRateSyncStatus: async () => {
    const settings = await FinanceModel.getAllSettings();
    const lastSync = settings[SETTING_KEYS.CURRENCY.LAST_SYNC] || null;
    const autoSync = settings[SETTING_KEYS.CURRENCY.AUTO_SYNC] === 'true';
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
      const rate = rateMap[`${a.currency || DEFAULT_CURRENCY}-${baseCurrency}`] || 0;
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
    const baseCurrency = await getBaseCurrency();
    const rows = await all<{
      category: string;
      amount: number;
      color: string;
      icon: string;
      currency: string;
    }>(`
      SELECT 
        COALESCE(c.name, t.category) as category,
        c.color,
        c.icon,
        COALESCE(t.currency, ?) as currency,
        SUM(t.amount) as amount
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'expense' 
        AND t.deleted_at IS NULL
        AND t.start_date BETWEEN ? AND ?
        AND t.is_active = 1
      GROUP BY COALESCE(c.name, t.category), COALESCE(t.currency, ?)
      ORDER BY amount DESC
    `, [baseCurrency, startDate, endDate, baseCurrency]);

    const rateMap = await getExchangeRateMap();
    const categoryMap = new Map<string, { category: string; amount: number; color: string; icon: string }>();

    for (const row of rows) {
      const convertedAmount = await convertToBase(row.amount, row.currency, baseCurrency, rateMap);
      const existing = categoryMap.get(row.category);
      if (existing) {
        existing.amount += convertedAmount;
      } else {
        categoryMap.set(row.category, {
          category: row.category,
          amount: convertedAmount,
          color: row.color,
          icon: row.icon
        });
      }
    }

    return Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount);
  },

  exportData: async () => {
    const accounts = await all(`SELECT * FROM accounts WHERE deleted_at IS NULL`);
    const categories = await all(`SELECT * FROM categories WHERE deleted_at IS NULL`);
    const transactions = await all(`SELECT * FROM transactions WHERE deleted_at IS NULL`);
    const budgets = await all(`SELECT * FROM budgets WHERE deleted_at IS NULL`);
    const goals = await all(`SELECT * FROM goals WHERE deleted_at IS NULL`);
    const recurringCharges = await all(`SELECT * FROM recurring_charges WHERE deleted_at IS NULL`);
    const goalContributions = await all(`SELECT * FROM goal_contributions`);
    const billTypes = await all(`SELECT * FROM bill_types WHERE deleted_at IS NULL`);
    const billReadings = await all(`SELECT * FROM bill_readings`);
    const exchangeRates = await all(`SELECT * FROM exchange_rates`);
    const settings = await all(`SELECT * FROM settings`);

    // Filter out sensitive settings (remote access key) from export
    const safeSettings = settings.filter((s: any) => s.key !== SETTING_KEYS.REMOTE.KEY);

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
        goalContributions,
        billTypes,
        billReadings,
        exchangeRates,
        settings: safeSettings,
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
      { table: 'goal_contributions', whereClause: '1=1' },
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

  importData: async (jsonData: any, options: { mode?: 'merge' | 'restore' } = {}) => {
    // Support both v1 format (top-level accounts/transactions) and v2 format (data.accounts/data.transactions)
    const data = jsonData.data || jsonData;

    if (!data.accounts && !data.transactions) {
      return { success: false, error: 'Invalid export format - no data found' };
    }

    try {
      await dbInitialized;

      return await writeMutex.runExclusive(async () => {
        await run('BEGIN TRANSACTION');
        try {
          const restoreMode = options.mode === 'restore';
          let preservedRemoteKey: { value: string; category: string; updated_at: string } | null = null;

          if (restoreMode) {
            preservedRemoteKey = await get<{ value: string; category: string; updated_at: string }>(
              'SELECT value, category, updated_at FROM settings WHERE key = ?',
              [SETTING_KEYS.REMOTE.KEY]
            ) || null;

            // Delete child tables before parents to satisfy FKs
            await run('DELETE FROM transaction_history');
            await run('DELETE FROM audit_logs');
            await run('DELETE FROM bill_readings');
            await run('DELETE FROM goal_contributions');
            await run('DELETE FROM recurring_charges');
            await run('DELETE FROM budgets');
            await run('DELETE FROM transactions');
            await run('DELETE FROM bill_types');
            await run('DELETE FROM goals');
            await run('DELETE FROM categories');
            await run('DELETE FROM accounts');
            await run('DELETE FROM exchange_rates');

            if (preservedRemoteKey) {
              await run('DELETE FROM settings WHERE key != ?', [SETTING_KEYS.REMOTE.KEY]);
            } else {
              await run('DELETE FROM settings');
            }
          }

          // Import accounts first (they are referenced by other entities)
          if (data.accounts && Array.isArray(data.accounts)) {
            for (const account of data.accounts) {
              await run(
                `INSERT INTO accounts (id, name, type, balance, initial_balance, currency, status, deleted_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   name = excluded.name,
                   type = excluded.type,
                   balance = excluded.balance,
                   initial_balance = excluded.initial_balance,
                   currency = excluded.currency,
                   status = excluded.status,
                   deleted_at = excluded.deleted_at,
                   updated_at = excluded.updated_at`,
                [
                  account.id, account.name, account.type, account.balance, account.initial_balance,
                  account.currency, account.status, account.deleted_at, account.updated_at
                ]
              );
            }
          }

          // Category ID remap to preserve references when conflicts occur on (type, name)
          const categoryIdMap = new Map<number, number>();

          // Import categories
          if (data.categories && Array.isArray(data.categories)) {
            for (const category of data.categories) {
              let insertId: number | null = category.id ?? null;
              const existingByPair = await get<{ id: number }>(
                'SELECT id FROM categories WHERE type = ? AND name = ? LIMIT 1',
                [category.type, category.name]
              );
              if (existingByPair?.id != null) {
                insertId = existingByPair.id;
                await run(
                  `UPDATE categories
                   SET status = ?, is_default = ?, color = ?, icon = ?, deleted_at = ?, updated_at = ?
                   WHERE id = ?`,
                  [
                    category.status, category.is_default, category.color, category.icon,
                    category.deleted_at, category.updated_at, insertId
                  ]
                );
              } else if (category.id != null) {
                const existingById = await get<{ type: string; name: string }>(
                  'SELECT type, name FROM categories WHERE id = ? LIMIT 1',
                  [category.id]
                );
                if (existingById && (existingById.type !== category.type || existingById.name !== category.name)) {
                  insertId = null;
                }
                await run(
                  `INSERT INTO categories (id, type, name, status, is_default, color, icon, deleted_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                     type = excluded.type,
                     name = excluded.name,
                     status = excluded.status,
                     is_default = excluded.is_default,
                     color = excluded.color,
                     icon = excluded.icon,
                     deleted_at = excluded.deleted_at,
                     updated_at = excluded.updated_at`,
                  [
                    insertId, category.type, category.name, category.status, category.is_default,
                    category.color, category.icon, category.deleted_at, category.updated_at
                  ]
                );
              } else {
                await run(
                  `INSERT INTO categories (id, type, name, status, is_default, color, icon, deleted_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                     type = excluded.type,
                     name = excluded.name,
                     status = excluded.status,
                     is_default = excluded.is_default,
                     color = excluded.color,
                     icon = excluded.icon,
                     deleted_at = excluded.deleted_at,
                     updated_at = excluded.updated_at`,
                  [
                    insertId, category.type, category.name, category.status, category.is_default,
                    category.color, category.icon, category.deleted_at, category.updated_at
                  ]
                );
              }

              if (category.id != null) {
                const existing = await get<{ id: number }>(
                  'SELECT id FROM categories WHERE type = ? AND name = ? LIMIT 1',
                  [category.type, category.name]
                );
                if (existing?.id != null && existing.id !== category.id) {
                  categoryIdMap.set(category.id, existing.id);
                }
              }
            }
          }

          // Import transactions
          if (data.transactions && Array.isArray(data.transactions)) {
            for (const tx of data.transactions) {
              const mappedCategoryId = (tx.category_id != null && categoryIdMap.has(tx.category_id))
                ? categoryIdMap.get(tx.category_id)
                : tx.category_id;
              await run(
                `INSERT INTO transactions (
                  id, account_id, to_account_id, type, category, category_id, amount, description,
                  attachment, frequency, start_date, end_date, currency, exchange_rate, to_amount,
                  base_currency, base_amount, tags, is_active, created_at, updated_at, deleted_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  account_id = excluded.account_id,
                  to_account_id = excluded.to_account_id,
                  type = excluded.type,
                  category = excluded.category,
                  category_id = excluded.category_id,
                  amount = excluded.amount,
                  description = excluded.description,
                  attachment = excluded.attachment,
                  frequency = excluded.frequency,
                  start_date = excluded.start_date,
                  end_date = excluded.end_date,
                  currency = excluded.currency,
                  exchange_rate = excluded.exchange_rate,
                  to_amount = excluded.to_amount,
                  base_currency = excluded.base_currency,
                  base_amount = excluded.base_amount,
                  tags = excluded.tags,
                  is_active = excluded.is_active,
                  created_at = excluded.created_at,
                  updated_at = excluded.updated_at,
                  deleted_at = excluded.deleted_at`,
                [
                  tx.id, tx.account_id, tx.to_account_id, tx.type, tx.category, mappedCategoryId,
                  tx.amount, tx.description, tx.attachment, tx.frequency, tx.start_date, tx.end_date,
                  tx.currency, tx.exchange_rate, tx.to_amount, tx.base_currency, tx.base_amount,
                  tx.tags, tx.is_active, tx.created_at, tx.updated_at, tx.deleted_at
                ]
              );
            }
          }

          // Import budgets
          if (data.budgets && Array.isArray(data.budgets)) {
            for (const budget of data.budgets) {
              const mappedCategoryId = (budget.category_id != null && categoryIdMap.has(budget.category_id))
                ? categoryIdMap.get(budget.category_id)
                : budget.category_id;
              await run(
                `INSERT INTO budgets (id, category, category_id, amount, period, start_date, end_date, currency, deleted_at, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   category = excluded.category,
                   category_id = excluded.category_id,
                   amount = excluded.amount,
                   period = excluded.period,
                   start_date = excluded.start_date,
                   end_date = excluded.end_date,
                   currency = excluded.currency,
                   deleted_at = excluded.deleted_at,
                   created_at = excluded.created_at,
                   updated_at = excluded.updated_at`,
                [
                  budget.id, budget.category, mappedCategoryId, budget.amount, budget.period,
                  budget.start_date, budget.end_date, budget.currency, budget.deleted_at, budget.created_at, budget.updated_at
                ]
              );
            }
          }

          // Import goals
          if (data.goals && Array.isArray(data.goals)) {
            for (const goal of data.goals) {
              await run(
                `INSERT INTO goals (
                  id, name, description, target_amount, current_amount, monthly_contribution,
                  icon, color, priority, target_date, status, auto_contribute, currency,
                  deleted_at, created_at, updated_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  description = excluded.description,
                  target_amount = excluded.target_amount,
                  current_amount = excluded.current_amount,
                  monthly_contribution = excluded.monthly_contribution,
                  icon = excluded.icon,
                  color = excluded.color,
                  priority = excluded.priority,
                  target_date = excluded.target_date,
                  status = excluded.status,
                  auto_contribute = excluded.auto_contribute,
                  currency = excluded.currency,
                  deleted_at = excluded.deleted_at,
                  created_at = excluded.created_at,
                  updated_at = excluded.updated_at,
                  completed_at = excluded.completed_at`,
                [
                  goal.id, goal.name, goal.description, goal.target_amount, goal.current_amount,
                  goal.monthly_contribution, goal.icon, goal.color, goal.priority, goal.target_date,
                  goal.status, goal.auto_contribute, goal.currency,
                  goal.deleted_at, goal.created_at, goal.updated_at, goal.completed_at
                ]
              );
            }
          }

          // Import recurring charges
          if (data.recurringCharges && Array.isArray(data.recurringCharges)) {
            for (const rc of data.recurringCharges) {
              const mappedCategoryId = (rc.category_id != null && categoryIdMap.has(rc.category_id))
                ? categoryIdMap.get(rc.category_id)
                : rc.category_id;
              await run(
                `INSERT INTO recurring_charges (
                  id, category, category_id, name, amount, frequency, due_day,
                  next_due_date, is_active, notes, currency, deleted_at, created_at, updated_at,
                  last_transaction_id, last_generated_date, account_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  category = excluded.category,
                  category_id = excluded.category_id,
                  name = excluded.name,
                  amount = excluded.amount,
                  frequency = excluded.frequency,
                  due_day = excluded.due_day,
                  next_due_date = excluded.next_due_date,
                  is_active = excluded.is_active,
                  notes = excluded.notes,
                  currency = excluded.currency,
                  deleted_at = excluded.deleted_at,
                  created_at = excluded.created_at,
                  updated_at = excluded.updated_at,
                  last_transaction_id = excluded.last_transaction_id,
                  last_generated_date = excluded.last_generated_date,
                  account_id = excluded.account_id`,
                [
                  rc.id, rc.category, mappedCategoryId, rc.name, rc.amount, rc.frequency, rc.due_day,
                  rc.next_due_date, rc.is_active, rc.notes, rc.currency, rc.deleted_at, rc.created_at, rc.updated_at,
                  rc.last_transaction_id, rc.last_generated_date, rc.account_id
                ]
              );
            }
          }

          // Import goal contributions
          if (data.goalContributions && Array.isArray(data.goalContributions)) {
            for (const gc of data.goalContributions) {
              await run(
                `INSERT INTO goal_contributions (
                  id, goal_id, amount, source, notes, account_id, transaction_id, contributed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  goal_id = excluded.goal_id,
                  amount = excluded.amount,
                  source = excluded.source,
                  notes = excluded.notes,
                  account_id = excluded.account_id,
                  transaction_id = excluded.transaction_id,
                  contributed_at = excluded.contributed_at`,
                [
                  gc.id, gc.goal_id, gc.amount, gc.source, gc.notes,
                  gc.account_id, gc.transaction_id, gc.contributed_at
                ]
              );
            }
          }

          // Import bill types
          if (data.billTypes && Array.isArray(data.billTypes)) {
            for (const bt of data.billTypes) {
              await run(
                `INSERT INTO bill_types (
                  id, name, unit_name, cost_per_unit, category_name, account_id,
                  auto_transaction, icon, color, currency, created_at, updated_at, deleted_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  unit_name = excluded.unit_name,
                  cost_per_unit = excluded.cost_per_unit,
                  category_name = excluded.category_name,
                  account_id = excluded.account_id,
                  auto_transaction = excluded.auto_transaction,
                  icon = excluded.icon,
                  color = excluded.color,
                  currency = excluded.currency,
                  created_at = excluded.created_at,
                  updated_at = excluded.updated_at,
                  deleted_at = excluded.deleted_at`,
                [
                  bt.id, bt.name, bt.unit_name, bt.cost_per_unit, bt.category_name, bt.account_id,
                  bt.auto_transaction, bt.icon, bt.color, bt.currency, bt.created_at, bt.updated_at, bt.deleted_at
                ]
              );
            }
          }

          // Import bill readings
          if (data.billReadings && Array.isArray(data.billReadings)) {
            for (const br of data.billReadings) {
              await run(
                `INSERT INTO bill_readings (id, bill_type_id, date, units_used, total_cost, notes, transaction_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   bill_type_id = excluded.bill_type_id,
                   date = excluded.date,
                   units_used = excluded.units_used,
                   total_cost = excluded.total_cost,
                   notes = excluded.notes,
                   transaction_id = excluded.transaction_id,
                   created_at = excluded.created_at`,
                [br.id, br.bill_type_id, br.date, br.units_used, br.total_cost, br.notes, br.transaction_id, br.created_at]
              );
            }
          }

          // Import exchange rates
          if (data.exchangeRates && Array.isArray(data.exchangeRates)) {
            for (const er of data.exchangeRates) {
              let insertId: number | null = er.id ?? null;
              const existingByPair = await get<{ id: number }>(
                'SELECT id FROM exchange_rates WHERE from_currency = ? AND to_currency = ? LIMIT 1',
                [er.from_currency, er.to_currency]
              );
              if (existingByPair?.id != null) {
                insertId = existingByPair.id;
                await run(
                  `UPDATE exchange_rates
                   SET rate = ?, source = ?, updated_at = ?
                   WHERE from_currency = ? AND to_currency = ?`,
                  [er.rate, er.source, er.updated_at, er.from_currency, er.to_currency]
                );
              } else if (er.id != null) {
                const existingById = await get<{ from_currency: string; to_currency: string }>(
                  'SELECT from_currency, to_currency FROM exchange_rates WHERE id = ? LIMIT 1',
                  [er.id]
                );
                if (existingById && (existingById.from_currency !== er.from_currency || existingById.to_currency !== er.to_currency)) {
                  insertId = null;
                }
                await run(
                  `INSERT INTO exchange_rates (id, from_currency, to_currency, rate, source, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                     from_currency = excluded.from_currency,
                     to_currency = excluded.to_currency,
                     rate = excluded.rate,
                     source = excluded.source,
                     updated_at = excluded.updated_at`,
                  [insertId, er.from_currency, er.to_currency, er.rate, er.source, er.updated_at]
                );
              } else {
                await run(
                  `INSERT INTO exchange_rates (id, from_currency, to_currency, rate, source, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                     from_currency = excluded.from_currency,
                     to_currency = excluded.to_currency,
                     rate = excluded.rate,
                     source = excluded.source,
                     updated_at = excluded.updated_at`,
                  [insertId, er.from_currency, er.to_currency, er.rate, er.source, er.updated_at]
                );
              }
            }
          }

          // Import settings (skip sensitive ones)
          if (data.settings && Array.isArray(data.settings)) {
            for (const setting of data.settings) {
              // Skip remote access key for security
              if (setting.key === SETTING_KEYS.REMOTE.KEY) continue;

              await run(
                `INSERT INTO settings (key, value, category, updated_at)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(key) DO UPDATE SET
                   value = excluded.value,
                   category = excluded.category,
                   updated_at = excluded.updated_at`,
                [setting.key, setting.value, setting.category, setting.updated_at]
              );
            }
          }

          if (restoreMode && preservedRemoteKey) {
            await run(
              `INSERT INTO settings (key, value, category, updated_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(key) DO UPDATE SET
                 value = excluded.value,
                 category = excluded.category,
                 updated_at = excluded.updated_at`,
              [SETTING_KEYS.REMOTE.KEY, preservedRemoteKey.value, preservedRemoteKey.category, preservedRemoteKey.updated_at]
            );
          }

          // Ensure AUTOINCREMENT sequences are aligned with imported data
          const autoIncrementTables = [
            'accounts',
            'transactions',
            'categories',
            'exchange_rates',
            'budgets',
            'goals',
            'recurring_charges',
            'goal_contributions',
            'bill_types',
            'bill_readings',
            'transaction_history',
            'audit_logs',
          ];
          for (const table of autoIncrementTables) {
            const row = await get<{ maxId: number }>(`SELECT COALESCE(MAX(id), 0) as maxId FROM ${table}`);
            const maxId = row?.maxId || 0;
            const updated = await run(
              `UPDATE sqlite_sequence SET seq = ? WHERE name = ?`,
              [maxId, table]
            );
            if ((updated?.changes || 0) === 0) {
              await run(
                `INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)`,
                [table, maxId]
              );
            }
          }

          // Recalculate all account balances after import
          await FinanceModel.recalculateAllBalances();

          await run('COMMIT');
          return { success: true, message: 'Data imported successfully!' };
        } catch (err) {
          await run('ROLLBACK');
          throw err;
        }
      });
    } catch (err: any) {
      console.error('[Import] Error:', err);
      return { success: false, error: err.message || 'Import failed' };
    }
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
      t.currency || DEFAULT_CURRENCY
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }
};
