CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('bank', 'wallet', 'credit_card', 'loan', 'investment', 'other')) NOT NULL,
    balance REAL DEFAULT 0,
    initial_balance REAL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    to_account_id INTEGER, -- For transfers
    type TEXT CHECK(type IN ('income', 'expense', 'asset', 'liability', 'transfer')) NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    attachment TEXT,
    frequency TEXT CHECK(frequency IN ('once', 'weekly', 'monthly', 'yearly')) NOT NULL DEFAULT 'once',
    start_date TEXT NOT NULL,
    end_date TEXT,
    currency TEXT DEFAULT 'USD',
    tags TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(account_id) REFERENCES accounts(id),
    FOREIGN KEY(to_account_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT CHECK(type IN ('income', 'expense', 'asset', 'liability', 'transfer')) NOT NULL,
    name TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    color TEXT DEFAULT '#7b68ee',
    icon TEXT DEFAULT '📂',
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived')),
    UNIQUE(type, name)
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    category TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value, category) VALUES 
('budget_period', 'monthly', 'budget'),
('budget_rollover', 'false', 'budget'),
('forecast_horizon', '6', 'forecast'),
('forecast_uncertain_income', 'ask', 'forecast'),
('forecast_inflation_enabled', 'false', 'forecast'),
('forecast_inflation_rate', '2.5', 'forecast'),
('currency_base', 'USD', 'currency'),
('currency_precision', '2', 'currency'),
('currency_symbol_placement', 'before', 'currency'),
('currency_api_provider', 'frankfurter', 'currency'),
('currency_api_url', '', 'currency'),
('currency_auto_sync', 'false', 'currency'),
('currency_last_sync', '', 'currency'),
('theme', 'dark', 'appearance'),
('landing_view', 'dashboard', 'appearance'),
('backup_on_close', 'true', 'safety');

-- Exchange rates table for multi-currency conversion
CREATE TABLE IF NOT EXISTS exchange_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate REAL NOT NULL,
    source TEXT DEFAULT 'manual',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_currency, to_currency)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair ON exchange_rates(from_currency, to_currency);

-- Insert default categories if they don't exist
INSERT OR IGNORE INTO categories (type, name, is_default) VALUES 
('income', 'Salary', 1),
('income', 'Bonus', 1),
('income', 'Investment', 1),
('expense', 'Rent', 1),
('expense', 'Groceries', 1),
('expense', 'Utilities', 1),
('expense', 'Entertainment', 1),
('asset', 'Cash', 1),
('asset', 'Bank Account', 1),
('asset', 'Savings', 1),
('asset', 'Stocks', 1),
('liability', 'Credit Card', 1),
('liability', 'Loan', 1),
('liability', 'Mortgage', 1),
('transfer', 'Internal Transfer', 1),
('transfer', 'Credit Card Payment', 1),
('transfer', 'Investment Deposit', 1),
('transfer', 'ATM Withdrawal', 1);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(start_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    period TEXT CHECK(period IN ('once', 'weekly', 'monthly', 'yearly')) NOT NULL DEFAULT 'monthly',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Goals: Track savings targets (e.g., laptop, vacation, emergency fund)
CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    target_amount REAL NOT NULL,
    current_amount REAL DEFAULT 0,
    monthly_contribution REAL DEFAULT 0,
    icon TEXT DEFAULT 'target',
    color TEXT DEFAULT '#a29bfe',
    priority INTEGER DEFAULT 1,
    target_date TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'paused', 'cancelled')),
    auto_contribute INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- Recurring Charges: Fixed expenses that repeat (rent, subscriptions, utilities)
CREATE TABLE IF NOT EXISTS recurring_charges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    frequency TEXT CHECK(frequency IN ('weekly', 'monthly', 'yearly')) NOT NULL DEFAULT 'monthly',
    due_day INTEGER DEFAULT 1,
    next_due_date TEXT,
    is_active INTEGER DEFAULT 1,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Goal Contributions: Track individual contributions to goals
CREATE TABLE IF NOT EXISTS goal_contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    source TEXT,
    notes TEXT,
    contributed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_charges(is_active);
CREATE INDEX IF NOT EXISTS idx_contributions_goal ON goal_contributions(goal_id);

-- Bills Tracking
CREATE TABLE IF NOT EXISTS bill_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit_name TEXT DEFAULT 'Units',
    cost_per_unit REAL DEFAULT 0,
    category_name TEXT, -- Link to main categories
    account_id INTEGER, -- Link to specific account
    auto_transaction INTEGER DEFAULT 0, -- Toggle for auto-recording
    icon TEXT DEFAULT 'file-text',
    color TEXT DEFAULT '#7c3aed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(account_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS bill_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_type_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    units_used REAL NOT NULL,
    total_cost REAL NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(bill_type_id) REFERENCES bill_types(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bills_date ON bill_readings(date);
CREATE INDEX IF NOT EXISTS idx_bills_type ON bill_readings(bill_type_id);
