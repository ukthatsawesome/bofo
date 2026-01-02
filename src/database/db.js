const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { createDbHelpers } = require('./helpers');

let app;
try {
    app = require('electron').app;
} catch (e) {
    app = null;
}

const isDev = process.env.NODE_ENV === 'development' || !app;
const dbPath = (app && !isDev)
    ? path.join(app.getPath('userData'), 'finance.db')
    : path.join(__dirname, '../../finance.db');

const db = new sqlite3.Database(dbPath, async (err) => {
    if (err) {
        console.error('FAILED to open database:', err);
    } else {
        console.log('Database connected successfully at', dbPath);
        await bootstrapDb();
    }
});

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

        console.log('Database bootstrapping complete.');
    } catch (error) {
        console.error('Database bootstrap failed:', error);
    }
}

async function processMigrations() {
    const applied = await all("SELECT id FROM migrations");
    const appliedIds = new Set(applied.map(m => m.id));

    for (const migration of MIGRATIONS) {
        if (!appliedIds.has(migration.id)) {
            console.log(`Running Migration ${migration.id}: ${migration.name}`);
            try {
                await run('BEGIN TRANSACTION');
                await migration.up();
                await run('INSERT INTO migrations (id, name) VALUES (?, ?)', [migration.id, migration.name]);
                await run('COMMIT');
                console.log(`Migration ${migration.id} complete.`);
            } catch (err) {
                await run('ROLLBACK');
                console.error(`Migration ${migration.id} failed:`, err);
                throw err;
            }
        }
    }
}

module.exports = db;
