const db = require('../database/db');

// Helper to run SQL
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// CRUD Operations
const FinanceModel = {
    createTransaction: async (data) => {
        const sql = `
            INSERT INTO transactions (account_id, to_account_id, type, category, amount, description, attachment, frequency, start_date, end_date, currency, tags, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            data.account_id || null,
            data.to_account_id || null,
            data.type,
            data.category,
            data.amount,
            data.description || null,
            data.attachment || data.attachment_path || null,
            data.frequency,
            data.start_date,
            data.end_date || null,
            data.currency || 'USD',
            data.tags || '',
            data.is_active !== undefined ? data.is_active : 1
        ];
        const result = await run(sql, params);

        // Auto-sync account balances after transaction
        if (data.account_id) await FinanceModel.syncAccountBalance(data.account_id);
        if (data.to_account_id) await FinanceModel.syncAccountBalance(data.to_account_id);

        return result;
    },

    syncAccountBalance: async (accountId) => {
        const acc = await get(`SELECT initial_balance FROM accounts WHERE id = ?`, [accountId]);
        if (!acc) return;

        // Optimized: Perform aggregation in SQL database
        // This avoids fetching thousands of rows into Node.js memory
        const agg = await get(`
            SELECT 
                SUM(CASE 
                    WHEN type = 'income' AND account_id = ? THEN amount 
                    WHEN type = 'transfer' AND to_account_id = ? THEN amount 
                    ELSE 0 
                END) as total_in,
                SUM(CASE 
                    WHEN type = 'expense' AND account_id = ? THEN amount 
                    WHEN type = 'transfer' AND account_id = ? THEN amount 
                    ELSE 0 
                END) as total_out
            FROM transactions 
            WHERE (account_id = ? OR to_account_id = ?) AND is_active = 1
        `, [accountId, accountId, accountId, accountId, accountId, accountId]);

        const totalIn = agg.total_in || 0;
        const totalOut = agg.total_out || 0;
        const balance = (acc.initial_balance || 0) + totalIn - totalOut;

        return await run(`UPDATE accounts SET balance = ? WHERE id = ?`, [balance, accountId]);
    },

    getAllTransactions: async () => {
        return await all(`SELECT * FROM transactions ORDER BY start_date DESC`);
    },

    getActiveTransactions: async () => {
        return await all(`SELECT * FROM transactions WHERE is_active = 1`);
    },

    updateTransaction: async (id, data) => {
        // 1. Get original accounts to sync them later
        const originalTx = await get('SELECT account_id, to_account_id FROM transactions WHERE id = ?', [id]);

        // 2. Dynamic update with safe mapping
        const fields = [];
        const params = [];
        const allowedFields = ['account_id', 'to_account_id', 'type', 'category', 'amount', 'description', 'attachment', 'frequency', 'start_date', 'end_date', 'currency', 'tags', 'is_active'];

        for (let key in data) {
            let dbKey = key;
            if (key === 'attachment_path') dbKey = 'attachment';

            if (allowedFields.includes(dbKey)) {
                fields.push(`${dbKey} = ?`);
                params.push(data[key]);
            }
        }
        params.push(id);
        const sql = `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`;
        const result = await run(sql, params);

        // 3. Sync balances for all affected accounts (old and new)
        const accountsToSync = new Set();
        if (originalTx) {
            if (originalTx.account_id) accountsToSync.add(originalTx.account_id);
            if (originalTx.to_account_id) accountsToSync.add(originalTx.to_account_id);
        }
        if (data.account_id) accountsToSync.add(data.account_id);
        if (data.to_account_id) accountsToSync.add(data.to_account_id);

        for (const accId of accountsToSync) {
            await FinanceModel.syncAccountBalance(accId);
        }

        return result;
    },

    deleteTransaction: async (id) => {
        // 1. Get accounts before deleting
        const tx = await get('SELECT account_id, to_account_id FROM transactions WHERE id = ?', [id]);

        // 2. Delete
        const result = await run(`DELETE FROM transactions WHERE id = ?`, [id]);

        // 3. Sync balances
        if (tx) {
            if (tx.account_id) await FinanceModel.syncAccountBalance(tx.account_id);
            if (tx.to_account_id) await FinanceModel.syncAccountBalance(tx.to_account_id);
        }

        return result;
    },

    // Settings Operations
    getAllSettings: async () => {
        const rows = await all(`SELECT * FROM settings`);
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        return settings;
    },

    updateSetting: async (key, value) => {
        return await run(
            `INSERT INTO settings (key, value, category) VALUES (?, ?, 'general') 
             ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
            [key, value, value]
        );
    },

    // Category Operations
    getAllCategories: async () => {
        return await all(`SELECT * FROM categories ORDER BY type, name`);
    },

    getCategoriesByType: async (type) => {
        return await all(`SELECT * FROM categories WHERE type = ? ORDER BY name`, [type]);
    },

    addCategory: async (type, name) => {
        return await run(`INSERT INTO categories (type, name) VALUES (?, ?)`, [type, name]);
    },

    deleteCategory: async (id) => {
        return await run(`DELETE FROM categories WHERE id = ?`, [id]);
    },

    // Account Operations
    getAllAccounts: async () => {
        return await all(`SELECT * FROM accounts ORDER BY type, name`);
    },

    getAccountById: async (id) => {
        return await get(`SELECT * FROM accounts WHERE id = ?`, [id]);
    },

    addAccount: async (data) => {
        const sql = `INSERT INTO accounts (name, type, balance, initial_balance, currency) VALUES (?, ?, ?, ?, ?)`;
        const bal = data.balance || 0;
        return await run(sql, [data.name, data.type, bal, bal, data.currency || 'USD']);
    },

    updateAccount: async (id, data) => {
        const fields = [];
        const params = [];
        for (const key in data) {
            fields.push(`${key} = ?`);
            params.push(data[key]);
        }
        params.push(id);
        const sql = `UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`;
        return await run(sql, params);
    },

    deleteAccount: async (id) => {
        return await run(`DELETE FROM accounts WHERE id = ?`, [id]);
    },

    archiveCategory: async (id) => {
        return await run(`UPDATE categories SET status = 'archived' WHERE id = ?`, [id]);
    },

    unarchiveCategory: async (id) => {
        return await run(`UPDATE categories SET status = 'active' WHERE id = ?`, [id]);
    },

    // Enhanced Category Operations
    updateCategory: async (id, data) => {
        const fields = [];
        const params = [];
        for (const key in data) {
            fields.push(`${key} = ?`);
            params.push(data[key]);
        }
        params.push(id);
        const sql = `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`;
        return await run(sql, params);
    },

    isCategoryInUse: async (categoryName) => {
        const row = await get(`SELECT COUNT(*) as count FROM transactions WHERE category = ?`, [categoryName]);
        return row.count > 0;
    },

    mergeCategories: async (oldName, newName) => {
        await run(`UPDATE transactions SET category = ? WHERE category = ?`, [newName, oldName]);
        return await run(`DELETE FROM categories WHERE name = ?`, [oldName]);
    },

    // Budget Operations
    getAllBudgets: async () => {
        return await all(`SELECT * FROM budgets`);
    },

    setBudget: async (category, amount, period, startDate, endDate) => {
        return await run(
            `INSERT INTO budgets (category, amount, period, start_date, end_date) VALUES (?, ?, ?, ?, ?)`,
            [category, amount, period, startDate, endDate]
        );
    },

    deleteBudget: async (id) => {
        return await run(`DELETE FROM budgets WHERE id = ?`, [id]);
    },
    // Data Transfer Operations
    exportData: async () => {
        return {
            transactions: await FinanceModel.getAllTransactions(),
            accounts: await FinanceModel.getAllAccounts(),
            categories: await FinanceModel.getAllCategories(),
            settings: await FinanceModel.getAllSettings(),
            budgets: await FinanceModel.getAllBudgets()
        };
    },

    importData: async (data) => {
        try {
            await run('BEGIN TRANSACTION');

            // Clear existing data
            await run('DELETE FROM transactions');
            await run('DELETE FROM accounts');
            await run('DELETE FROM categories');
            await run('DELETE FROM settings');
            await run('DELETE FROM budgets');

            // Restore Accounts
            for (const acc of data.accounts) {
                await run(`INSERT INTO accounts (id, name, type, balance, initial_balance, currency) VALUES (?, ?, ?, ?, ?, ?)`,
                    [acc.id, acc.name, acc.type, acc.balance, acc.initial_balance, acc.currency]);
            }

            // Restore Categories
            for (const cat of data.categories) {
                await run(`INSERT INTO categories (id, type, name, status, is_default) VALUES (?, ?, ?, ?, ?)`,
                    [cat.id, cat.type, cat.name, cat.status, cat.is_default]);
            }

            // Restore Transactions
            for (const t of data.transactions) {
                await run(`INSERT INTO transactions 
                    (id, account_id, to_account_id, type, category, amount, description, attachment, frequency, start_date, end_date, currency, tags, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [t.id, t.account_id, t.to_account_id, t.type, t.category, t.amount, t.description, t.attachment, t.frequency, t.start_date, t.end_date, t.currency, t.tags, t.is_active]);
            }

            // Restore Settings
            for (const key in data.settings) {
                await run(`INSERT INTO settings (key, value) VALUES (?, ?)`, [key, data.settings[key]]);
            }

            // Restore Budgets
            for (const b of data.budgets) {
                await run(`INSERT INTO budgets (id, category, amount, period, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [b.id, b.category, b.amount, b.period, b.start_date, b.end_date, b.created_at]);
            }

            await run('COMMIT');
            return true;
        } catch (err) {
            await run('ROLLBACK');
            throw err;
        }
    },

    exportTransactionsToCSV: async () => {
        const txs = await FinanceModel.getAllTransactions();
        if (txs.length === 0) return '';

        const headers = ['Date', 'Type', 'Category', 'Amount', 'Currency', 'Account', 'Description'];
        const rows = txs.map(t => [
            t.start_date,
            t.type,
            t.category,
            t.amount,
            t.currency,
            t.account_id, // Ideally this would be joined with account name, but ID is safe for raw export
            (t.description || '').replace(/,/g, ' ') // Simple escape for CSV
        ]);

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
};

module.exports = FinanceModel;
