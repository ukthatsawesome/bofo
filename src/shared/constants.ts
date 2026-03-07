export const APP_NAME = 'Bofo';
export const VERSION = '1.1.2';

export { DEFAULT_AI_URL as DEFAULT_OLLAMA_URL } from './settings/defaults';
export { DEFAULT_AI_MODEL } from './settings/defaults';
export { DEFAULTS } from './settings/defaults';

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
