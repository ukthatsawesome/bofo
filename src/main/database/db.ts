/**
 * Database Connection & Migration System
 *
 * This module uses SQLCipher for AES-256 encryption at rest.
 * All database files are encrypted with a unique key per installation.
 *
 * Security Features:
 * - AES-256 encryption (SQLCipher)
 * - Unique encryption key per installation
 * - Dev/Production database separation
 * - Automatic migration from unencrypted databases
 * - Foreign key enforcement
 * - Audit trail for all changes
 *
 * @module database/db
 */

import * as path from 'path';
import * as fs from 'fs';
import { createDbHelpers } from './helpers';
import {
  getOrCreateEncryptionKey,
  isDatabaseEncrypted,
  getSQLCipherConfig,
  isDev,
  log,
} from './encryption';
import type { Database, DbHelpers, Migration, AppliedMigration, ColumnInfo } from './types';
import type { App } from 'electron';
import {
  addColumnIfNotExists,
  addColumns,
  createIndex,
  createIndexes,
  createTrigger,
  hasColumn,
  getColumnNames,
} from './migrations/utils';
// =============================================================================
// DATABASE ENGINE INITIALIZATION
// =============================================================================

// Use SQLCipher instead of plain sqlite3
let sqlite3: typeof import('sqlite3');
try {
  sqlite3 = require('@journeyapps/sqlcipher').verbose();
  log('[DB] Using SQLCipher engine');
} catch {
  log('[DB] Falling back to plain sqlite3');
  sqlite3 = require('sqlite3').verbose();
}

// Get Electron app reference
let app: App | null;
try {
  app = require('electron').app;
} catch {
  app = null;
}

log(`[DB] Environment: ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'}`);

// =============================================================================
// DATABASE PATH CONFIGURATION
// =============================================================================

const dbPath = isDev
  ? path.join(__dirname, '../../finance.dev.db')
  : path.join(app!.getPath('userData'), 'finance.db');

log(`[DB] Path: ${dbPath}`);

// Get encryption key
const encryptionKey = getOrCreateEncryptionKey();

// =============================================================================
// PLAINTEXT MIGRATION CHECK
// =============================================================================

// Check if we need to migrate from unencrypted database
// SAFER CHECK: Only migrate if we are CERTAIN it is plaintext.
const isEnc = isDatabaseEncrypted(dbPath);
const needsMigration = isEnc === false && fs.existsSync(dbPath);
const backupPath = dbPath + '.plaintext.bak';

if (needsMigration) {
  log('[DB] Detected plaintext database. Starting migration...');
  try {
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    fs.renameSync(dbPath, backupPath);
    log(`[DB] Moved plaintext to backup: ${backupPath}`);
  } catch (error) {
    log(`[DB] Migration rename failed: ${(error as Error).message}`);
    process.exit(1);
  }
} else {
  log(`[DB] Migration skipped. (isEncrypted: ${isEnc})`);
}

// =============================================================================
// DATABASE CONNECTION
// =============================================================================

// Promise for database initialization
let dbResolve: () => void;
let dbReject: (error: Error) => void;
const dbInitialized = new Promise<void>((resolve, reject) => {
  dbResolve = resolve;
  dbReject = reject;
});

// Create database connection
const db = new sqlite3.Database(dbPath, async (err) => {
  if (err) {
    log(`[DB] FAILED to open: ${err.message}`);
    dbReject(err);
    return;
  }

  log('[DB] Connected successfully');

  try {
    await configureEncryption();
    if (needsMigration) await migrateFromBackup(backupPath);
    await bootstrapDb();
    log('[DB] Initialization complete');
    dbResolve();
  } catch (error) {
    log(`[DB] Initialization FAILED: ${(error as Error).message}`);
    dbReject(error as Error);
  }
});

// =============================================================================
// ENCRYPTION CONFIGURATION
// =============================================================================

/**
 * Configure SQLCipher encryption settings
 */
async function configureEncryption(): Promise<void> {
  const pragmas = [
    ...getSQLCipherConfig(encryptionKey),
    'PRAGMA journal_mode = WAL',
    'PRAGMA synchronous = NORMAL',
  ];

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      for (const pragma of pragmas) {
        db.run(pragma, (err: Error | null) => {
          if (err) console.error(`[DB] Pragma failed: ${pragma}`, err);
        });
      }

      // Enable foreign key enforcement (critical for data integrity)
      db.run('PRAGMA foreign_keys = ON', (err: Error | null) => {
        if (err) console.error('[DB] Failed to enable foreign keys:', err);
        else log('[DB] Foreign key enforcement enabled');
      });

      // Verify key
      db.get('SELECT count(*) FROM sqlite_master', (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

// =============================================================================
// PLAINTEXT BACKUP MIGRATION
// =============================================================================

/**
 * Migrate data from plaintext backup to new encrypted database
 */
async function migrateFromBackup(backupFile: string): Promise<void> {
  console.log('[DB] Importing data from plaintext backup...');

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Attach plaintext backup with empty key
      db.run(`ATTACH DATABASE ? AS backup KEY ''`, [backupFile], (err: Error | null) => {
        if (err) return reject(err);

        // Get all tables from backup
        db.all(
          "SELECT name, sql FROM backup.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
          [],
          async (err: Error | null, tables: Array<{ name: string; sql: string }>) => {
            if (err) return reject(err);

            try {
              db.run('BEGIN TRANSACTION');

              for (const table of tables) {
                if (table.name === 'android_metadata') continue;

                console.log(`[DB] Migrating table: ${table.name}`);

                await new Promise<void>((res, rej) => {
                  db.run(table.sql, (e: Error | null) => (e ? rej(e) : res()));
                });

                await new Promise<void>((res, rej) => {
                  db.run(
                    `INSERT INTO main.${table.name} SELECT * FROM backup.${table.name}`,
                    (e: Error | null) => (e ? rej(e) : res())
                  );
                });
              }

              db.run('COMMIT');

              // Detach backup
              db.run('DETACH DATABASE backup', (e: Error | null) => {
                if (e) reject(e);
                else resolve();
              });
            } catch (migrationErr) {
              db.run('ROLLBACK');
              reject(migrationErr);
            }
          }
        );
      });
    });
  });
}

// =============================================================================
// DATABASE HELPERS (Promisified)
// =============================================================================

const { run, get, all } = createDbHelpers(db);

// =============================================================================
// MIGRATION DEFINITIONS
// =============================================================================

/**
 * All database migrations.
 * Each migration has an ID, name, and up() function.
 * Migrations are run in order and wrapped in a transaction.
 */
const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'Fix Transaction Attachments',
    up: async () => {
      const colNames = await getColumnNames(all, 'transactions');

      if (!colNames.includes('attachment')) {
        if (colNames.includes('attachment_path')) {
          await run(`ALTER TABLE transactions RENAME COLUMN attachment_path TO attachment`);
        } else if (colNames.includes('attached_path')) {
          await run(`ALTER TABLE transactions RENAME COLUMN attached_path TO attachment`);
        } else {
          await run('ALTER TABLE transactions ADD COLUMN attachment TEXT');
        }
      }
    },
  },
  {
    id: 2,
    name: 'Enhance Accounts Table',
    up: async () => {
      await addColumns(
        { run, get, all },
        'accounts',
        [
          { name: 'initial_balance', definition: 'REAL DEFAULT 0' },
          { name: 'currency', definition: "TEXT DEFAULT 'USD'" },
        ],
        log
      );

      // Backfill initial_balance from balance
      await run(
        'UPDATE accounts SET initial_balance = balance WHERE initial_balance = 0 OR initial_balance IS NULL'
      );
    },
  },
  {
    id: 3,
    name: 'Enhance Budgets Table',
    up: async () => {
      const added = await addColumns(
        { run, get, all },
        'budgets',
        [
          { name: 'start_date', definition: 'TEXT' },
          { name: 'end_date', definition: 'TEXT' },
          { name: 'created_at', definition: "TEXT DEFAULT '2025-01-01 00:00:00'" },
        ],
        log
      );

      if (added > 0) {
        // Set defaults for existing rows
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        await run(`UPDATE budgets SET start_date = ?, end_date = ? WHERE start_date IS NULL`, [
          start,
          end,
        ]);
      }
    },
  },
  {
    id: 4,
    name: 'Linking Bills to Categories',
    up: async () => {
      await addColumnIfNotExists({ run, get, all }, 'bill_types', 'category_name', 'TEXT', log);
    },
  },
  {
    id: 5,
    name: 'Bill Auto-Transaction Fields',
    up: async () => {
      await addColumns(
        { run, get, all },
        'bill_types',
        [
          { name: 'account_id', definition: 'INTEGER' },
          { name: 'auto_transaction', definition: 'INTEGER DEFAULT 0' },
        ],
        log
      );
    },
  },
  {
    id: 6,
    name: 'Add Exchange Rates Table',
    up: async () => {
      await run(`
                CREATE TABLE IF NOT EXISTS exchange_rates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    from_currency TEXT NOT NULL,
                    to_currency TEXT NOT NULL,
                    rate REAL NOT NULL,
                    source TEXT DEFAULT 'manual',
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(from_currency, to_currency)
                )
            `);
      await createIndex(run, 'idx_exchange_rates_pair', 'exchange_rates', [
        'from_currency',
        'to_currency',
      ]);

      // Add currency settings
      const settings = [
        ['currency_api_provider', 'frankfurter', 'currency'],
        ['currency_api_url', '', 'currency'],
        ['currency_auto_sync', 'false', 'currency'],
        ['currency_last_sync', '', 'currency'],
      ];
      for (const [key, value, category] of settings) {
        await run(`INSERT OR IGNORE INTO settings (key, value, category) VALUES (?, ?, ?)`, [
          key,
          value,
          category,
        ]);
      }
      log('[DB] Exchange rates table and settings created.');
    },
  },
  {
    id: 7,
    name: 'Add Performance Indexes',
    up: async () => {
      await createIndexes(run, [
        // Transactions indexes
        { name: 'idx_transactions_account', table: 'transactions', columns: 'account_id' },
        { name: 'idx_transactions_to_account', table: 'transactions', columns: 'to_account_id' },
        { name: 'idx_transactions_category', table: 'transactions', columns: 'category' },
        { name: 'idx_transactions_is_active', table: 'transactions', columns: 'is_active' },
        { name: 'idx_transactions_created_at', table: 'transactions', columns: 'created_at' },
        // Composite indexes
        {
          name: 'idx_transactions_active_date',
          table: 'transactions',
          columns: ['is_active', 'start_date DESC'],
        },
        {
          name: 'idx_transactions_account_date',
          table: 'transactions',
          columns: ['account_id', 'start_date DESC'],
        },
        {
          name: 'idx_transactions_type_date',
          table: 'transactions',
          columns: ['type', 'start_date DESC'],
        },
        {
          name: 'idx_transactions_category_date',
          table: 'transactions',
          columns: ['category', 'start_date DESC'],
        },
        // Other indexes
        { name: 'idx_categories_type', table: 'categories', columns: 'type' },
        { name: 'idx_categories_status', table: 'categories', columns: 'status' },
        { name: 'idx_accounts_type', table: 'accounts', columns: 'type' },
        { name: 'idx_accounts_status', table: 'accounts', columns: 'status' },
        { name: 'idx_budgets_category', table: 'budgets', columns: 'category' },
        { name: 'idx_budgets_dates', table: 'budgets', columns: ['start_date', 'end_date'] },
        {
          name: 'idx_contributions_date',
          table: 'goal_contributions',
          columns: 'contributed_at DESC',
        },
      ]);
      log('[DB] Performance indexes created successfully.');
    },
  },
  {
    id: 8,
    name: 'Add Balance Sync Triggers',
    up: async () => {
      // This migration creates balance sync triggers
      // The triggers were later updated in migration 9 for multi-currency support
      // See migration 9 for the current trigger definitions
      log('[DB] Balance sync triggers (superseded by migration 9)');
    },
  },
  {
    id: 9,
    name: 'Add Cross-Currency Transfer Support',
    up: async () => {
      await addColumns(
        { run, get, all },
        'transactions',
        [
          { name: 'exchange_rate', definition: 'REAL DEFAULT 1' },
          { name: 'to_amount', definition: 'REAL' },
        ],
        log
      );

      // Backfill existing transfers
      await run(
        "UPDATE transactions SET to_amount = amount WHERE type = 'transfer' AND to_amount IS NULL"
      );

      // Create balance sync triggers with multi-currency support
      const balanceCalcSql = (accountRef: string) => `
                SELECT COALESCE(initial_balance, 0) +
                COALESCE((SELECT SUM(CASE 
                    WHEN type = 'income' AND account_id = accounts.id THEN ROUND(amount * 100) / 100
                    WHEN type = 'transfer' AND to_account_id = accounts.id THEN ROUND(COALESCE(to_amount, amount) * 100) / 100
                    ELSE 0 
                END) FROM transactions WHERE (account_id = accounts.id OR to_account_id = accounts.id) AND is_active = 1), 0) -
                COALESCE((SELECT SUM(CASE 
                    WHEN type = 'expense' AND account_id = accounts.id THEN ROUND(amount * 100) / 100
                    WHEN type = 'transfer' AND account_id = accounts.id THEN ROUND(amount * 100) / 100
                    ELSE 0 
                END) FROM transactions WHERE (account_id = accounts.id OR to_account_id = accounts.id) AND is_active = 1), 0)
            `;

      await createTrigger(
        run,
        'trg_balance_after_insert',
        `
                CREATE TRIGGER trg_balance_after_insert
                AFTER INSERT ON transactions
                WHEN NEW.is_active = 1
                BEGIN
                    UPDATE accounts SET balance = (${balanceCalcSql('NEW.account_id')}) WHERE id = NEW.account_id;
                    UPDATE accounts SET balance = (${balanceCalcSql('NEW.to_account_id')}) WHERE id = NEW.to_account_id AND NEW.to_account_id IS NOT NULL;
                END
            `
      );

      await createTrigger(
        run,
        'trg_balance_after_update',
        `
                CREATE TRIGGER trg_balance_after_update
                AFTER UPDATE ON transactions
                BEGIN
                    UPDATE accounts SET balance = (${balanceCalcSql('accounts.id')}) WHERE id IN (OLD.account_id, NEW.account_id) AND id IS NOT NULL;
                    UPDATE accounts SET balance = (${balanceCalcSql('accounts.id')}) WHERE id IN (OLD.to_account_id, NEW.to_account_id) AND id IS NOT NULL;
                END
            `
      );

      await createTrigger(
        run,
        'trg_balance_after_delete',
        `
                CREATE TRIGGER trg_balance_after_delete
                AFTER DELETE ON transactions
                BEGIN
                    UPDATE accounts SET balance = (${balanceCalcSql('OLD.account_id')}) WHERE id = OLD.account_id;
                    UPDATE accounts SET balance = (${balanceCalcSql('OLD.to_account_id')}) WHERE id = OLD.to_account_id AND OLD.to_account_id IS NOT NULL;
                END
            `
      );

      log('[DB] Multi-currency balance triggers created.');
    },
  },
  {
    id: 10,
    name: 'Enable Foreign Key Enforcement',
    up: async () => {
      // FK enforcement is now set at connection time in configureEncryption()
      const result = await get<{ foreign_keys: number }>('PRAGMA foreign_keys');
      log(`[DB] Foreign keys verified: ${result?.foreign_keys === 1 ? 'ENABLED' : 'DISABLED'}`);
    },
  },
  {
    id: 11,
    name: 'Add Audit History Table',
    up: async () => {
      await run(`
                CREATE TABLE IF NOT EXISTS transaction_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    transaction_id INTEGER NOT NULL,
                    action TEXT CHECK(action IN ('CREATE', 'UPDATE', 'DELETE')) NOT NULL,
                    old_data TEXT,
                    new_data TEXT,
                    changed_by TEXT DEFAULT 'system',
                    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

      await createIndexes(run, [
        { name: 'idx_history_tx', table: 'transaction_history', columns: 'transaction_id' },
        { name: 'idx_history_action', table: 'transaction_history', columns: 'action' },
        { name: 'idx_history_date', table: 'transaction_history', columns: 'changed_at DESC' },
      ]);

      // Create audit triggers
      const txFields = `'id', NEW.id, 'account_id', NEW.account_id, 'to_account_id', NEW.to_account_id,
                'type', NEW.type, 'category', NEW.category, 'amount', NEW.amount, 'description', NEW.description,
                'frequency', NEW.frequency, 'start_date', NEW.start_date, 'end_date', NEW.end_date,
                'currency', NEW.currency, 'exchange_rate', NEW.exchange_rate, 'to_amount', NEW.to_amount, 'is_active', NEW.is_active`;

      const txFieldsOld = txFields.replace(/NEW\./g, 'OLD.');

      await createTrigger(
        run,
        'trg_audit_tx_insert',
        `
                CREATE TRIGGER trg_audit_tx_insert AFTER INSERT ON transactions
                BEGIN
                    INSERT INTO transaction_history (transaction_id, action, new_data)
                    VALUES (NEW.id, 'CREATE', json_object(${txFields}));
                END
            `
      );

      await createTrigger(
        run,
        'trg_audit_tx_update',
        `
                CREATE TRIGGER trg_audit_tx_update AFTER UPDATE ON transactions
                BEGIN
                    INSERT INTO transaction_history (transaction_id, action, old_data, new_data)
                    VALUES (NEW.id, 'UPDATE', json_object(${txFieldsOld}), json_object(${txFields}));
                END
            `
      );

      await createTrigger(
        run,
        'trg_audit_tx_delete',
        `
                CREATE TRIGGER trg_audit_tx_delete AFTER DELETE ON transactions
                BEGIN
                    INSERT INTO transaction_history (transaction_id, action, old_data)
                    VALUES (OLD.id, 'DELETE', json_object(${txFieldsOld}));
                END
            `
      );

      log('[DB] Audit history table and triggers created.');
    },
  },
  {
    id: 12,
    name: 'Normalize Category References',
    up: async () => {
      // Add category_id to transactions
      if (
        await addColumnIfNotExists(
          { run, get, all },
          'transactions',
          'category_id',
          'INTEGER REFERENCES categories(id)',
          log
        )
      ) {
        await run(`
                    UPDATE transactions SET category_id = (
                        SELECT c.id FROM categories c WHERE c.name = transactions.category AND c.type = transactions.type
                    )
                `);
      }

      // Add category_id to budgets
      if (
        await addColumnIfNotExists(
          { run, get, all },
          'budgets',
          'category_id',
          'INTEGER REFERENCES categories(id)',
          log
        )
      ) {
        await run(
          `UPDATE budgets SET category_id = (SELECT c.id FROM categories c WHERE c.name = budgets.category AND c.type = 'expense')`
        );
        await run(
          `UPDATE budgets SET category_id = (SELECT c.id FROM categories c WHERE c.name = budgets.category LIMIT 1) WHERE category_id IS NULL`
        );
      }

      // Add category_id to recurring_charges
      if (
        await addColumnIfNotExists(
          { run, get, all },
          'recurring_charges',
          'category_id',
          'INTEGER REFERENCES categories(id)',
          log
        )
      ) {
        await run(
          `UPDATE recurring_charges SET category_id = (SELECT c.id FROM categories c WHERE c.name = recurring_charges.category AND c.type = 'expense')`
        );
        await run(
          `UPDATE recurring_charges SET category_id = (SELECT c.id FROM categories c WHERE c.name = recurring_charges.category LIMIT 1) WHERE category_id IS NULL`
        );
      }

      await createIndexes(run, [
        { name: 'idx_transactions_category_id', table: 'transactions', columns: 'category_id' },
        { name: 'idx_budgets_category_id', table: 'budgets', columns: 'category_id' },
        { name: 'idx_recurring_category_id', table: 'recurring_charges', columns: 'category_id' },
      ]);

      // Create view
      await run(`DROP VIEW IF EXISTS v_transactions_with_category`);
      await run(`
                CREATE VIEW v_transactions_with_category AS
                SELECT t.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon,
                       a.name AS account_name, ta.name AS to_account_name
                FROM transactions t
                LEFT JOIN categories c ON t.category_id = c.id
                LEFT JOIN accounts a ON t.account_id = a.id
                LEFT JOIN accounts ta ON t.to_account_id = ta.id
            `);

      log('[DB] Category normalization complete.');
    },
  },
  {
    id: 13,
    name: 'Add Base Amount Freeze for Currency',
    up: async () => {
      await addColumns(
        { run, get, all },
        'transactions',
        [
          { name: 'base_currency', definition: 'TEXT' },
          { name: 'base_amount', definition: 'REAL' },
        ],
        log
      );

      const baseCurrency = await get<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'currency_base'"
      );
      const defaultBase = baseCurrency?.value || 'USD';
      await run('UPDATE transactions SET base_currency = ? WHERE base_currency IS NULL', [
        defaultBase,
      ]);
      await run(
        `UPDATE transactions SET base_amount = ROUND(amount / COALESCE(exchange_rate, 1) * 100) / 100 WHERE base_amount IS NULL`
      );
      await createIndex(run, 'idx_transactions_base_currency', 'transactions', 'base_currency');
      log('[DB] Base amount freeze complete.');
    },
  },
  {
    id: 14,
    name: 'Add Soft Delete Support',
    up: async () => {
      const tables = [
        'transactions',
        'accounts',
        'categories',
        'budgets',
        'goals',
        'recurring_charges',
        'bill_types',
      ];
      for (const table of tables) {
        await addColumnIfNotExists({ run, get, all }, table, 'deleted_at', 'DATETIME', log);
      }
      await createIndexes(
        run,
        tables.map((t) => ({ name: `idx_${t}_deleted`, table: t, columns: 'deleted_at' }))
      );
      log('[DB] Soft delete support complete.');
    },
  },
  {
    id: 15,
    name: 'Add Updated At Timestamps',
    up: async () => {
      const tables = [
        'transactions',
        'accounts',
        'categories',
        'budgets',
        'goals',
        'recurring_charges',
        'bill_types',
      ];

      for (const table of tables) {
        if (
          await addColumnIfNotExists(
            { run, get, all },
            table,
            'updated_at',
            'DATETIME DEFAULT CURRENT_TIMESTAMP',
            log
          )
        ) {
          // Try to backfill from created_at if it exists
          try {
            await run(`UPDATE ${table} SET updated_at = created_at WHERE updated_at IS NULL`);
          } catch {
            /* created_at might not exist */
          }
        }

        // Create auto-update trigger
        await createTrigger(
          run,
          `trg_${table}_updated_at`,
          `
                    CREATE TRIGGER trg_${table}_updated_at
                    AFTER UPDATE ON ${table}
                    FOR EACH ROW
                    WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
                    BEGIN
                        UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                    END
                `
        );
      }
      log('[DB] Updated_at timestamps with auto-update triggers complete.');
    },
  },
  {
    id: 16,
    name: 'Link Goal Contributions to Accounts',
    up: async () => {
      await addColumns(
        { run, get, all },
        'goal_contributions',
        [
          { name: 'account_id', definition: 'INTEGER REFERENCES accounts(id)' },
          { name: 'transaction_id', definition: 'INTEGER REFERENCES transactions(id)' },
        ],
        log
      );
      await createIndexes(run, [
        { name: 'idx_contributions_account', table: 'goal_contributions', columns: 'account_id' },
        {
          name: 'idx_contributions_transaction',
          table: 'goal_contributions',
          columns: 'transaction_id',
        },
      ]);
      log('[DB] Goal contributions linking complete.');
    },
  },
  {
    id: 17,
    name: 'Link Bill Readings to Transactions',
    up: async () => {
      await addColumnIfNotExists(
        { run, get, all },
        'bill_readings',
        'transaction_id',
        'INTEGER REFERENCES transactions(id)',
        log
      );
      log('[DB] Bill readings linking complete.');
    },
  },
  {
    id: 18,
    name: 'Link Recurring Charges to Transactions',
    up: async () => {
      await addColumns(
        { run, get, all },
        'recurring_charges',
        [
          { name: 'last_transaction_id', definition: 'INTEGER REFERENCES transactions(id)' },
          { name: 'last_generated_date', definition: 'TEXT' },
          { name: 'account_id', definition: 'INTEGER REFERENCES accounts(id)' },
        ],
        log
      );
      await createIndexes(run, [
        {
          name: 'idx_recurring_last_tx',
          table: 'recurring_charges',
          columns: 'last_transaction_id',
        },
        { name: 'idx_recurring_account', table: 'recurring_charges', columns: 'account_id' },
      ]);
      log('[DB] Recurring charges linking complete.');
    },
  },
  {
    id: 19,
    name: 'Optimize Indexes for JOINs',
    up: async () => {
      // Drop conflicting simple index if exists (replaced by composite)
      await run('DROP INDEX IF EXISTS idx_transactions_account');

      await createIndexes(run, [
        {
          name: 'idx_transactions_feed',
          table: 'transactions',
          columns: ['is_active', 'start_date DESC'],
        },
        {
          name: 'idx_transactions_account', // Re-creating as composite
          table: 'transactions',
          columns: ['account_id', 'is_active', 'type', 'amount'],
        },
        {
          name: 'idx_transactions_date_range',
          table: 'transactions',
          columns: ['start_date', 'is_active'],
        },
      ]);
      log('[DB] Optimized indexes created.');
    },
  },
  {
    id: 20, // Audit System Upgrade
    name: 'Audit System Upgrade',
    up: async () => {
      log('[Migration 20] Starting Audit System Upgrade...');

      // 1. Drop old triggers that were causing "System" only logging
      const triggers = [
        'trg_audit_tx_insert',
        'trg_audit_tx_update',
        'trg_audit_tx_delete'
      ];
      
      for (const trigger of triggers) {
        await run(`DROP TRIGGER IF EXISTS ${trigger}`);
      }
      log('[Migration 20] Dropped legacy audit triggers.');

      // 2. Create flexible `audit_logs` table for all non-transaction entities
      await run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_id INTEGER NOT NULL,
          action TEXT CHECK(action IN ('CREATE', 'UPDATE', 'DELETE')) NOT NULL,
          source TEXT DEFAULT 'USER',
          changes JSON,
          metadata JSON,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Index creation
      await createIndex(run, 'idx_audit_logs_entity', 'audit_logs', ['entity_type', 'entity_id']);
      await createIndex(run, 'idx_audit_logs_created_at', 'audit_logs', 'created_at DESC');
      
      log('[Migration 20] Created audit_logs table.');

      // 3. Upgrade `transaction_history` to support Source tracking
      await addColumnIfNotExists({ run, get, all }, 'transaction_history', 'source', "TEXT DEFAULT 'USER'", log);
      await addColumnIfNotExists({ run, get, all }, 'transaction_history', 'metadata', "JSON", log);
      
      log('[Migration 20] Upgraded transaction_history table.');
    }
  }
];

// =============================================================================
// DATABASE BOOTSTRAP
// =============================================================================

/**
 * Bootstrap the database by running the schema and pending migrations
 */
async function bootstrapDb(): Promise<void> {
  try {
    // 1. Run Base Schema (Idempotent)
    // 1. Run Base Schema (Idempotent)
    // Inline schema to avoid issues with missing .sql files in dist/
    const schema = `
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('bank', 'wallet', 'credit_card', 'loan', 'investment', 'other')) NOT NULL,
    balance REAL DEFAULT 0,
    initial_balance REAL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'active',
    deleted_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    to_account_id INTEGER, -- For transfers
    type TEXT CHECK(type IN ('income', 'expense', 'asset', 'liability', 'transfer')) NOT NULL,
    category TEXT NOT NULL, -- Legacy: kept for backward compatibility
    category_id INTEGER, -- Normalized FK reference to categories table
    amount REAL NOT NULL,
    description TEXT,
    attachment TEXT,
    frequency TEXT CHECK(frequency IN ('once', 'weekly', 'monthly', 'yearly')) NOT NULL DEFAULT 'once',
    start_date TEXT NOT NULL,
    end_date TEXT,
    currency TEXT DEFAULT 'USD',
    exchange_rate REAL DEFAULT 1,
    to_amount REAL,
    base_currency TEXT, -- Base currency for reporting (frozen at creation)
    base_amount REAL, -- Amount in base currency (frozen at creation)
    tags TEXT,
    is_active INTEGER DEFAULT 1,
    deleted_at DATETIME, -- Soft delete timestamp
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(account_id) REFERENCES accounts(id),
    FOREIGN KEY(to_account_id) REFERENCES accounts(id),
    FOREIGN KEY(category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT CHECK(type IN ('income', 'expense', 'asset', 'liability', 'transfer')) NOT NULL,
    name TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    color TEXT DEFAULT '#7b68ee',
    icon TEXT DEFAULT '📂',
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived')),
    deleted_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
('backup_on_close', 'true', 'safety'),
('remote_access_enabled', 'false', 'remote'),
('remote_access_port', '5174', 'remote'),
('remote_access_key', '', 'remote');

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
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_account ON transactions(to_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_is_active ON transactions(is_active);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- Composite indexes for common query patterns (pagination, filtering)
CREATE INDEX IF NOT EXISTS idx_transactions_active_date ON transactions(is_active, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type_date ON transactions(type, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category_date ON transactions(category, start_date DESC);

CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL, -- Legacy: kept for backward compatibility
    category_id INTEGER, -- Normalized FK reference to categories table
    amount REAL NOT NULL,
    period TEXT CHECK(period IN ('once', 'weekly', 'monthly', 'yearly')) NOT NULL DEFAULT 'monthly',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id)
);

-- Categories and Accounts indexes
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);
CREATE INDEX IF NOT EXISTS idx_categories_status ON categories(status);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);

-- Budgets indexes
CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category);
CREATE INDEX IF NOT EXISTS idx_budgets_dates ON budgets(start_date, end_date);

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
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- Recurring Charges: Fixed expenses that repeat (rent, subscriptions, utilities)
CREATE TABLE IF NOT EXISTS recurring_charges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL, -- Legacy: kept for backward compatibility
    category_id INTEGER, -- Normalized FK reference to categories table
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    frequency TEXT CHECK(frequency IN ('weekly', 'monthly', 'yearly')) NOT NULL DEFAULT 'monthly',
    due_day INTEGER DEFAULT 1,
    next_due_date TEXT,
    is_active INTEGER DEFAULT 1,
    notes TEXT,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_transaction_id INTEGER, -- Link to most recent generated transaction
    last_generated_date TEXT, -- When was the last transaction generated
    account_id INTEGER, -- Which account to charge from
    FOREIGN KEY(category_id) REFERENCES categories(id),
    FOREIGN KEY(last_transaction_id) REFERENCES transactions(id),
    FOREIGN KEY(account_id) REFERENCES accounts(id)
);

-- Goal Contributions: Track individual contributions to goals
CREATE TABLE IF NOT EXISTS goal_contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    source TEXT,
    notes TEXT,
    account_id INTEGER, -- Which account the contribution came from
    transaction_id INTEGER, -- Link to the transaction created for this contribution
    contributed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE CASCADE,
    FOREIGN KEY(account_id) REFERENCES accounts(id),
    FOREIGN KEY(transaction_id) REFERENCES transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_priority ON goals(priority);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_charges(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_category ON recurring_charges(category);
CREATE INDEX IF NOT EXISTS idx_recurring_last_tx ON recurring_charges(last_transaction_id);
CREATE INDEX IF NOT EXISTS idx_recurring_account ON recurring_charges(account_id);
CREATE INDEX IF NOT EXISTS idx_contributions_goal ON goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_contributions_date ON goal_contributions(contributed_at DESC);
CREATE INDEX IF NOT EXISTS idx_contributions_account ON goal_contributions(account_id);
CREATE INDEX IF NOT EXISTS idx_contributions_transaction ON goal_contributions(transaction_id);

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
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(account_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS bill_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_type_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    units_used REAL NOT NULL,
    total_cost REAL NOT NULL,
    notes TEXT,
    transaction_id INTEGER, -- Link to the auto-generated expense transaction
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(bill_type_id) REFERENCES bill_types(id) ON DELETE CASCADE,
    FOREIGN KEY(transaction_id) REFERENCES transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_bills_date ON bill_readings(date);
CREATE INDEX IF NOT EXISTS idx_bills_type ON bill_readings(bill_type_id);
CREATE INDEX IF NOT EXISTS idx_bill_readings_transaction ON bill_readings(transaction_id);

-- Audit History: Track all transaction changes for compliance and undo support
CREATE TABLE IF NOT EXISTS transaction_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    action TEXT CHECK(action IN ('CREATE', 'UPDATE', 'DELETE')) NOT NULL,
    old_data TEXT,  -- JSON snapshot of before state
    new_data TEXT,  -- JSON snapshot of after state
    changed_by TEXT DEFAULT 'system',
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_history_tx ON transaction_history(transaction_id);
CREATE INDEX IF NOT EXISTS idx_history_action ON transaction_history(action);
CREATE INDEX IF NOT EXISTS idx_history_date ON transaction_history(changed_at DESC);

-- Category ID indexes for normalized FK lookups
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON budgets(category_id);
CREATE INDEX IF NOT EXISTS idx_recurring_category_id ON recurring_charges(category_id);

-- Transactions view with category and account details for easy querying
CREATE VIEW IF NOT EXISTS v_transactions_with_category AS
SELECT 
    t.*,
    c.name AS category_name,
    c.color AS category_color,
    c.icon AS category_icon,
    a.name AS account_name,
    ta.name AS to_account_name
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN accounts a ON t.account_id = a.id
LEFT JOIN accounts ta ON t.to_account_id = ta.id;

-- Soft delete indexes for filtering active records
CREATE INDEX IF NOT EXISTS idx_transactions_deleted ON transactions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_accounts_deleted ON accounts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_categories_deleted ON categories(deleted_at);
CREATE INDEX IF NOT EXISTS idx_budgets_deleted ON budgets(deleted_at);
CREATE INDEX IF NOT EXISTS idx_goals_deleted ON goals(deleted_at);
CREATE INDEX IF NOT EXISTS idx_recurring_deleted ON recurring_charges(deleted_at);
CREATE INDEX IF NOT EXISTS idx_bill_types_deleted ON bill_types(deleted_at);

-- Base currency index for multi-currency reporting
CREATE INDEX IF NOT EXISTS idx_transactions_base_currency ON transactions(base_currency);
`;

    await new Promise<void>((resolve, reject) => {
      db.exec(schema, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 2. Ensure Migrations Table
    await run(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

    // 3. Run Pending Migrations
    await processMigrations();

    console.log('[DB] Database bootstrapping complete.');


  } catch (error) {
    console.error('[DB] Database bootstrap failed:', error);
    throw error;
  }
}

/**
 * Process and apply pending migrations
 */
async function processMigrations(): Promise<void> {
  const applied = await all<AppliedMigration>('SELECT id FROM migrations');
  const appliedIds = new Set(applied.map((m) => m.id));

  for (const migration of MIGRATIONS) {
    if (!appliedIds.has(migration.id)) {
      console.log(`[DB] Running Migration ${migration.id}: ${migration.name}`);
      try {
        await run('BEGIN TRANSACTION');
        await migration.up();
        await run('INSERT INTO migrations (id, name) VALUES (?, ?)', [
          migration.id,
          migration.name,
        ]);
        await run('COMMIT');
        console.log(`[DB] Migration ${migration.id} complete.`);
      } catch (err) {
        await run('ROLLBACK');
        console.error(`[DB] Migration ${migration.id} failed:`, err);
        throw err;
      }
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default db;
export { db, dbInitialized, run, get, all };
