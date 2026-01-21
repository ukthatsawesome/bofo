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
  balance: number;
  initial_balance: number;
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
  amount: number;
  description: string | null;
  attachment: string | null;
  frequency: TransactionFrequency;
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
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface Goal {
  id: number;
  name: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number | null;
  target_date: string | null;
  status: GoalStatus;
  priority: number;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalContribution {
  id: number;
  goal_id: number;
  amount: number;
  date: string;
  notes: string | null;
  source: string | null;
}

export interface RecurringCharge {
  id: number;
  name: string;
  category: string;
  amount: number;
  frequency: TransactionFrequency;
  due_day: number | null;
  notes: string | null;
  is_active: number | boolean;
  created_at?: string;
}

export interface BillType {
  id: number;
  name: string;
  unit_name: string;
  cost_per_unit: number;
  category: string; // This might be category_name in DB? DB insert says category_name.
  category_name?: string | null; // Adding optional to be safe, view uses category_name
  account_id: number | null;
  auto_transaction: number;
  icon?: string | null;
  color?: string | null;
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
  updated_at: string;
}

// ... Add other entities as needed (Budget, Goal, etc) - keeping it minimal for PR1 as requested

// =============================================================================
// DATA TRANSFER OBJECTS (DTOs)
// =============================================================================

export interface TransactionListDTO {
  id: number;
  account_id: number;
  start_date: string;    // Matches DB column
  amount: number;
  description: string;   // Coalesced from null
  category_name: string; // Mapped from category
  account_name: string;  // Resolved account name
  type: TransactionType; // Required for UI logic (colors/signs)
  icon?: string;         // Optional resolved icon
}
