/**
 * Shared Type Definitions
 *
 * Used by both Main and Renderer processes to ensure type safety.
 *
 * Global Convention:
 * - Financial amounts (amount, balance, etc.) are typically stored as integers (cents).
 * - Date strings follow ISO 8601 format (YYYY-MM-DD).
 */

// =============================================================================
// ENUMS & UNIONS
// =============================================================================

export type TransactionType = 'income' | 'expense' | 'asset' | 'liability' | 'transfer';
export type TransactionFrequency = 'once' | 'weekly' | 'monthly' | 'yearly';
export type AccountType = 'bank' | 'wallet' | 'credit_card' | 'loan' | 'investment' | 'other';
export type AccountStatus = 'active' | 'archived';
export type CategoryStatus = 'active' | 'archived';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'cancelled';

// =============================================================================
// COMMON INTERFACES
// =============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// =============================================================================
// ENTITY INTERFACES (Database Models)
// =============================================================================

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  balance: number; // Stored as integer (cents)
  initial_balance: number; // Stored as integer (cents)
  currency: string;
  status: AccountStatus;
  deleted_at: string | null;
  updated_at: string;
}

export interface Category {
  id: number;
  type: TransactionType;
  name: string;
  is_default: number;
  color: string;
  icon: string;
  status: CategoryStatus;
  deleted_at: string | null;
  updated_at: string;
}

export interface Transaction {
  id: number;
  account_id: number | null;
  to_account_id: number | null;
  type: TransactionType;
  category: string;
  category_id: number | null;
  amount: number; // Stored as integer (cents)
  description: string | null;
  attachment: string | null;
  frequency: TransactionFrequency;
  start_date: string;
  end_date: string | null;
  currency: string;
  exchange_rate: number;
  to_amount: number | null; // Stored as integer (cents)
  base_currency: string | null;
  base_amount: number | null; // Stored as integer (cents)
  tags: string | null;
  is_active: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;

  // Join fields (not in raw table schema)
  category_name?: string | null;
  account_name?: string | null;
}

export interface TransactionWithCategory extends Transaction {
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
  account_name: string | null;
  to_account_name: string | null;
}

export interface Budget {
  id: number;
  category: string;
  amount: number; // Stored as integer (cents)
  period: 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  end_date: string;
  currency?: string;
  created_at: string;
}

export interface Goal {
  id: number;
  name: string;
  description: string | null;
  target_amount: number; // Stored as integer (cents)
  current_amount: number; // Stored as integer (cents)
  monthly_contribution: number | null; // Stored as integer (cents)
  target_date: string | null;
  status: GoalStatus;
  priority: number;
  icon: string | null;
  currency?: string;
  created_at: string;
  updated_at: string;
}

export interface GoalContribution {
  id: number;
  goal_id: number;
  amount: number; // Stored as integer (cents)
  date: string; // DB column is 'contributed_at' in schema, but 'date' used in legacy types
  notes: string | null;
  source: string | null;
}

export interface RecurringCharge {
  id: number;
  name: string;
  category: string;
  amount: number; // Stored as integer (cents)
  frequency: TransactionFrequency;
  due_day: number | null;
  notes: string | null;
  is_active: number | boolean;
  currency?: string;
  created_at?: string;
}

export interface BillType {
  id: number;
  name: string;
  unit_name: string;
  cost_per_unit: number; // Stored as integer (cents)
  category_name: string; // Mapped from DB column 'category_name'
  account_id: number | null;
  auto_transaction: number;
  icon?: string | null;
  color?: string | null;
  currency?: string;
}

export interface BillReading {
  id: number;
  bill_type_id: number;
  date: string;
  units_used: number; // Mapped from DB column 'units_used'
  total_cost: number;
  is_paid?: number;
  paid_at?: string | null;
  notes?: string | null;
}

export interface ExchangeRate {
  id?: number;
  from_currency: string;
  to_currency: string;
  rate: number;
  last_updated: string;
  source?: string;
}

export interface Setting {
  key: string;
  value: string;
  category: string;
  updated_at: string;
}

export interface BillProjection {
  name: string;
  color: string;
  projected_cost: number;
  this_month_actual: number;
  last_month_actual: number;
}

export interface TransactionStats {
  income: number;
  expense: number;
  transfers: number;
  count: number;
  byCurrency?: Record<string, { income: number; expense: number; transfers: number }>;
}

// =============================================================================
// DTOs (Data Transfer Objects)
// =============================================================================

// Aligned with PaginatedResponse to reduce redundancy
export type TransactionListDTO = PaginatedResponse<Transaction>;

// =============================================================================
// PAYLOAD INTERFACES (IPC Inputs)
// =============================================================================

export interface TransactionPayload {
  account_id: number;
  to_account_id?: number | null;
  type: TransactionType;
  category?: string;
  category_id?: number;
  amount: number;
  description?: string;
  start_date: string;
  end_date?: string | null;
  currency?: string;
  frequency?: TransactionFrequency;
  exchange_rate?: number;
  to_amount?: number;
  is_active?: number;
}

export interface CategoryPayload {
  type: TransactionType;
  name: string;
  color?: string;
  icon?: string;
  status?: CategoryStatus;
}

export interface AccountPayload {
  name: string;
  type: AccountType;
  balance?: number;
  initial_balance?: number;
  currency?: string;
  status?: AccountStatus;
}

export interface GoalPayload {
  name: string;
  description?: string;
  target_amount: number;
  current_amount?: number;
  monthly_contribution?: number;
  target_date?: string;
  priority?: number;
  icon?: string;
  color?: string;
}

export interface RecurringChargePayload {
  name: string;
  category: string;
  amount: number; // Stored as integer (cents)
  frequency: TransactionFrequency;
  due_day?: number;
  notes?: string;
  is_active?: boolean | number;
  account_id?: number;
}

export interface BillTypePayload {
  name: string;
  unit_name: string;
  cost_per_unit: number; // Stored as integer (cents)
  category_name?: string;
  account_id?: number;
  auto_transaction?: number;
  icon?: string;
  color?: string;
}

export interface BillReadingPayload {
  bill_type_id: number;
  date: string;
  units_used: number;
  total_cost: number; // Stored as integer (cents)
  notes?: string;
}

export interface TransactionFilter {
  type?: TransactionType;
  accountId?: number;
  category?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AISettings {
  enabled?: boolean;
  url?: string;
  model?: string;
  promptTx?: string;
  promptInsight?: string;
  promptChat?: string;
}

export type AppSettings = Record<string, string>;

export interface CategorySpending {
  category: string;
  amount: number;
  color?: string;
  icon?: string;
  percent?: number;
}

export interface DashboardData {
  labels: string[];
  income: number[];
  expenses: number[];
  netWorth: number[];
  summary: {
    totalIncome: number;
    totalExpense: number;
  };
}

export interface SummaryStats {
  netWorth: number;
  totalBalance: number;
  monthIncome: number;
  monthExpense: number;
  savingsRate: number;
}

export interface AuditLog {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  source: string;
  changes: any;
  metadata: any;
  created_at: string;
}