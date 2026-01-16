/**
 * Database Type Definitions
 *
 * Central type definitions for all database entities and operations.
 * These types ensure type safety across the application.
 */

import type { Database, RunResult } from 'sqlite3';

// =============================================================================
// DATABASE HELPER TYPES
// =============================================================================

export interface DbRunResult {
  id: number;
  changes: number;
}

export interface DbHelpers {
  run: (sql: string, params?: unknown[]) => Promise<DbRunResult>;
  get: <T = unknown>(sql: string, params?: unknown[]) => Promise<T | undefined>;
  all: <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
}

// =============================================================================
// MIGRATION TYPES
// =============================================================================

export interface Migration {
  id: number;
  name: string;
  up: () => Promise<void>;
}

export interface AppliedMigration {
  id: number;
  name: string;
  applied_at: string;
}

export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
}

// =============================================================================
// ENTITY TYPES
// =============================================================================

export interface Account {
  id: number;
  name: string;
  type: 'bank' | 'wallet' | 'credit_card' | 'loan' | 'investment' | 'other';
  balance: number;
  initial_balance: number;
  currency: string;
  status: 'active' | 'archived';
  deleted_at: string | null;
  updated_at: string;
}

export interface Category {
  id: number;
  type: 'income' | 'expense' | 'asset' | 'liability' | 'transfer';
  name: string;
  is_default: number;
  color: string;
  icon: string;
  status: 'active' | 'archived';
  deleted_at: string | null;
  updated_at: string;
}

export interface Transaction {
  id: number;
  account_id: number | null;
  to_account_id: number | null;
  type: 'income' | 'expense' | 'asset' | 'liability' | 'transfer';
  category: string;
  category_id: number | null;
  amount: number;
  description: string | null;
  attachment: string | null;
  frequency: 'once' | 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  end_date: string | null;
  currency: string;
  exchange_rate: number;
  to_amount: number | null;
  base_currency: string | null;
  base_amount: number | null;
  tags: string | null;
  is_active: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: number;
  category: string;
  category_id: number | null;
  amount: number;
  period: 'once' | 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  end_date: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: number;
  name: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number;
  icon: string;
  color: string;
  priority: number;
  target_date: string | null;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  auto_contribute: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface GoalContribution {
  id: number;
  goal_id: number;
  amount: number;
  source: string | null;
  notes: string | null;
  account_id: number | null;
  transaction_id: number | null;
  contributed_at: string;
}

export interface RecurringCharge {
  id: number;
  category: string;
  category_id: number | null;
  name: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'yearly';
  due_day: number;
  next_due_date: string | null;
  is_active: number;
  notes: string | null;
  account_id: number | null;
  last_transaction_id: number | null;
  last_generated_date: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillType {
  id: number;
  name: string;
  unit_name: string;
  cost_per_unit: number;
  category_name: string | null;
  account_id: number | null;
  auto_transaction: number;
  icon: string;
  color: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillReading {
  id: number;
  bill_type_id: number;
  date: string;
  units_used: number;
  total_cost: number;
  notes: string | null;
  transaction_id: number | null;
  created_at: string;
}

export interface ExchangeRate {
  id: number;
  from_currency: string;
  to_currency: string;
  rate: number;
  source: string;
  updated_at: string;
}

export interface Setting {
  key: string;
  value: string;
  category: string;
  updated_at: string;
}

export interface TransactionHistory {
  id: number;
  transaction_id: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  old_data: string | null;
  new_data: string | null;
  changed_by: string;
  changed_at: string;
}

// =============================================================================
// VIEW TYPES
// =============================================================================

export interface TransactionWithCategory extends Transaction {
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
  account_name: string | null;
  to_account_name: string | null;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type TableName =
  | 'accounts'
  | 'transactions'
  | 'categories'
  | 'budgets'
  | 'goals'
  | 'goal_contributions'
  | 'recurring_charges'
  | 'bill_types'
  | 'bill_readings'
  | 'exchange_rates'
  | 'settings'
  | 'transaction_history'
  | 'migrations';

export interface DatabaseConfig {
  path: string;
  encryptionKey: string;
  isDev: boolean;
}

export interface MigrationContext {
  run: DbHelpers['run'];
  get: DbHelpers['get'];
  all: DbHelpers['all'];
  log: (message: string) => void;
}

// Re-export sqlite3 types for convenience
export type { Database, RunResult };
