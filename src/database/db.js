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
 */

const path = require('path');
const fs = require('fs');
const { createDbHelpers } = require('./helpers');
const {
    getOrCreateEncryptionKey,
    isDatabaseEncrypted,
    getSQLCipherConfig,
    isDev,
    log
} = require('./encryption');

// Use SQLCipher instead of plain sqlite3
let sqlite3;
try {
    sqlite3 = require('@journeyapps/sqlcipher').verbose();
    log('[DB] Using SQLCipher engine');
} catch (e) {
    log('[DB] Falling back to plain sqlite3');
    sqlite3 = require('sqlite3').verbose();
}

let app;
try {
    app = require('electron').app;
} catch (e) {
    app = null;
}
log(`[DB] Environment: ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'}`);

// Database paths
const dbPath = isDev
    ? path.join(__dirname, '../../finance.dev.db')
    : path.join(app.getPath('userData'), 'finance.db');

log(`[DB] Path: ${dbPath}`);

// Get encryption key
const encryptionKey = getOrCreateEncryptionKey();

// Check if we need to migrate from unencrypted database
// SAFER CHECK: Only migrate if we are CERTAIN it is plaintext.
// If it is encrypted OR we can't tell (null), we skip migration to avoid data loss.
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
        log(`[DB] Migration rename failed: ${error.message}`);
        process.exit(1);
    }
} else {
    log(`[DB] Migration skipped. (isEncrypted: ${isEnc})`);
}

// Create database connection
const db = new sqlite3.Database(dbPath, async (err) => {
    if (err) {
        log(`[DB] FAILED to open: ${err.message}`);
        return;
    }

    log('[DB] Connected successfully');

    try {
        await configureEncryption();
        if (needsMigration) await migrateFromBackup(backupPath);
        await bootstrapDb();
        log('[DB] Initialization complete');
    } catch (error) {
        log(`[DB] Initialization FAILED: ${error.message}`);
    }
});

/**
 * Configure SQLCipher encryption settings
 */
async function configureEncryption() {
    const pragmas = getSQLCipherConfig(encryptionKey);

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            for (const pragma of pragmas) {
                db.run(pragma, (err) => {
                    if (err) console.error(`[DB] Pragma failed: ${pragma}`, err);
                });
            }
            // Verify key
            db.get("SELECT count(*) FROM sqlite_master", (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
}

/**
 * Migrate data from plaintext backup to new encrypted database
 */
async function migrateFromBackup(backupFile) {
    console.log('[DB] Importing data from plaintext backup...');

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Attach plaintext backup
            // Key is empty string for plaintext
            db.run(`ATTACH DATABASE ? AS backup KEY ''`, [backupFile], (err) => {
                if (err) return reject(err);

                // Get all tables from backup
                db.all("SELECT name, sql FROM backup.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], async (err, tables) => {
                    if (err) return reject(err);

                    try {
                        db.run("BEGIN TRANSACTION");

                        for (const table of tables) {
                            if (table.name === 'android_metadata') continue;

                            console.log(`[DB] Migrating table: ${table.name}`);

                            // Create table in main (encrypted) using original schema
                            // We replace "CREATE TABLE" with "CREATE TABLE IF NOT EXISTS"
                            // But usually we can just recreate it.
                            // Note: bootstrapDb will run later to ensure latest schema, 
                            // so we just need to get the data in.

                            // Simplest: CREATE TABLE AS SELECT
                            // usage: CREATE TABLE main.TableName AS SELECT * FROM backup.TableName
                            // But this loses indices and constraints definition from original sql.

                            // Better: Execute original SQL (modified if needed) then INSERT

                            await new Promise((res, rej) => {
                                db.run(table.sql, (e) => e ? rej(e) : res());
                            });

                            await new Promise((res, rej) => {
                                db.run(`INSERT INTO main.${table.name} SELECT * FROM backup.${table.name}`, (e) => e ? rej(e) : res());
                            });
                        }

                        db.run("COMMIT");

                        // Detach backup
                        db.run("DETACH DATABASE backup", (e) => {
                            if (e) reject(e);
                            else resolve();
                        });

                    } catch (migrationErr) {
                        db.run("ROLLBACK");
                        reject(migrationErr);
                    }
                });
            });
        });
    });
}

// Use shared promisified helpers
const { run, get, all } = createDbHelpers(db);

// Migration Definitions
const MIGRATIONS = [
    {
        id: 1,
        name: 'Fix Transaction Attachments',
        up: async () => {
            const columns = await all("PRAGMA table_info(transactions)");
            const colNames = columns.map(c => c.name);

            if (!colNames.includes('attachment')) {
                if (colNames.includes('attachment_path')) {
                    console.log('Migrating attachment_path to attachment...');
                    await run(`ALTER TABLE transactions RENAME COLUMN attachment_path TO attachment`);
                } else if (colNames.includes('attached_path')) {
                    console.log('Migrating attached_path to attachment...');
                    await run(`ALTER TABLE transactions RENAME COLUMN attached_path TO attachment`);
                } else {
                    console.log('Adding missing attachment column...');
                    await run("ALTER TABLE transactions ADD COLUMN attachment TEXT");
                }
            }
        }
    },
    {
        id: 2,
        name: 'Enhance Accounts Table',
        up: async () => {
            const columns = await all("PRAGMA table_info(accounts)");
            const colNames = columns.map(c => c.name);

            if (!colNames.includes('initial_balance')) {
                console.log('Adding initial_balance to accounts...');
                await run("ALTER TABLE accounts ADD COLUMN initial_balance REAL DEFAULT 0");
                await run("UPDATE accounts SET initial_balance = balance");
            }
            if (!colNames.includes('currency')) {
                console.log('Adding currency to accounts...');
                await run(`ALTER TABLE accounts ADD COLUMN currency TEXT DEFAULT 'USD'`);
            }
        }
    },
    {
        id: 3,
        name: 'Enhance Budgets Table',
        up: async () => {
            const columns = await all("PRAGMA table_info(budgets)");
            const colNames = columns.map(c => c.name);

            if (!colNames.includes('start_date')) {
                console.log("Migrating budgets table...");
                await run(`ALTER TABLE budgets ADD COLUMN start_date TEXT`);
                await run(`ALTER TABLE budgets ADD COLUMN end_date TEXT`);
                await run(`ALTER TABLE budgets ADD COLUMN created_at TEXT DEFAULT '2025-01-01 00:00:00'`);

                // Set defaults for existing rows
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                await run(`UPDATE budgets SET start_date = ?, end_date = ? WHERE start_date IS NULL`, [start, end]);
            }
        }
    },
    {
        id: 4,
        name: 'Linking Bills to Categories',
        up: async () => {
            const columns = await all("PRAGMA table_info(bill_types)");
            const colNames = columns.map(c => c.name);

            if (!colNames.includes('category_name')) {
                console.log('Adding category_name to bill_types...');
                await run("ALTER TABLE bill_types ADD COLUMN category_name TEXT");
            }
        }
    },
    {
        id: 5,
        name: 'Bill Auto-Transaction Fields',
        up: async () => {
            const columns = await all("PRAGMA table_info(bill_types)");
            const colNames = columns.map(c => c.name);

            if (!colNames.includes('account_id')) {
                console.log('Adding account_id to bill_types...');
                await run("ALTER TABLE bill_types ADD COLUMN account_id INTEGER");
            }
            if (!colNames.includes('auto_transaction')) {
                console.log('Adding auto_transaction to bill_types...');
                await run("ALTER TABLE bill_types ADD COLUMN auto_transaction INTEGER DEFAULT 0");
            }
        }
    },
    {
        id: 6,
        name: 'Add Exchange Rates Table',
        up: async () => {
            // Create exchange_rates table if it doesn't exist
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
            await run(`CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair ON exchange_rates(from_currency, to_currency)`);

            // Add new currency settings if they don't exist
            const settings = [
                ['currency_api_provider', 'frankfurter', 'currency'],
                ['currency_api_url', '', 'currency'],
                ['currency_auto_sync', 'false', 'currency'],
                ['currency_last_sync', '', 'currency']
            ];

            for (const [key, value, category] of settings) {
                await run(`INSERT OR IGNORE INTO settings (key, value, category) VALUES (?, ?, ?)`, [key, value, category]);
            }

            console.log('Exchange rates table and settings created.');
        }
    }
];

async function bootstrapDb() {
    try {
        // 1. Run Base Schema (Idempotent)
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Execute schema statements one by one or as a block
        // sqlite3 .exec executes multiple statements
        await new Promise((resolve, reject) => {
            db.exec(schema, (err) => {
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
    }
}

async function processMigrations() {
    const applied = await all("SELECT id FROM migrations");
    const appliedIds = new Set(applied.map(m => m.id));

    for (const migration of MIGRATIONS) {
        if (!appliedIds.has(migration.id)) {
            console.log(`[DB] Running Migration ${migration.id}: ${migration.name}`);
            try {
                await run('BEGIN TRANSACTION');
                await migration.up();
                await run('INSERT INTO migrations (id, name) VALUES (?, ?)', [migration.id, migration.name]);
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

module.exports = db;
