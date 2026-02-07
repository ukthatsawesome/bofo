
import { z } from 'zod';

// =============================================================================
// PRIMITIVES & UTILS
// =============================================================================

export const CurrencySchema = z.string().length(3).regex(/^[A-Z]{3}$/);
export const IDSchema = z.number().int().positive();
export const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)");
export const AmountSchema = z.number().refine((n) => !Number.isNaN(n), { message: "Amount must be a number" });
// Relaxed amount schema that coerces strings to numbers (useful for form inputs)
export const CoercedAmountSchema = z.union([z.string(), z.number()]).transform((val) => {
    const num = Number(val);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
});

// =============================================================================
// ENUMS
// =============================================================================

export const TransactionTypeEnum = z.enum(['income', 'expense', 'transfer', 'asset', 'liability']);
export const FrequencyEnum = z.enum(['once', 'weekly', 'monthly', 'yearly']);
export const AccountTypeEnum = z.enum(['bank', 'wallet', 'credit_card', 'loan', 'investment', 'other']);
export const CategoryTypeEnum = z.enum(['income', 'expense', 'asset', 'liability', 'transfer']);
export const BudgetPeriodEnum = z.enum(['once', 'weekly', 'monthly', 'yearly']);
export const GoalStatusEnum = z.enum(['active', 'completed', 'paused', 'cancelled']);

// =============================================================================
// ENTITY SCHEMAS
// =============================================================================

// --- CATEGORY ---
export const CategorySchema = z.object({
    id: IDSchema.optional(),
    name: z.string().min(1, "Name is required"),
    type: CategoryTypeEnum,
    is_default: z.number().int().min(0).max(1).optional().default(0),
    color: z.string().optional().default('#7b68ee'),
    icon: z.string().optional().default('📂'),
    status: z.enum(['active', 'archived']).optional().default('active'),
});

// --- ACCOUNT ---
export const AccountSchema = z.object({
    id: IDSchema.optional(),
    name: z.string().min(1, "Name is required"),
    type: AccountTypeEnum,
    balance: CoercedAmountSchema.default(0),
    initial_balance: CoercedAmountSchema.default(0),
    currency: CurrencySchema.default('USD'),
    status: z.enum(['active', 'archived']).default('active'),
});

// --- TRANSACTION ---
export const TransactionSchema = z.object({
    id: IDSchema.optional(),
    account_id: IDSchema,
    to_account_id: IDSchema.optional().nullable(),
    type: TransactionTypeEnum,
    category: z.string().optional(), // Legacy: string name
    category_id: IDSchema.optional().nullable(), // Future: FK
    amount: CoercedAmountSchema,
    description: z.string().optional(),
    attachment: z.string().optional(),
    frequency: FrequencyEnum.default('once'),
    start_date: DateStringSchema,
    end_date: DateStringSchema.optional().nullable(),
    currency: CurrencySchema.default('USD'),
    exchange_rate: z.number().positive().default(1),
    to_amount: CoercedAmountSchema.optional(),
    tags: z.string().optional(),
    is_active: z.number().int().min(0).max(1).default(1),
});

// --- BUDGET ---
export const BudgetSchema = z.object({
    id: IDSchema.optional(),
    category: z.string().min(1, "Category is required"),
    category_id: IDSchema.optional().nullable(),
    amount: CoercedAmountSchema.refine((n) => n >= 0, "Budget cannot be negative"),
    period: BudgetPeriodEnum.default('monthly'),
    start_date: DateStringSchema,
    end_date: DateStringSchema,
    currency: CurrencySchema.default('USD'),
});

// --- GOAL ---
export const GoalSchema = z.object({
    id: IDSchema.optional(),
    name: z.string().min(1, "Name is required"),
    target_amount: CoercedAmountSchema.refine((n) => n > 0, "Target must be positive"),
    current_amount: CoercedAmountSchema.default(0),
    monthly_contribution: CoercedAmountSchema.default(0),
    target_date: DateStringSchema.optional().nullable(),
    status: GoalStatusEnum.default('active'),
    icon: z.string().default('target'),
    color: z.string().default('#a29bfe'),
    priority: z.number().int().default(1),
    auto_contribute: z.number().int().min(0).max(1).default(0),
    currency: CurrencySchema.default('USD'),
});

// --- RECURRING CHARGE ---
export const RecurringChargeSchema = z.object({
    id: IDSchema.optional(),
    name: z.string().min(1, "Name is required"),
    category: z.string().min(1, "Category is required"),
    amount: CoercedAmountSchema,
    frequency: z.enum(['weekly', 'monthly', 'yearly']).default('monthly'), // distinct from Transaction frequency?
    due_day: z.number().int().min(1).max(31).default(1),
    next_due_date: DateStringSchema.optional(),
    is_active: z.number().int().min(0).max(1).default(1),
    notes: z.string().optional(),
    currency: CurrencySchema.default('USD'),
    account_id: IDSchema.optional().nullable(),
});

// --- BILL TYPE ---
export const BillTypeSchema = z.object({
    id: IDSchema.optional(),
    name: z.string().min(1, "Bill name is required"),
    unit_name: z.string().default('Units'),
    cost_per_unit: CoercedAmountSchema.default(0),
    category_name: z.string().optional(),
    account_id: IDSchema.optional().nullable(),
    auto_transaction: z.number().int().min(0).max(1).default(0),
    icon: z.string().default('file-text'),
    color: z.string().default('#7c3aed'),
    currency: CurrencySchema.default('USD'),
});

// --- BILL READING ---
export const BillReadingSchema = z.object({
    id: IDSchema.optional(),
    bill_type_id: IDSchema,
    date: DateStringSchema,
    units_used: z.number().min(0, "Units cannot be negative"),
    total_cost: CoercedAmountSchema.refine((n) => n >= 0, "Cost cannot be negative"),
    notes: z.string().optional(),
});

// --- EXCHANGE RATE ---
export const ExchangeRateSchema = z.object({
    id: IDSchema.optional(),
    from_currency: CurrencySchema,
    to_currency: CurrencySchema,
    rate: z.number().positive("Rate must be positive"),
    source: z.string().default('manual'),
});

// --- PAYLOADS ---
export const UpdateSettingSchema = z.object({
    key: z.string().min(1),
    value: z.string(),
});

export const SaveSettingsSchema = z.record(z.string(), z.unknown()); // Loose for now, or strict? settings is Record<string, string> usually.

// =============================================================================
// INFERRED TYPES
// =============================================================================

export type Category = z.infer<typeof CategorySchema>;
export type Account = z.infer<typeof AccountSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type Budget = z.infer<typeof BudgetSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type RecurringCharge = z.infer<typeof RecurringChargeSchema>;
export type BillType = z.infer<typeof BillTypeSchema>;
export type BillReading = z.infer<typeof BillReadingSchema>;
export type ExchangeRate = z.infer<typeof ExchangeRateSchema>;

// =============================================================================
// AI SCHEMAS
// =============================================================================

export const AiInsightSchema = z.object({
    type: z.enum(['success', 'warning', 'danger', 'info']),
    title: z.string(),
    message: z.string(),
    priority: z.number().int().default(3),
});

export const AiAnalysisResponseSchema = z.object({
    insights: z.array(AiInsightSchema),
    summary: z.string().optional(),
    suggestedActions: z.array(z.string()).optional(),
});

export type AiInsight = z.infer<typeof AiInsightSchema>;
export type AiAnalysisResponse = z.infer<typeof AiAnalysisResponseSchema>;

