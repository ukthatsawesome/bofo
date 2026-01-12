/**
 * Centralized Validation Module
 * 
 * Provides consistent validation across the application.
 * All financial amounts use 2 decimal precision to avoid floating-point errors.
 */

export function validateAmount(val: unknown, allowNegative = false): number {
    const num = parseFloat(String(val));
    if (isNaN(num)) {
        throw new Error('Amount must be a valid number');
    }
    if (!allowNegative && num < 0) {
        throw new Error('Amount cannot be negative');
    }
    return Math.round(num * 100) / 100;
}

export function validateRequired(obj: Record<string, unknown>, fields: string[]): void {
    for (const field of fields) {
        const val = obj[field];
        if (val === undefined || val === null || val === '') {
            throw new Error(`${field} is required`);
        }
    }
}

export function validateEnum<T>(val: T, allowed: readonly T[], fieldName: string): void {
    if (!allowed.includes(val)) {
        throw new Error(`Invalid ${fieldName}: must be one of ${allowed.join(', ')}`);
    }
}

export function validateRate(val: unknown): number {
    const num = parseFloat(String(val));
    if (isNaN(num) || num <= 0) {
        throw new Error('Exchange rate must be a positive number');
    }
    return num;
}

export function validateDate(val: string | null | undefined, fieldName = 'date'): string | null {
    if (!val) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        throw new Error(`Invalid ${fieldName}: use YYYY-MM-DD format`);
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) {
        throw new Error(`Invalid ${fieldName}: not a valid date`);
    }
    return val;
}

export function isSafeFieldName(field: string): boolean {
    return /^[a-z_][a-z0-9_]*$/i.test(field);
}

export function sanitizeData<T extends Record<string, unknown>>(
    data: T,
    allowedFields: string[]
): Partial<T> {
    const result: Partial<T> = {};
    for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(data, field) && data[field] !== undefined) {
            (result as Record<string, unknown>)[field] = data[field];
        }
    }
    return result;
}

// Entity data types
export interface TransactionData {
    type?: string;
    category?: string;
    amount?: number;
    start_date?: string;
    end_date?: string | null;
    frequency?: string;
    [key: string]: unknown;
}

export interface AccountData {
    name?: string;
    type?: string;
    balance?: number;
    initial_balance?: number;
    [key: string]: unknown;
}

export interface CategoryData {
    type?: string;
    name?: string;
    [key: string]: unknown;
}

export interface BudgetData {
    category?: string;
    amount?: number;
    start_date?: string;
    end_date?: string;
    period?: string;
    [key: string]: unknown;
}

export interface GoalData {
    name?: string;
    target_amount?: number;
    current_amount?: number;
    monthly_contribution?: number;
    [key: string]: unknown;
}

export interface RecurringChargeData {
    name?: string;
    category?: string;
    amount?: number;
    frequency?: string;
    [key: string]: unknown;
}

export interface BillTypeData {
    name?: string;
    cost_per_unit?: number;
    [key: string]: unknown;
}

export interface BillReadingData {
    bill_type_id?: number;
    date?: string;
    units_used?: number;
    total_cost?: number;
    [key: string]: unknown;
}

export interface ExchangeRateData {
    from_currency?: string;
    to_currency?: string;
    rate?: number;
    [key: string]: unknown;
}

const TRANSACTION_TYPES = ['income', 'expense', 'transfer', 'asset', 'liability'] as const;
const FREQUENCIES = ['once', 'weekly', 'monthly', 'yearly'] as const;
const ACCOUNT_TYPES = ['bank', 'wallet', 'credit_card', 'loan', 'investment', 'other'] as const;
const CATEGORY_TYPES = ['income', 'expense', 'transfer', 'asset', 'liability'] as const;

export const EntityValidators = {
    transaction: (data: TransactionData, isCreate = false): TransactionData => {
        if (isCreate) {
            validateRequired(data as Record<string, unknown>, ['type', 'category', 'amount', 'start_date']);
        }
        if (data.type) {
            validateEnum(data.type, TRANSACTION_TYPES, 'type');
        }
        if (data.amount !== undefined) {
            data.amount = validateAmount(data.amount);
        }
        if (data.frequency) {
            validateEnum(data.frequency, FREQUENCIES, 'frequency');
        }
        if (data.start_date) {
            data.start_date = validateDate(data.start_date, 'start_date') ?? undefined;
        }
        if (data.end_date) {
            data.end_date = validateDate(data.end_date, 'end_date');
        }
        return data;
    },

    account: (data: AccountData, isCreate = false): AccountData => {
        if (isCreate) {
            validateRequired(data as Record<string, unknown>, ['name', 'type']);
        }
        if (data.type) {
            validateEnum(data.type, ACCOUNT_TYPES, 'type');
        }
        if (data.balance !== undefined) {
            data.balance = validateAmount(data.balance, true);
        }
        if (data.initial_balance !== undefined) {
            data.initial_balance = validateAmount(data.initial_balance, true);
        }
        return data;
    },

    category: (data: CategoryData, isCreate = false): CategoryData => {
        if (isCreate) {
            validateRequired(data as Record<string, unknown>, ['type', 'name']);
        }
        if (data.type) {
            validateEnum(data.type, CATEGORY_TYPES, 'type');
        }
        return data;
    },

    budget: (data: BudgetData, isCreate = false): BudgetData => {
        if (isCreate) {
            validateRequired(data as Record<string, unknown>, ['category', 'amount', 'start_date', 'end_date']);
        }
        if (data.amount !== undefined) {
            data.amount = validateAmount(data.amount);
        }
        if (data.period) {
            validateEnum(data.period, FREQUENCIES, 'period');
        }
        return data;
    },

    goal: (data: GoalData, isCreate = false): GoalData => {
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

    recurringCharge: (data: RecurringChargeData, isCreate = false): RecurringChargeData => {
        if (isCreate) {
            validateRequired(data as Record<string, unknown>, ['name', 'category', 'amount']);
        }
        if (data.amount !== undefined) {
            data.amount = validateAmount(data.amount);
        }
        if (data.frequency) {
            validateEnum(data.frequency, ['weekly', 'monthly', 'yearly'] as const, 'frequency');
        }
        return data;
    },

    billType: (data: BillTypeData, isCreate = false): BillTypeData => {
        if (isCreate) {
            validateRequired(data as Record<string, unknown>, ['name']);
        }
        if (data.cost_per_unit !== undefined) {
            data.cost_per_unit = validateAmount(data.cost_per_unit);
        }
        return data;
    },

    billReading: (data: BillReadingData, isCreate = false): BillReadingData => {
        if (isCreate) {
            validateRequired(data as Record<string, unknown>, ['bill_type_id', 'date', 'units_used', 'total_cost']);
        }
        if (data.total_cost !== undefined) {
            data.total_cost = validateAmount(data.total_cost);
        }
        if (data.units_used !== undefined) {
            data.units_used = validateAmount(data.units_used);
        }
        return data;
    },

    exchangeRate: (data: ExchangeRateData, isCreate = false): ExchangeRateData => {
        if (isCreate) {
            validateRequired(data as Record<string, unknown>, ['from_currency', 'to_currency', 'rate']);
        }
        if (data.rate !== undefined) {
            data.rate = validateRate(data.rate);
        }
        return data;
    }
};
