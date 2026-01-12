export const APP_NAME = 'Bofo';
export const VERSION = '1.0.0';

export const VIEW_IDS = {
    DASHBOARD: 'dashboard',
    TRANSACTIONS: 'transactions',
    FORECAST: 'forecast',
    BUDGET: 'budget',
    SANDBOX: 'whatif',
    SETTINGS: 'settings'
} as const;

export type ViewId = typeof VIEW_IDS[keyof typeof VIEW_IDS];

export const TRANSACTION_TYPES = {
    INCOME: 'income',
    EXPENSE: 'expense',
    TRANSFER: 'transfer'
} as const;

export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];

export const ACCOUNT_TYPES = {
    BANK: 'bank',
    WALLET: 'wallet',
    CREDIT_CARD: 'credit_card',
    LOAN: 'loan',
    INVESTMENT: 'investment'
} as const;

export type AccountType = typeof ACCOUNT_TYPES[keyof typeof ACCOUNT_TYPES];
