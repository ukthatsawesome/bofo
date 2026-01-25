export const APP_NAME = 'Bofo';
export const VERSION = '1.1.2';

// AI Configuration
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
export const AI_REQUEST_TIMEOUT_MS = 30000;

export const VIEW_IDS = {
  DASHBOARD: 'dashboard',
  TRANSACTIONS: 'transactions',
  FORECAST: 'forecast',
  BUDGET: 'budget',
  SANDBOX: 'whatif',
  SETTINGS: 'settings',
} as const;

export const TRANSACTION_TYPES = {
  INCOME: 'income',
  EXPENSE: 'expense',
  TRANSFER: 'transfer',
} as const;

export const ACCOUNT_TYPES = {
  BANK: 'bank',
  WALLET: 'wallet',
  CREDIT_CARD: 'credit_card',
  LOAN: 'loan',
  INVESTMENT: 'investment',
} as const;

