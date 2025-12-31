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

    getAISettings: async () => {
        const settings = await FinanceModel.getAllSettings();
        return {
            enabled: settings['ai_enabled'] === 'true',
            url: settings['ai_url'] || 'http://127.0.0.1:11434',
            model: settings['ai_model'] || 'gemma3:4b',
            promptTx: settings['ai_prompt_tx'],
            promptInsight: settings['ai_prompt_insight'],
            promptChat: settings['ai_prompt_chat']
        };
    },

    updateSetting: async (key, value) => {
        return await run(
            `INSERT INTO settings (key, value, category) VALUES (?, ?, 'general') 
             ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
            [key, value, value]
        );
    },

    saveSettings: async (settings) => {
        const results = [];
        for (const [key, value] of Object.entries(settings)) {
            results.push(await FinanceModel.updateSetting(key, String(value)));
        }
        return results;
    },

    saveAISettings: async (settings) => {
        const dbSettings = {};
        if (settings.url) dbSettings.ai_url = settings.url;
        if (settings.model) dbSettings.ai_model = settings.model;
        if (settings.enabled !== undefined) dbSettings.ai_enabled = String(settings.enabled);
        if (settings.promptTx) dbSettings.ai_prompt_tx = settings.promptTx;
        if (settings.promptInsight) dbSettings.ai_prompt_insight = settings.promptInsight;
        if (settings.promptChat) dbSettings.ai_prompt_chat = settings.promptChat;

        return await FinanceModel.saveSettings(dbSettings);
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

    archiveAccount: async (id) => {
        return await run(`UPDATE accounts SET status = 'archived' WHERE id = ?`, [id]);
    },

    unarchiveAccount: async (id) => {
        return await run(`UPDATE accounts SET status = 'active' WHERE id = ?`, [id]);
    },

    isAccountInUse: async (id) => {
        const row = await get(`SELECT COUNT(*) as count FROM transactions WHERE account_id = ? OR to_account_id = ?`, [id, id]);
        return row.count > 0;
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

    updateBudget: async (id, category, amount, period, startDate, endDate) => {
        return await run(
            `UPDATE budgets SET category = ?, amount = ?, period = ?, start_date = ?, end_date = ? WHERE id = ?`,
            [category, amount, period, startDate, endDate, id]
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
    },

    // ==================== GOALS ====================

    getAllGoals: async () => {
        return await all(`SELECT * FROM goals ORDER BY priority ASC, created_at DESC`);
    },

    getActiveGoals: async () => {
        return await all(`SELECT * FROM goals WHERE status = 'active' ORDER BY priority ASC`);
    },

    getGoalById: async (id) => {
        return await get(`SELECT * FROM goals WHERE id = ?`, [id]);
    },

    createGoal: async (data) => {
        const sql = `INSERT INTO goals (name, description, target_amount, current_amount, monthly_contribution, icon, color, priority, target_date, auto_contribute)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        return await run(sql, [
            data.name,
            data.description || null,
            data.target_amount,
            data.current_amount || 0,
            data.monthly_contribution || 0,
            data.icon || 'target',
            data.color || '#a29bfe',
            data.priority || 1,
            data.target_date || null,
            data.auto_contribute ? 1 : 0
        ]);
    },

    updateGoal: async (id, data) => {
        const fields = [];
        const params = [];
        const allowedFields = ['name', 'description', 'target_amount', 'current_amount', 'monthly_contribution', 'icon', 'color', 'priority', 'target_date', 'status', 'auto_contribute'];

        for (let key in data) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                params.push(key === 'auto_contribute' ? (data[key] ? 1 : 0) : data[key]);
            }
        }

        // Auto-complete if target reached
        if (data.current_amount >= data.target_amount && data.status !== 'completed') {
            fields.push('status = ?', 'completed_at = ?');
            params.push('completed', new Date().toISOString());
        }

        params.push(id);
        const sql = `UPDATE goals SET ${fields.join(', ')} WHERE id = ?`;
        return await run(sql, params);
    },

    deleteGoal: async (id) => {
        await run(`DELETE FROM goal_contributions WHERE goal_id = ?`, [id]);
        return await run(`DELETE FROM goals WHERE id = ?`, [id]);
    },

    contributeToGoal: async (goalId, amount, source = null, notes = null) => {
        // Add contribution record
        await run(`INSERT INTO goal_contributions (goal_id, amount, source, notes) VALUES (?, ?, ?, ?)`,
            [goalId, amount, source, notes]);

        // Update goal current amount
        const goal = await get(`SELECT current_amount, target_amount FROM goals WHERE id = ?`, [goalId]);
        const newAmount = (goal.current_amount || 0) + amount;

        const updates = { current_amount: newAmount };
        if (newAmount >= goal.target_amount) {
            updates.status = 'completed';
        }

        return await FinanceModel.updateGoal(goalId, updates);
    },

    getGoalContributions: async (goalId) => {
        return await all(`SELECT * FROM goal_contributions WHERE goal_id = ? ORDER BY contributed_at DESC`, [goalId]);
    },

    // ==================== RECURRING CHARGES ====================

    getAllRecurringCharges: async () => {
        return await all(`SELECT * FROM recurring_charges ORDER BY category, name`);
    },

    getActiveRecurringCharges: async () => {
        return await all(`SELECT * FROM recurring_charges WHERE is_active = 1 ORDER BY category, name`);
    },

    createRecurringCharge: async (data) => {
        const sql = `INSERT INTO recurring_charges (category, name, amount, frequency, due_day, next_due_date, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
        return await run(sql, [
            data.category,
            data.name,
            data.amount,
            data.frequency || 'monthly',
            data.due_day || 1,
            data.next_due_date || null,
            data.notes || null
        ]);
    },

    updateRecurringCharge: async (id, data) => {
        const fields = [];
        const params = [];
        const allowedFields = ['category', 'name', 'amount', 'frequency', 'due_day', 'next_due_date', 'is_active', 'notes'];

        for (let key in data) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                params.push(data[key]);
            }
        }
        params.push(id);
        const sql = `UPDATE recurring_charges SET ${fields.join(', ')} WHERE id = ?`;
        return await run(sql, params);
    },

    deleteRecurringCharge: async (id) => {
        return await run(`DELETE FROM recurring_charges WHERE id = ?`, [id]);
    },

    // ==================== FINANCIAL SUMMARY ====================

    getMonthlyRecurringTotal: async () => {
        const charges = await all(`SELECT amount, frequency FROM recurring_charges WHERE is_active = 1`);
        let monthlyTotal = 0;

        charges.forEach(c => {
            if (c.frequency === 'weekly') monthlyTotal += c.amount * 4.33;
            else if (c.frequency === 'monthly') monthlyTotal += c.amount;
            else if (c.frequency === 'yearly') monthlyTotal += c.amount / 12;
        });

        return monthlyTotal;
    },

    getGoalsSummary: async () => {
        const goals = await all(`SELECT * FROM goals WHERE status = 'active'`);
        const totalTarget = goals.reduce((sum, g) => sum + g.target_amount, 0);
        const totalSaved = goals.reduce((sum, g) => sum + g.current_amount, 0);
        const totalMonthlyContribution = goals.reduce((sum, g) => sum + (g.monthly_contribution || 0), 0);

        return {
            activeGoals: goals.length,
            totalTarget,
            totalSaved,
            totalProgress: totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0,
            totalMonthlyContribution
        };
    },

    getAvailableForGoals: async () => {
        // Calculate: Average Monthly Income - Recurring Charges - Existing Goal Contributions
        const settings = await FinanceModel.getAllSettings();

        // Get average monthly income from last 3 months
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const incomeData = await get(`
            SELECT SUM(amount) as total FROM transactions 
            WHERE type = 'income' AND start_date >= ? AND is_active = 1
        `, [threeMonthsAgo.toISOString().split('T')[0]]);

        const avgMonthlyIncome = (incomeData.total || 0) / 3;
        const recurringTotal = await FinanceModel.getMonthlyRecurringTotal();
        const goalsSummary = await FinanceModel.getGoalsSummary();

        return {
            avgMonthlyIncome,
            recurringCharges: recurringTotal,
            goalContributions: goalsSummary.totalMonthlyContribution,
            available: avgMonthlyIncome - recurringTotal - goalsSummary.totalMonthlyContribution
        };
    }
};

module.exports = FinanceModel;

