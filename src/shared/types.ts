/**
 * Shared Type Definitions
 * 
 * Used by both Main and Renderer processes to ensure type safety.
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
// ENTITY INTERFACES
// =============================================================================

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  balance: number; // Stored as INTEGER (cents)
  initial_balance: number; // Stored as INTEGER (cents)
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
  amount: number; // Stored as INTEGER (cents)
  description: string | null;
  attachment: string | null;
  frequency: TransactionFrequency;
  start_date: string;
  end_date: string | null;
  currency: string;
  exchange_rate: number;
  to_amount: number | null; // Stored as INTEGER (cents)
  base_currency: string | null;
  base_amount: number | null; // Stored as INTEGER (cents)
  tags: string | null;
  is_active: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  category_name?: string | null;
  account_name?: string | null;
}

export interface TransactionStats {
  income: number;
  expense: number;
  transfers: number;
  count: number;
  byCurrency?: Record<string, { income: number; expense: number; transfers: number }>;
}

export interface TransactionListDTO {
  data: Transaction[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface TransactionPayload {
  account_id: number;
  to_account_id?: number | null;
  type: TransactionType;
  category?: string;
  amount: number;
  description?: string;
  start_date: string;
  end_date?: string | null;
  currency?: string;
  frequency?: TransactionFrequency;
  exchange_rate?: number;
  to_amount?: number;
}

export interface Budget {
  id: number;
  category: string;
  amount: number; // Stored as INTEGER (cents)
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
  target_amount: number; // Stored as INTEGER (cents)
  current_amount: number; // Stored as INTEGER (cents)
  monthly_contribution: number | null; // Stored as INTEGER (cents)
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
  amount: number; // Stored as INTEGER (cents)
  date: string;
  notes: string | null;
  source: string | null;
}

export interface RecurringCharge {
  id: number;
  name: string;
  category: string;
  amount: number; // Stored as INTEGER (cents)
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
  cost_per_unit: number; // Stored as INTEGER (cents)
  category: string; // This might be category_name in DB? DB insert says category_name.
  category_name?: string | null; // Adding optional to be safe, view uses category_name
  account_id: number | null;
  auto_transaction: number;
  icon?: string | null;
  color?: string | null;
  currency?: string;
}

export interface BillReading {
  id: number;
  bill_type_id: number;
  reading_date: string;
  reading_value: number;
  usage_amount: number | null;
  cost: number | null;
  is_paid: number;
  paid_at: string | null;
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

// Bill Projection Interface
export interface BillProjection {
  name: string;
  color: string;
  projected_cost: number;
  this_month_actual: number;
  last_month_actual: number;
}

// =============================================================================
// PAYLOAD INTERFACES (for IPC calls)
// =============================================================================

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
  amount: number; // Stored as INTEGER (cents)
  frequency: TransactionFrequency;
  due_day?: number;
  notes?: string;
  is_active?: boolean | number;
  account_id?: number;
}

export interface BillTypePayload {
  name: string;
  unit_name: string;
  cost_per_unit: number; // Stored as INTEGER (cents)
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
  total_cost: number; // Stored as INTEGER (cents)
  notes?: string;
}

export interface AISettings {
  enabled?: boolean;
  url?: string;
  model?: string;
  promptTx?: string;
  promptInsight?: string;
  promptChat?: string;
}

export interface AppSettings {
  theme?: string;
  currency_base?: string;
  currency_precision?: string;
  forecast_range_default?: string;
  forecast_include_recurring?: string;
  [key: string]: string | undefined;
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

