/**
 * Finance Model - Streamlined CRUD with Validation
 *
 * This module provides database operations for all financial entities.
 * Uses generic CRUD patterns to reduce code duplication.
 * Includes automatic validation via the validators module.
 */

import { db } from '../database/db';
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

// Use strict types for helper functions
const { run, get, all } = createDbHelpers(db);

// =============================================================================
// ENTITY SCHEMAS - Define structure and behavior for each entity type
// =============================================================================

interface EntitySchema<T> {
  table: string;
  fields: string[]; // Keep as string[] for runtime checks, though logic uses keyof T conceptually
  defaults?: Partial<T>;
  orderBy?: string;
  checkInUse?: (id: number) => Promise<boolean>;
  afterWrite?: (data: T & { id?: number }) => Promise<void>;
}

// We map entity names to their schemas.
// Using 'any' for the generic schema type in the map to allow heterogeneous collection,
// but individual schemas are strongly typed in definition if we extracted them.
// For simplicity in this migration, we'll define them inline with explicit types where critical.

const ENTITY_SCHEMAS: Record<string, EntitySchema<any>> = {
  transaction: {
    table: 'transactions',
    fields: [
      'account_id',
      'to_account_id',
      'type',
      'category',
      'amount',
      'description',
      'attachment',
      'frequency',
      'start_date',
      'end_date',
      'currency',
      'exchange_rate',
      'to_amount',
      'tags',
      'is_active',
    ],
    defaults: { currency: 'USD', frequency: 'once', is_active: 1, tags: '', exchange_rate: 1 },
    orderBy: 'start_date DESC',
    afterWrite: async (data: Transaction) => {
      if (data.account_id) await FinanceModel.syncAccountBalance(data.account_id);
      if (data.to_account_id) await FinanceModel.syncAccountBalance(data.to_account_id);
    },
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
    fields: ['category', 'amount', 'period', 'start_date', 'end_date'],
    defaults: { period: 'monthly' },
    orderBy: 'start_date DESC',
  },
  goal: {
    table: 'goals',
    fields: [
      'name',
      'description',
      'target_amount',
      'current_amount',
      'monthly_contribution',
      'icon',
      'color',
      'priority',
      'target_date',
      'status',
      'auto_contribute',
    ],
    defaults: {
      current_amount: 0,
      monthly_contribution: 0,
      icon: 'target',
      color: '#a29bfe',
      priority: 1,
      status: 'active',
      auto_contribute: 0,
    },
    orderBy: 'priority ASC, created_at DESC',
  },
  recurringCharge: {
    table: 'recurring_charges',
    fields: [
      'category',
      'name',
      'amount',
      'frequency',
      'due_day',
      'next_due_date',
      'is_active',
      'notes',
    ],
    defaults: { frequency: 'monthly', due_day: 1, is_active: 1 },
    orderBy: 'category, name',
  },
  billType: {
    table: 'bill_types',
    fields: [
      'name',
      'unit_name',
      'cost_per_unit',
      'category_name',
      'account_id',
      'auto_transaction',
      'icon',
      'color',
    ],
    defaults: {
      unit_name: 'Units',
      cost_per_unit: 0,
      auto_transaction: 0,
      icon: 'file-text',
      color: '#7c3aed',
    },
    orderBy: 'name ASC',
  },
  billReading: {
    table: 'bill_readings',
    fields: ['bill_type_id', 'date', 'units_used', 'total_cost', 'notes'],
    defaults: {},
    orderBy: 'date DESC',
    afterWrite: async (data: BillReading) => {
      // Auto-create transaction if bill type has auto_transaction enabled
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
          await FinanceModel.create('transaction', {
            account_id: accountId,
            type: 'expense',
            category: billType.category_name,
            amount: data.total_cost,
            description: `Bill: ${billType.name} (${data.units_used} units)`,
            frequency: 'once',
            start_date: data.date,
            tags: 'bill-auto',
          });
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
   * Create a new entity
   */
  create: async (entityType: string, data: any, auditContext: { source?: string; metadata?: any } = {}): Promise<{ id: number; changes: number }> => {
    const schema = ENTITY_SCHEMAS[entityType];
    if (!schema) throw new Error(`Unknown entity type: ${entityType}`);

    // Validate
    // @ts-ignore - access by string key
    const validator = EntityValidators[entityType];
    if (validator) data = validator(data, true);

    // Apply defaults
    const finalData = { ...schema.defaults, ...sanitizeData(data, schema.fields) };

    // Build SQL
    const fields = Object.keys(finalData);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map((f) => finalData[f]);

    const sql = `INSERT INTO ${schema.table} (${fields.join(', ')}) VALUES (${placeholders})`;
    const result = await run(sql, values);

    // Post-write hooks
    if (schema.afterWrite) await schema.afterWrite({ ...finalData, id: result.id });

    // Audit Log
    await FinanceModel.logAudit(entityType, result.id, 'CREATE', null, finalData, auditContext);

    return result;
  },

  /**
   * Update an entity by ID
   */
  update: async (
    entityType: string,
    id: number,
    data: any,
    auditContext: { source?: string; metadata?: any } = {}
  ): Promise<{ id: number; changes: number }> => {
    const schema = ENTITY_SCHEMAS[entityType];
    if (!schema) throw new Error(`Unknown entity type: ${entityType}`);

    // Validate
    // @ts-ignore
    const validator = EntityValidators[entityType];
    if (validator) data = validator(data, false);

    // Sanitize to allowed fields only
    const sanitized = sanitizeData(data, schema.fields);
    const fields = Object.keys(sanitized);

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Build SQL (field names are validated via sanitize)
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = [...fields.map((f) => sanitized[f]), id];

    const sql = `UPDATE ${schema.table} SET ${setClause} WHERE id = ?`;

    // Get old data for audit BEFORE update
    const oldData = await FinanceModel.getById(entityType, id);

    const result = await run(sql, values);

    // Post-write hooks
    if (schema.afterWrite) await schema.afterWrite({ ...sanitized, id });

    // Audit Log
    await FinanceModel.logAudit(entityType, id, 'UPDATE', oldData, sanitized, auditContext);

    return result;
  },

  /**
   * Delete an entity by ID
   */
  delete: async (
    entityType: string,
    id: number,
    force: boolean = false,
    auditContext: { source?: string; metadata?: any } = {}
  ): Promise<{ id: number; changes: number }> => {
    const schema = ENTITY_SCHEMAS[entityType];
    if (!schema) throw new Error(`Unknown entity type: ${entityType}`);

    // Check if in use (prevents orphaned data)
    if (!force && schema.checkInUse) {
      const inUse = await schema.checkInUse(id);
      if (inUse) {
        throw new Error(`Cannot delete: ${entityType} is in use. Archive it instead.`);
      }
    }

    // Get old data for audit
    const oldData = await FinanceModel.getById(entityType, id);

    const result = await run(`DELETE FROM ${schema.table} WHERE id = ?`, [id]);

    // Audit Log
    if (oldData) {
      await FinanceModel.logAudit(entityType, id, 'DELETE', oldData, null, auditContext);
    }

    return result;
  },

  /**
   * Get single entity by ID
   */
  getById: async (entityType: string, id: number): Promise<any> => {
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

      // Use specific table for transactions to maintain backward compatibility (renames or upgrades notwithstanding)
      // But our logic is: transaction_history for transactions, audit_logs for everything else.

      if (entityType === 'transaction') {
        // Check if transaction_history has source column (it should after migration)
        // We use safe check or just assume migration ran.
        const changeData = action === 'UPDATE' ? { old: oldData, new: newData } : (action === 'CREATE' ? newData : oldData);

        // For transaction history, we try to match the schema.
        // But wait, the transaction_history table has old_data / new_data columns.
        await run(`
                INSERT INTO transaction_history (transaction_id, action, old_data, new_data, source, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
          entityId,
          action,
          oldData ? JSON.stringify(oldData) : null,
          newData ? JSON.stringify(newData) : null,
          source,
          metadata
        ]);
      } else {
        // Generic audit logs
        // We only store the DIFF mostly, but here for simplicity storing full blobs or diff
        // Let's compute a simple DIFF for updates
        let changes: string | null = null;
        if (action === 'UPDATE' && oldData && newData) {
          const diff: Record<string, any> = {};
          Object.keys(newData).forEach(key => {
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

        await run(`
                INSERT INTO audit_logs (entity_type, entity_id, action, source, changes, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [entityType, entityId, action, source, changes, metadata]);
      }
    } catch (e) {
      console.error('[Audit] Failed to log:', e);
      // Don't block the actual operation if audit fails
    }
  },

  /**
   * Get all entities of a type
   */
  getAll: async <T = any>(
    entityType: string,
    options: { where?: Record<string, any>; orderBy?: string } = {}
  ): Promise<T[]> => {
    const schema = ENTITY_SCHEMAS[entityType];
    if (!schema) throw new Error(`Unknown entity type: ${entityType}`);

    let sql = `SELECT * FROM ${schema.table}`;
    const params: any[] = [];

    // Simple where clause support
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

  // ... (Other generic methods)

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
    const acc = await get<Account>(`SELECT initial_balance FROM accounts WHERE id = ?`, [
      accountId,
    ]);
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

    if (!agg) return; // Should not happen with valid SQL

    const balance =
      Math.round(((acc.initial_balance || 0) + (agg.total_in || 0) - (agg.total_out || 0)) * 100) /
      100;
    return await run(`UPDATE accounts SET balance = ? WHERE id = ?`, [balance, accountId]);
  },

  // Pagination
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
    const sortBy = ['start_date', 'amount', 'category', 'created_at'].includes(options.sortBy || '')
      ? options.sortBy
      : 'start_date';
    const sortOrder = options.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const params: any[] = [];

    if (activeOnly) conditions.push('is_active = 1');
    if (options.accountId) {
      conditions.push('(account_id = ? OR to_account_id = ?)');
      params.push(options.accountId, options.accountId);
    }
    if (options.category) {
      conditions.push('category = ?');
      params.push(options.category);
    }
    if (options.type) {
      conditions.push('type = ?');
      params.push(options.type);
    }
    if (options.startDate) {
      conditions.push('start_date >= ?');
      params.push(options.startDate);
    }
    if (options.endDate) {
      conditions.push('start_date <= ?');
      params.push(options.endDate);
    }
    if (options.search) {
      conditions.push('description LIKE ?');
      params.push(`%${options.search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await get<{ total: number }>(
      `SELECT COUNT(*) as total FROM transactions ${whereClause}`,
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

  getMonthlyTotals: async (startDate: string, endDate: string) => {
    const result = await get<{ income: number; expense: number }>(
      `
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
      FROM transactions 
      WHERE start_date BETWEEN ? AND ? AND is_active = 1
      `,
      [startDate, endDate]
    );
    return result || { income: 0, expense: 0 };
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

  // Goals
  contributeToGoal: async (
    goalId: number,
    amount: number,
    source: string | null = null,
    notes: string | null = null
  ) => {
    amount = validateAmount(amount);
    await FinanceModel.create('goalContribution', { goal_id: goalId, amount, source, notes });

    const goal = await get<Goal>(`SELECT current_amount, target_amount FROM goals WHERE id = ?`, [
      goalId,
    ]);
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
    const goals = await all<Goal>(`SELECT * FROM goals WHERE status = 'active'`);
    const totalTarget = goals.reduce((sum, g) => sum + g.target_amount, 0);
    const totalSaved = goals.reduce((sum, g) => sum + g.current_amount, 0);
    const totalMonthlyContribution = goals.reduce(
      (sum, g) => sum + (g.monthly_contribution || 0),
      0
    );
    return {
      activeGoals: goals.length,
      totalTarget,
      totalSaved,
      totalProgress: totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0,
      totalMonthlyContribution,
    };
  },

  getAvailableForGoals: async () => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const incomeData = await get<{ total: number }>(
      `
            SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
            WHERE type = 'income' AND start_date >= ? AND is_active = 1
        `,
      [DateUtils.toDateString(threeMonthsAgo)]
    );

    const avgMonthlyIncome = (incomeData?.total || 0) / 3;
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
    const charges = await all<RecurringCharge>(
      `SELECT amount, frequency FROM recurring_charges WHERE is_active = 1`
    );
    let monthlyTotal = 0;
    charges.forEach((c) => {
      if (c.frequency === 'weekly') monthlyTotal += c.amount * 4.33;
      else if (c.frequency === 'monthly') monthlyTotal += c.amount;
      else if (c.frequency === 'yearly') monthlyTotal += c.amount / 12;
    });
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
      SELECT
        r.id,
        r.bill_type_id,
        r.date as reading_date,
        r.units_used as usage_amount,
        r.total_cost as cost,
        0 as is_paid,
        NULL as paid_at,
        r.notes,
        r.created_at,
        t.name as bill_name,
        t.unit_name,
        t.cost_per_unit as current_cost_per_unit,
        t.color,
        t.icon,
        t.category_name
      FROM bill_readings r
      JOIN bill_types t ON r.bill_type_id = t.id
    `;
    const params: any[] = [];
    const where: string[] = [];

    if (filters.bill_type_id) {
      where.push(`r.bill_type_id = ? `);
      params.push(filters.bill_type_id);
    }
    if (filters.year && filters.year != 0) {
      where.push(`strftime('%Y', r.date) = ? `);
      params.push(String(filters.year));
    }
    if (filters.month && filters.month != 0) {
      where.push(`strftime('%m', r.date) = ? `);
      params.push(String(filters.month).padStart(2, '0'));
    }

    if (where.length > 0) sql += ` WHERE ${where.join(' AND ')} `;
    sql += ` ORDER BY r.date DESC`;
    return await all(sql, params);
  },

  getBillReadingsPaginated: async (
    options: {
      limit?: number;
      offset?: number;
      bill_type_id?: number;
      year?: number;
      month?: number;
    } = {}
  ) => {
    const limit = Math.min(Math.max(1, options.limit || 50), 500);
    const offset = Math.max(0, options.offset || 0);
    const where: string[] = [];
    const params: any[] = [];

    if (options.bill_type_id) {
      where.push(`r.bill_type_id = ? `);
      params.push(options.bill_type_id);
    }
    if (options.year && options.year != 0) {
      where.push(`strftime('%Y', r.date) = ? `);
      params.push(String(options.year));
    }
    if (options.month && options.month != 0) {
      where.push(`strftime('%m', r.date) = ? `);
      params.push(String(options.month).padStart(2, '0'));
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')} ` : '';
    const countResult = await get<{ total: number }>(
      `SELECT COUNT(*) as total FROM bill_readings r ${whereClause} `,
      params
    );
    const data = await all(
      `
            SELECT r.*, t.name as bill_name, t.unit_name, t.cost_per_unit as current_cost_per_unit,
      t.color, t.icon, t.category_name
            FROM bill_readings r
            JOIN bill_types t ON r.bill_type_id = t.id
            ${whereClause}
            ORDER BY r.date DESC
    LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return {
      data,
      total: countResult?.total || 0,
      limit,
      offset,
      hasMore: offset + data.length < (countResult?.total || 0),
    };
  },

  getBillProjections: async () => {
    const billTypes = await FinanceModel.getBillTypes();
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastYear = lastMonthDate.getFullYear();
    const lastMonth = lastMonthDate.getMonth() + 1;

    const projections = [];
    for (const type of billTypes) {
      const stats = await get<{ avg_units: number; avg_cost: number }>(
        `SELECT AVG(units_used) as avg_units, AVG(total_cost) as avg_cost FROM bill_readings WHERE bill_type_id = ? `,
        [type.id]
      );
      const lastActual = await get<{ total: number }>(
        `SELECT SUM(total_cost) as total FROM bill_readings WHERE bill_type_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ? `,
        [type.id, String(lastYear), String(lastMonth).padStart(2, '0')]
      );
      const currentActual = await get<{ total: number }>(
        `SELECT SUM(total_cost) as total FROM bill_readings WHERE bill_type_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ? `,
        [type.id, String(curYear), String(curMonth).padStart(2, '0')]
      );

      const avgUnits = stats?.avg_units || 0;
      projections.push({
        ...type,
        avg_units: avgUnits,
        projected_cost: avgUnits * type.cost_per_unit || stats?.avg_cost || 0,
        last_month_actual: lastActual?.total || 0,
        this_month_actual: currentActual?.total || 0,
      });
    }
    return projections;
  },

  getExchangeRates: async () => {
    return await all<ExchangeRate>(
      `SELECT * FROM exchange_rates ORDER BY from_currency, to_currency`
    );
  },

  /**
   * Get exchange rate with fallback to triangulated rate via USD
   */
  getExchangeRate: async (fromCurrency: string, toCurrency: string): Promise<number | null> => {
    if (fromCurrency === toCurrency) return 1;

    // Try direct rate
    const direct = await get<ExchangeRate>(
      `SELECT rate FROM exchange_rates WHERE from_currency = ? AND to_currency = ? `,
      [fromCurrency, toCurrency]
    );
    if (direct) return direct.rate;

    // Try inverse rate
    const inverse = await get<ExchangeRate>(
      `SELECT rate FROM exchange_rates WHERE from_currency = ? AND to_currency = ? `,
      [toCurrency, fromCurrency]
    );
    if (inverse && inverse.rate > 0) return 1 / inverse.rate;

    // Try triangulated rate via USD (common base currency)
    if (fromCurrency !== 'USD' && toCurrency !== 'USD') {
      const fromToUsd = await FinanceModel.getExchangeRate(fromCurrency, 'USD');
      const usdToTo = await FinanceModel.getExchangeRate('USD', toCurrency);
      if (fromToUsd !== null && usdToTo !== null) {
        return Math.round(fromToUsd * usdToTo * 1000000) / 1000000;
      }
    }

    return null;
  },

  /**
   * Get rate sync status for display in UI
   */
  getRateSyncStatus: async (): Promise<{
    lastSync: string | null;
    isStale: boolean;
    hoursSinceSync: number;
    rateCount: number;
  }> => {
    const settings = await FinanceModel.getAllSettings();
    const lastSync = settings.currency_last_sync || null;
    const stalenessHours = parseInt(settings.exchange_rate_staleness_hours || '24', 10);

    let hoursSinceSync = Infinity;
    if (lastSync) {
      hoursSinceSync = (Date.now() - new Date(lastSync).getTime()) / (1000 * 60 * 60);
    }

    const countResult = await get<{ count: number }>(
      `SELECT COUNT(*) as count FROM exchange_rates`
    );

    return {
      lastSync,
      isStale: !lastSync || hoursSinceSync >= stalenessHours,
      hoursSinceSync: Math.round(hoursSinceSync * 10) / 10,
      rateCount: countResult?.count || 0,
    };
  },

  /**
   * Get rates for multiple currency pairs at once
   */
  getRatesForCurrencies: async (
    currencies: string[]
  ): Promise<Map<string, Map<string, number>>> => {
    const rateMap = new Map<string, Map<string, number>>();

    for (const from of currencies) {
      const fromMap = new Map<string, number>();
      for (const to of currencies) {
        if (from !== to) {
          const rate = await FinanceModel.getExchangeRate(from, to);
          if (rate !== null) {
            fromMap.set(to, rate);
          }
        }
      }
      rateMap.set(from, fromMap);
    }

    return rateMap;
  },

  setExchangeRate: async (
    fromCurrency: string,
    toCurrency: string,
    rate: number,
    source: string = 'manual'
  ) => {
    rate = validateAmount(rate);
    if (rate <= 0) throw new Error('Exchange rate must be positive');
    return await run(
      `
            INSERT INTO exchange_rates(from_currency, to_currency, rate, source, updated_at)
    VALUES(?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(from_currency, to_currency) DO UPDATE SET
    rate = ?, source = ?, updated_at = CURRENT_TIMESTAMP
      `,
      [fromCurrency, toCurrency, rate, source, rate, source]
    );
  },

  // Budgets (Optimized for Dashboard)
  getBudgetSummary: async (): Promise<{ totalAmount: number; usedAmount: number }> => {
    const today = DateUtils.today();

    // Get total allocated budget for currently active budgets
    const budgetResult = await get<{ total: number }>(`
      SELECT SUM(amount) as total 
      FROM budgets 
      WHERE start_date <= ? AND end_date >= ? AND deleted_at IS NULL
    `, [today, today]);

    return {
      totalAmount: budgetResult?.total || 0,
      usedAmount: 0 // Placeholder for future expansion
    };
  },

  setExchangeRatesBulk: async (
    rates: { from: string; to: string; rate: number }[],
    source: string = 'api'
  ) => {
    await run('BEGIN TRANSACTION');
    try {
      for (const { from, to, rate } of rates) {
        await FinanceModel.setExchangeRate(from, to, rate, source);
      }
      await run('COMMIT');
      return true;
    } catch (err) {
      await run('ROLLBACK');
      throw err;
    }
  },

  convertCurrency: async (amount: number, fromCurrency: string, toCurrency: string) => {
    if (fromCurrency === toCurrency) return amount;
    const rate = await FinanceModel.getExchangeRate(fromCurrency, toCurrency);
    if (rate === null) return null;
    return Math.round(amount * rate * 100) / 100;
  },

  getUsedCurrencies: async () => {
    const rows = await all<{ currency: string }>(
      `SELECT DISTINCT currency FROM accounts WHERE status = 'active'`
    );
    return rows.map((r) => r.currency);
  },

  getAccountsWithConvertedBalances: async (baseCurrency: string) => {
    const accounts = await FinanceModel.getAllAccounts();
    const result = [];
    for (const acc of accounts) {
      const convertedBalance = await FinanceModel.convertCurrency(
        acc.balance,
        acc.currency,
        baseCurrency
      );
      result.push({
        ...acc,
        converted_balance: convertedBalance,
        base_currency: baseCurrency,
        conversion_available: convertedBalance !== null,
      });
    }
    return result;
  },

  /**
   * Get total balance across all accounts in base currency
   */
  getTotalBalanceInBaseCurrency: async (
    baseCurrency: string
  ): Promise<{
    total: number;
    convertedCount: number;
    unconvertedCount: number;
    breakdown: { currency: string; balance: number; converted: number | null }[];
  }> => {
    const accounts = await FinanceModel.getAllAccounts();
    let total = 0;
    let convertedCount = 0;
    let unconvertedCount = 0;
    const currencyTotals = new Map<string, number>();

    // Aggregate by currency
    for (const acc of accounts) {
      if (acc.status === 'active') {
        const isAsset = ['bank', 'wallet', 'investment'].includes(acc.type);
        const effectiveBalance = isAsset ? acc.balance : -acc.balance;
        currencyTotals.set(
          acc.currency,
          (currencyTotals.get(acc.currency) || 0) + effectiveBalance
        );
      }
    }

    const breakdown: { currency: string; balance: number; converted: number | null }[] = [];

    for (const [currency, balance] of currencyTotals) {
      const converted = await FinanceModel.convertCurrency(balance, currency, baseCurrency);
      breakdown.push({ currency, balance, converted });

      if (converted !== null) {
        total += converted;
        convertedCount++;
      } else {
        unconvertedCount++;
      }
    }

    return { total: Math.round(total * 100) / 100, convertedCount, unconvertedCount, breakdown };
  },

  // =========================================================================
  // AI LEARNING SUPPORT
  // =========================================================================

  /**
   * Get recent category corrections made by users on AI-categorized transactions.
   * Used to provide few-shot examples for improved AI categorization.
   * 
   * @param limit Maximum number of corrections to return (default: 5)
   * @returns Array of corrections with original/corrected category and description
   */
  getAICategoryCorrections: async (
    limit: number = 5
  ): Promise<{ original: string; corrected: string; description: string }[]> => {
    try {
      // Find transactions where:
      // 1. User made an UPDATE after an AI CREATE
      // 2. The category was changed
      const corrections = await all<{
        old_data: string;
        new_data: string;
        description: string;
      }>(`
        SELECT h.old_data, h.new_data, t.description
        FROM transaction_history h
        JOIN transactions t ON h.transaction_id = t.id
        WHERE h.action = 'UPDATE'
          AND h.source = 'USER'
          AND h.old_data IS NOT NULL
          AND h.new_data IS NOT NULL
          AND EXISTS(
        SELECT 1 FROM transaction_history h2 
            WHERE h2.transaction_id = h.transaction_id 
              AND h2.action = 'CREATE' 
              AND h2.source = 'AI'
      )
        ORDER BY h.changed_at DESC
    LIMIT ?
      `, [limit * 2]); // Fetch extra to filter for actual category changes

      const result: { original: string; corrected: string; description: string }[] = [];

      for (const row of corrections) {
        if (result.length >= limit) break;

        try {
          const oldData = JSON.parse(row.old_data);
          const newData = JSON.parse(row.new_data);

          // old_data contains full previous record with .category
          // new_data contains only changed fields - category will be present directly if changed
          const oldCategory = oldData.category;
          const newCategory = newData.category;

          // Only include if category was actually changed
          if (oldCategory && newCategory && oldCategory !== newCategory) {
            result.push({
              original: oldCategory,
              corrected: newCategory,
              description: row.description || '',
            });
          }
        } catch {
          // Skip rows with invalid JSON
          continue;
        }
      }

      return result;
    } catch (error) {
      console.error('[FinanceModel] Failed to get AI corrections:', error);
      return [];
    }
  },

  /**
   * Get category statistics for anomaly detection (Optimized)
   * Uses E[X^2] - (E[X])^2 formula for single-pass Standard Deviation
   */
  getCategoryStats: async (): Promise<{
    category: string;
    count: number;
    mean: number;
    stdDev: number;
    min: number;
    max: number;
  }[]> => {
    try {
      // Calculate Count, Sum, SumSq, Min, Max in one go
      const stats = await all<{
        category: string;
        count: number;
        sum_amount: number;
        sum_sq_amount: number;
        min_amount: number;
        max_amount: number;
      }>(`
        SELECT
    category,
      COUNT(*) as count,
      SUM(amount) as sum_amount,
      SUM(amount * amount) as sum_sq_amount,
      MIN(amount) as min_amount,
      MAX(amount) as max_amount
        FROM transactions
        WHERE type = 'expense' AND is_active = 1
        GROUP BY category
        HAVING COUNT(*) >= 3
      `);

      return stats.map(s => {
        const mean = s.sum_amount / s.count;
        const variance = (s.sum_sq_amount / s.count) - (mean * mean);
        const stdDev = Math.sqrt(Math.max(0, variance)); // Ensure no negative variance due to float precision

        return {
          category: s.category,
          count: s.count,
          mean: Math.round(mean * 100) / 100,
          stdDev: Math.round(stdDev * 100) / 100,
          min: s.min_amount,
          max: s.max_amount
        };
      });
    } catch (error) {
      console.error('[FinanceModel] Failed to get category stats:', error);
      return [];
    }
  },

  /**
   * Get pre-calculated dashboard data
   * Groups by month for graph and calculates totals
   */
  getDashboardData: async (months: number = 6) => {
    try {
      // Helper for local YYYY-MM-DD
      const toLocalDate = (d: Date) => {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };

      // 1. Get Monthly History (Income/Expense)
      const now = new Date();
      // Start from 1st day of (current month - months + 1)
      const startObj = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
      const endObj = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month

      const startDate = toLocalDate(startObj);
      const endDate = toLocalDate(endObj);

      // Date range for query

      const monthlyData = await all<{
        month_key: string;
        type: string;
        total: number;
      }>(`
    SELECT
    strftime('%Y-%m', start_date) as month_key,
      type,
      SUM(amount) as total
        FROM transactions
        WHERE is_active = 1
    AND(type = 'income' OR type = 'expense')
          AND start_date >= ? AND start_date <= ?
      GROUP BY strftime('%Y-%m', start_date), type
        ORDER BY month_key ASC
      `, [startDate, endDate]);

      // Process monthly aggregates

      // 2. Get Net Worth (Current & Historical)
      const accounts = await all<{ type: string; balance: number }>(`
        SELECT type, balance FROM accounts WHERE status = 'active'
      `);

      let currentNetWorth = accounts.reduce((acc, a) => {
        const isAsset = ['bank', 'wallet', 'investment'].includes(a.type);
        return acc + (isAsset ? a.balance : -a.balance);
      }, 0);

      // Calculate net worth history

      // Process monthly data into arrays
      const labels: string[] = [];
      const income: number[] = [];
      const expenses: number[] = [];

      // We need to support 'months' number of data points.
      // Generate the expected month keys first.
      const expectedMonths: string[] = [];
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mon = d.toLocaleString('default', { month: 'short' });
        const key = toLocalDate(d).slice(0, 7); // YYYY-MM
        labels.push(mon);
        expectedMonths.push(key);
      }

      // Populate Income/Expense arrays based on expected keys
      for (const key of expectedMonths) {
        const mIncome = monthlyData.find(r => r.month_key === key && r.type === 'income')?.total || 0;
        const mExpense = monthlyData.find(r => r.month_key === key && r.type === 'expense')?.total || 0;
        income.push(mIncome);
        expenses.push(mExpense);
      }

      // 3. Net Worth History (Backwards Calculation)
      // Get all changes >= startDate
      const allMonthlyChanges = await all<{ month_key: string; change: number }>(`
    SELECT
    strftime('%Y-%m', start_date) as month_key,
      SUM(CASE WHEN type IN('income', 'asset') THEN amount ELSE - amount END) as change
        FROM transactions
        WHERE is_active = 1 AND start_date >= ?
      GROUP BY month_key
        `, [startDate]);

      // Future changes (strictly > endDate)
      const futureChange = await get<{ total: number }>(`
        SELECT SUM(CASE WHEN type IN('income', 'asset') THEN amount ELSE - amount END) as total
        FROM transactions WHERE is_active = 1 AND start_date > ?
      `, [endDate]);

      let subtractAccumulator = futureChange?.total || 0;
      const resultNetWorth: number[] = [];

      // Iterate from NEWEST (last in array) to OLDEST (first in array) 
      // array index i corresponds to expectedMonths[i]
      // expectedMonths is [Oldest, ..., Newest]
      // We must calculate NW for each month-end.

      // NW[Newest] = CurrentNW - (Future Changes)
      // NW[Newest-1] = NW[Newest] - (Changes in Newest Month)

      // So let's iterate backwards through the array indices
      const nwMap = new Map<number, number>(); // index -> nw

      for (let i = months - 1; i >= 0; i--) {
        const monthKey = expectedMonths[i];

        // NW at end of month i is:
        const nwAtEnd = currentNetWorth - subtractAccumulator;
        nwMap.set(i, nwAtEnd);

        // Update accumulator for the next step (moving backwards in time)
        // We add the change that happened in THIS month, effectively undoing it.
        const chg = allMonthlyChanges.find(r => r.month_key === monthKey)?.change || 0;
        subtractAccumulator += chg;
      }

      // Fill the result array in correct order
      for (let i = 0; i < months; i++) {
        resultNetWorth.push(nwMap.get(i) || 0);
      }

      return {
        labels,
        income,
        expenses,
        netWorth: resultNetWorth
      };

    } catch (e) {
      console.error('[FinanceModel] Failed Dashboard Data', e);
      return { labels: [], income: [], expenses: [], netWorth: [] };
    }
  },

  /**
   * Get aggregated statistics for filtered transactions
   * Used by TransactionsView to show totals without loading all rows
   */
  getTransactionStats: async (options: {
    startDate?: string;
    endDate?: string;
    type?: string;
    category?: string;
    accountId?: number;
    search?: string;
  } = {}) => {
    try {
      const conditions: string[] = ['is_active = 1'];
      const params: any[] = [];

      if (options.startDate) { conditions.push('start_date >= ?'); params.push(options.startDate); }
      if (options.endDate) { conditions.push('start_date <= ?'); params.push(options.endDate); }
      if (options.type && options.type !== 'all') { conditions.push('type = ?'); params.push(options.type); }
      if (options.category) { conditions.push('category = ?'); params.push(options.category); }
      if (options.accountId) { conditions.push('(account_id = ? OR to_account_id = ?)'); params.push(options.accountId, options.accountId); }
      if (options.search) { conditions.push('description LIKE ?'); params.push(`% ${options.search}% `); }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')} ` : '';

      const stats = await get<{
        income: number;
        expense: number;
        transfers: number;
        count: number;
      }>(`
    SELECT
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense,
      COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0) as transfers,
      COUNT(*) as count
        FROM transactions
        ${whereClause}
    `, params);

      // Top Categories (for the filtered range)
      const topCategories = await all<{ category: string; amount: number }>(`
        SELECT category, SUM(amount) as amount
        FROM transactions
        ${whereClause} AND type = 'expense'
        GROUP BY category
        ORDER BY amount DESC
        LIMIT 3
      `, params);

      // Calculate percentages
      const totalExpense = stats?.expense || 1;
      const topCatsWithPercent = topCategories.map(c => ({
        category: c.category,
        amount: c.amount,
        percent: ((c.amount / totalExpense) * 100).toFixed(0)
      }));

      return {
        ...stats,
        topCategories: topCatsWithPercent
      };

    } catch (e) {
      console.error('[FinanceModel] Failed to get transaction stats:', e);
      return { income: 0, expense: 0, transfers: 0, count: 0, topCategories: [] };
    }
  },

  /**
   * Get category statistics for anomaly detection
   * Aggregates data efficiently in DB where possible
   */



  /**
   * Get category spending for a specific period
   * Used by BudgetView to check limits
   */
  getCategorySpending: async (startDate: string, endDate: string) => {
    try {
      return await all<{ category: string; amount: number }>(`
        SELECT category, SUM(amount) as amount
        FROM transactions
        WHERE type = 'expense' AND is_active = 1
          AND start_date >= ? AND start_date <= ?
      GROUP BY category
      `, [startDate, endDate]);
    } catch (e) {
      return [];
    }
  },

  // Import/Export
  exportData: async () => {
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      transactions: await FinanceModel.getAll('transaction', { orderBy: 'start_date DESC' }),
      accounts: await FinanceModel.getAllAccounts(),
      categories: await FinanceModel.getAllCategories(),
      settings: await FinanceModel.getAllSettings(),
      budgets: await FinanceModel.getAllBudgets(),
      goals: await FinanceModel.getAllGoals(),
      goalContributions: await all(`SELECT * FROM goal_contributions`),
      recurringCharges: await FinanceModel.getAllRecurringCharges(),
      billTypes: await FinanceModel.getBillTypes(),
      billReadings: await all(`SELECT * FROM bill_readings`),
    };
  },

  importData: async (data: any) => {
    await run('BEGIN TRANSACTION');
    try {
      // Clear existing data
      const tables = [
        'goal_contributions',
        'bill_readings',
        'goals',
        'recurring_charges',
        'bill_types',
        'transactions',
        'accounts',
        'categories',
        'settings',
        'budgets',
      ];
      for (const table of tables) await run(`DELETE FROM ${table} `);

      // Restore data (simplified, using direct SQL for performance)
      for (const acc of data.accounts || []) {
        await run(
          `INSERT INTO accounts(id, name, type, balance, initial_balance, currency, status) VALUES(?, ?, ?, ?, ?, ?, ?)`,
          [
            acc.id,
            acc.name,
            acc.type,
            acc.balance,
            acc.initial_balance || acc.balance,
            acc.currency || 'USD',
            acc.status || 'active',
          ]
        );
      }
      for (const cat of data.categories || []) {
        await run(
          `INSERT INTO categories(id, type, name, status, is_default, color, icon) VALUES(?, ?, ?, ?, ?, ?, ?)`,
          [
            cat.id,
            cat.type,
            cat.name,
            cat.status || 'active',
            cat.is_default || 0,
            cat.color || '#7b68ee',
            cat.icon || '📂',
          ]
        );
      }
      for (const t of data.transactions || []) {
        await run(
          `INSERT INTO transactions(id, account_id, to_account_id, type, category, amount, description, attachment, frequency, start_date, end_date, currency, tags, is_active) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            t.id,
            t.account_id,
            t.to_account_id,
            t.type,
            t.category,
            t.amount,
            t.description,
            t.attachment,
            t.frequency,
            t.start_date,
            t.end_date,
            t.currency,
            t.tags,
            t.is_active ?? 1,
          ]
        );
      }
      for (const key in data.settings || {}) {
        await run(`INSERT INTO settings(key, value, category) VALUES(?, ?, 'general')`, [
          key,
          data.settings[key],
        ]);
      }
      for (const b of data.budgets || []) {
        await run(
          `INSERT INTO budgets(id, category, amount, period, start_date, end_date, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)`,
          [b.id, b.category, b.amount, b.period, b.start_date, b.end_date, b.created_at]
        );
      }
      for (const g of data.goals || []) {
        await run(
          `INSERT INTO goals(id, name, description, target_amount, current_amount, monthly_contribution, icon, color, priority, target_date, status, auto_contribute, created_at, completed_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            g.id,
            g.name,
            g.description,
            g.target_amount,
            g.current_amount,
            g.monthly_contribution,
            g.icon,
            g.color,
            g.priority,
            g.target_date,
            g.status,
            g.auto_contribute,
            g.created_at,
            g.completed_at,
          ]
        );
      }
      for (const gc of data.goalContributions || []) {
        await run(
          `INSERT INTO goal_contributions(id, goal_id, amount, source, notes, contributed_at) VALUES(?, ?, ?, ?, ?, ?)`,
          [gc.id, gc.goal_id, gc.amount, gc.source, gc.notes, gc.contributed_at]
        );
      }
      for (const rc of data.recurringCharges || []) {
        await run(
          `INSERT INTO recurring_charges(id, category, name, amount, frequency, due_day, next_due_date, is_active, notes, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            rc.id,
            rc.category,
            rc.name,
            rc.amount,
            rc.frequency,
            rc.due_day,
            rc.next_due_date,
            rc.is_active ?? 1,
            rc.notes,
            rc.created_at,
          ]
        );
      }
      for (const bt of data.billTypes || []) {
        await run(
          `INSERT INTO bill_types(id, name, unit_name, cost_per_unit, category_name, account_id, auto_transaction, icon, color, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            bt.id,
            bt.name,
            bt.unit_name,
            bt.cost_per_unit,
            bt.category_name,
            bt.account_id,
            bt.auto_transaction,
            bt.icon,
            bt.color,
            bt.created_at,
          ]
        );
      }
      for (const br of data.billReadings || []) {
        await run(
          `INSERT INTO bill_readings(id, bill_type_id, date, units_used, total_cost, notes, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)`,
          [br.id, br.bill_type_id, br.date, br.units_used, br.total_cost, br.notes, br.created_at]
        );
      }

      await run('COMMIT');
      return true;
    } catch (err) {
      await run('ROLLBACK');
      throw err;
    }
  },

  // Helper to escape CSV values
  exportAllToCSV: async () => {
    const escapeCSV = (val: unknown) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const tableToCSV = (data: any[], headers: string[]) => {
      if (!data || data.length === 0) return '';
      const headerRow = headers.join(',');
      const dataRows = data.map((row) => headers.map((h) => escapeCSV(row[h])).join(','));
      return [headerRow, ...dataRows].join('\n');
    };

    const sections = [];
    sections.push('## ACCOUNTS');
    sections.push(
      tableToCSV(await FinanceModel.getAllAccounts(), [
        'id',
        'name',
        'type',
        'balance',
        'initial_balance',
        'currency',
        'status',
      ])
    );
    sections.push('\n## TRANSACTIONS');
    sections.push(
      tableToCSV(await FinanceModel.getAll('transaction', { orderBy: 'start_date DESC' }), [
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
      ])
    );
    sections.push('\n## CATEGORIES');
    sections.push(
      tableToCSV(await FinanceModel.getAllCategories(), [
        'id',
        'type',
        'name',
        'status',
        'is_default',
        'color',
        'icon',
      ])
    );
    sections.push('\n## BUDGETS');
    sections.push(
      tableToCSV(await FinanceModel.getAllBudgets(), [
        'id',
        'category',
        'amount',
        'period',
        'start_date',
        'end_date',
        'created_at',
      ])
    );
    sections.push('\n## GOALS');
    sections.push(
      tableToCSV(await FinanceModel.getAllGoals(), [
        'id',
        'name',
        'description',
        'target_amount',
        'current_amount',
        'monthly_contribution',
        'target_date',
        'status',
        'priority',
      ])
    );
    sections.push('\n## GOAL_CONTRIBUTIONS');
    sections.push(
      tableToCSV(await all(`SELECT * FROM goal_contributions ORDER BY contributed_at DESC`), [
        'id',
        'goal_id',
        'amount',
        'source',
        'notes',
        'contributed_at',
      ])
    );
    sections.push('\n## RECURRING_CHARGES');
    sections.push(
      tableToCSV(await FinanceModel.getAllRecurringCharges(), [
        'id',
        'category',
        'name',
        'amount',
        'frequency',
        'due_day',
        'next_due_date',
        'is_active',
        'notes',
      ])
    );
    sections.push('\n## BILL_TYPES');
    sections.push(
      tableToCSV(await FinanceModel.getBillTypes(), [
        'id',
        'name',
        'unit_name',
        'cost_per_unit',
        'category_name',
        'account_id',
        'auto_transaction',
      ])
    );
    sections.push('\n## BILL_READINGS');
    sections.push(
      tableToCSV(await all(`SELECT * FROM bill_readings ORDER BY date DESC`), [
        'id',
        'bill_type_id',
        'date',
        'units_used',
        'total_cost',
        'notes',
      ])
    );

    return sections.join('\n');
  },
};

export default FinanceModel;
