/**
 * Centralized Validation Module
 *
 * Provides consistent validation across the application.
 * All financial amounts use 2 decimal precision to avoid floating-point errors.
 */

import type {
  Transaction,
  Account,
  Category,
  Budget,
  Goal,
  RecurringCharge,
  BillType,
  BillReading,
  ExchangeRate,
} from '../database/types';

/**
 * Validate and normalize monetary amount
 * @param val - Value to validate
 * @param allowNegative - Whether negative values are allowed (default: false)
 * @returns Normalized amount with 2 decimal places
 */
export function validateAmount(val: unknown, allowNegative: boolean = false): number {
  const num = parseFloat(String(val));
  if (isNaN(num)) {
    throw new Error('Amount must be a valid number');
  }
  if (!allowNegative && num < 0) {
    throw new Error('Amount cannot be negative');
  }
  // Round to 2 decimal places to avoid floating-point precision issues
  return Math.round(num * 100) / 100;
}

/**
 * Validate required fields exist and are not empty
 * @param obj - Object to validate
 * @param fields - Required field names
 */
export function validateRequired(obj: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    const val = obj[field];
    if (val === undefined || val === null || val === '') {
      throw new Error(`${field} is required`);
    }
  }
}

/**
 * Validate value is in allowed set
 * @param val - Value to check
 * @param allowed - Allowed values
 * @param fieldName - Field name for error message
 */
export function validateEnum<T>(val: T, allowed: T[], fieldName: string): void {
  if (!allowed.includes(val)) {
    throw new Error(`Invalid ${fieldName}: must be one of ${allowed.join(', ')}`);
  }
}

/**
 * Validate exchange rate
 * @param val - Rate value
 * @returns Validated rate
 */
export function validateRate(val: unknown): number {
  const num = parseFloat(String(val));
  if (isNaN(num) || num <= 0) {
    throw new Error('Exchange rate must be a positive number');
  }
  return num;
}

/**
 * Validate date string format (YYYY-MM-DD)
 * @param val - Date string
 * @param fieldName - Field name for error message
 * @returns Validated date string
 */
export function validateDate(val: unknown, fieldName: string = 'date'): string | null {
  if (!val) return null;
  const strVal = String(val);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
    throw new Error(`Invalid ${fieldName}: use YYYY-MM-DD format`);
  }
  const d = new Date(strVal);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid ${fieldName}: not a valid date`);
  }
  return strVal;
}

/**
 * Validate field name is safe (alphanumeric + underscore only)
 * Prevents SQL injection via field names
 * @param field - Field name
 * @returns True if safe
 */
export function isSafeFieldName(field: string): boolean {
  return /^[a-z_][a-z0-9_]*$/i.test(field);
}

/**
 * Sanitize and validate a data object for database operations
 * @param data - Data to sanitize
 * @param allowedFields - List of allowed field names
 * @returns Sanitized data with only allowed fields
 */
export function sanitizeData<T extends object>(data: T, allowedFields: string[]): Partial<T> {
  const result: Partial<T> = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      const key = field as keyof T;
      if (data[key] !== undefined) {
        result[key] = data[key];
      }
    }
  }
  return result;
}

/**
 * Entity-specific validators
 */
type EntityValidator<T> = (data: Partial<T>, isCreate?: boolean) => Partial<T>;

export const EntityValidators: {
  transaction: EntityValidator<Transaction>;
  account: EntityValidator<Account>;
  category: EntityValidator<Category>;
  budget: EntityValidator<Budget>;
  goal: EntityValidator<Goal>;
  recurringCharge: EntityValidator<RecurringCharge>;
  billType: EntityValidator<BillType>;
  billReading: EntityValidator<BillReading>;
  exchangeRate: EntityValidator<ExchangeRate>;
} = {
  transaction: (data, isCreate = false) => {
    if (isCreate) {
      validateRequired(data as Record<string, unknown>, [
        'type',
        'amount',
        'start_date',
        'account_id',
      ]);
      // Category is mandatory unless it's a transfer
      if (data.type !== 'transfer') {
        validateRequired(data as Record<string, unknown>, ['category']);
      }
      // To Account is mandatory for transfers
      if (data.type === 'transfer') {
        validateRequired(data as Record<string, unknown>, ['to_account_id']);
      }
    }
    if (data.type) {
      validateEnum(data.type, ['income', 'expense', 'transfer', 'asset', 'liability'], 'type');
    }

    // Enforce "Transfer" best practice: Transfers should not have a user-defined category.
    if (data.type === 'transfer') {
      // We use 'as any' because Partial<T> fields are optional but we want to explicitly set them to null
      (data as any).category = null;
      (data as any).category_id = null;
    }

    if (data.amount !== undefined) {
      data.amount = validateAmount(data.amount);
    }
    if (data.frequency) {
      validateEnum(data.frequency, ['once', 'weekly', 'monthly', 'yearly'], 'frequency');
    }
    if (data.start_date) {
      // @ts-ignore - validateDate returns string | null, but we need string for strict types here if present?
      // Actually types.ts defines start_date as string. validateDate returns string | null.
      const d = validateDate(data.start_date, 'start_date');
      if (d) data.start_date = d;
    }
    if (data.end_date) {
      const d = validateDate(data.end_date, 'end_date');
      if (d) data.end_date = d;
    }
    return data;
  },

  account: (data, isCreate = false) => {
    if (isCreate) {
      validateRequired(data as Record<string, unknown>, ['name', 'type']);
    }
    if (data.type) {
      validateEnum(
        data.type,
        ['bank', 'wallet', 'credit_card', 'loan', 'investment', 'other'],
        'type'
      );
    }
    if (data.balance !== undefined) {
      data.balance = validateAmount(data.balance, true); // Allow negative for liabilities
    }
    if (data.initial_balance !== undefined) {
      data.initial_balance = validateAmount(data.initial_balance, true);
    }
    return data;
  },

  category: (data, isCreate = false) => {
    if (isCreate) {
      validateRequired(data as Record<string, unknown>, ['type', 'name']);
    }
    if (data.type) {
      data.type = String(data.type).toLowerCase() as any;
      validateEnum(data.type, ['income', 'expense', 'asset', 'liability', 'transfer'], 'type');
    }
    return data;
  },

  budget: (data, isCreate = false) => {
    if (isCreate) {
      validateRequired(data as Record<string, unknown>, [
        'category',
        'amount',
        'start_date',
        'end_date',
      ]);
    }
    if (data.amount !== undefined) {
      data.amount = validateAmount(data.amount);
    }
    if (data.period) {
      validateEnum(data.period, ['once', 'weekly', 'monthly', 'yearly'], 'period');
    }
    return data;
  },

  goal: (data, isCreate = false) => {
    if (isCreate) {
      validateRequired(data as Record<string, unknown>, ['name', 'target_amount']);
    }
    if (data.target_amount !== undefined) {
      data.target_amount = validateAmount(data.target_amount);
    }
    if (data.current_amount !== undefined) {
      data.current_amount = validateAmount(data.current_amount);
    }
    if (data.monthly_contribution !== undefined) {
      data.monthly_contribution = validateAmount(data.monthly_contribution);
    }
    return data;
  },

  recurringCharge: (data, isCreate = false) => {
    if (isCreate) {
      validateRequired(data as Record<string, unknown>, ['name', 'category', 'amount']);
    }
    if (data.amount !== undefined) {
      data.amount = validateAmount(data.amount);
    }
    if (data.frequency) {
      validateEnum(data.frequency, ['weekly', 'monthly', 'yearly'], 'frequency');
    }
    return data;
  },

  billType: (data, isCreate = false) => {
    if (isCreate) {
      validateRequired(data as Record<string, unknown>, ['name']);
    }
    if (data.cost_per_unit !== undefined) {
      data.cost_per_unit = validateAmount(data.cost_per_unit);
    }
    return data;
  },

  billReading: (data, isCreate = false) => {
    if (isCreate) {
      validateRequired(data as Record<string, unknown>, [
        'bill_type_id',
        'date',
        'units_used',
        'total_cost',
      ]);
    }
    if (data.total_cost !== undefined) {
      data.total_cost = validateAmount(data.total_cost);
    }
    if (data.units_used !== undefined) {
      data.units_used = validateAmount(data.units_used);
    }
    return data;
  },

  exchangeRate: (data, isCreate = false) => {
    if (isCreate) {
      validateRequired(data as Record<string, unknown>, ['from_currency', 'to_currency', 'rate']);
    }
    if (data.rate !== undefined) {
      data.rate = validateRate(data.rate);
    }
    return data;
  },
};
