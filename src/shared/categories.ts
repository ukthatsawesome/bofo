export interface Category {
  type: 'income' | 'expense' | 'asset' | 'liability' | 'transfer';
  name: string;
  is_default: number;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { type: 'income', name: 'Salary', is_default: 1 },
  { type: 'income', name: 'Bonus', is_default: 1 },
  { type: 'income', name: 'Investment', is_default: 1 },
  { type: 'expense', name: 'Rent', is_default: 1 },
  { type: 'expense', name: 'Groceries', is_default: 1 },
  { type: 'expense', name: 'Utilities', is_default: 1 },
  { type: 'expense', name: 'Entertainment', is_default: 1 },
  { type: 'asset', name: 'Cash', is_default: 1 },
  { type: 'asset', name: 'Bank Account', is_default: 1 },
  { type: 'asset', name: 'Savings', is_default: 1 },
  { type: 'asset', name: 'Stocks', is_default: 1 },
  { type: 'liability', name: 'Credit Card', is_default: 1 },
  { type: 'liability', name: 'Loan', is_default: 1 },
  { type: 'liability', name: 'Mortgage', is_default: 1 },
  { type: 'transfer', name: 'Internal Transfer', is_default: 1 },
  { type: 'transfer', name: 'Credit Card Payment', is_default: 1 },
  { type: 'transfer', name: 'Investment Deposit', is_default: 1 },
  { type: 'transfer', name: 'ATM Withdrawal', is_default: 1 },
];
