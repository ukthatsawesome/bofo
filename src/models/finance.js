const db = require('../database/db');
const { createDbHelpers } = require('../database/helpers');

// Use shared promisified helpers
const { run, get, all } = createDbHelpers(db);

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
            version: 2, // Schema version for backward compatibility
            exportedAt: new Date().toISOString(),
            transactions: await FinanceModel.getAllTransactions(),
            accounts: await FinanceModel.getAllAccounts(),
            categories: await FinanceModel.getAllCategories(),
            settings: await FinanceModel.getAllSettings(),
            budgets: await FinanceModel.getAllBudgets(),
            goals: await FinanceModel.getAllGoals(),
            goalContributions: await all(`SELECT * FROM goal_contributions`),
            recurringCharges: await FinanceModel.getAllRecurringCharges(),
            billTypes: await FinanceModel.getBillTypes(),
            billReadings: await all(`SELECT * FROM bill_readings`)
        };
    },

    importData: async (data) => {
        try {
            await run('BEGIN TRANSACTION');

            // Clear existing data (in proper order for foreign key constraints)
            await run('DELETE FROM goal_contributions');
            await run('DELETE FROM bill_readings');
            await run('DELETE FROM goals');
            await run('DELETE FROM recurring_charges');
            await run('DELETE FROM bill_types');
            await run('DELETE FROM transactions');
            await run('DELETE FROM accounts');
            await run('DELETE FROM categories');
            await run('DELETE FROM settings');
            await run('DELETE FROM budgets');

            // Restore Accounts
            for (const acc of data.accounts || []) {
                await run(`INSERT INTO accounts (id, name, type, balance, initial_balance, currency, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [acc.id, acc.name, acc.type, acc.balance, acc.initial_balance || acc.balance, acc.currency || 'USD', acc.status || 'active']);
            }

            // Restore Categories
            for (const cat of data.categories || []) {
                await run(`INSERT INTO categories (id, type, name, status, is_default, color, icon) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [cat.id, cat.type, cat.name, cat.status || 'active', cat.is_default || 0, cat.color || '#7b68ee', cat.icon || '📂']);
            }

            // Restore Transactions
            for (const t of data.transactions || []) {
                await run(`INSERT INTO transactions 
                    (id, account_id, to_account_id, type, category, amount, description, attachment, frequency, start_date, end_date, currency, tags, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [t.id, t.account_id, t.to_account_id, t.type, t.category, t.amount, t.description, t.attachment, t.frequency, t.start_date, t.end_date, t.currency, t.tags, t.is_active ?? 1]);
            }

            // Restore Settings
            for (const key in (data.settings || {})) {
                await run(`INSERT INTO settings (key, value, category) VALUES (?, ?, 'general')`, [key, data.settings[key]]);
            }

            // Restore Budgets
            for (const b of data.budgets || []) {
                await run(`INSERT INTO budgets (id, category, amount, period, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [b.id, b.category, b.amount, b.period, b.start_date, b.end_date, b.created_at]);
            }

            // Restore Goals (v2+)
            for (const g of data.goals || []) {
                await run(`INSERT INTO goals (id, name, description, target_amount, current_amount, monthly_contribution, icon, color, priority, target_date, status, auto_contribute, created_at, completed_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [g.id, g.name, g.description, g.target_amount, g.current_amount, g.monthly_contribution, g.icon, g.color, g.priority, g.target_date, g.status, g.auto_contribute, g.created_at, g.completed_at]);
            }

            // Restore Goal Contributions (v2+)
            for (const gc of data.goalContributions || []) {
                await run(`INSERT INTO goal_contributions (id, goal_id, amount, source, notes, contributed_at) VALUES (?, ?, ?, ?, ?, ?)`,
                    [gc.id, gc.goal_id, gc.amount, gc.source, gc.notes, gc.contributed_at]);
            }

            // Restore Recurring Charges (v2+)
            for (const rc of data.recurringCharges || []) {
                await run(`INSERT INTO recurring_charges (id, category, name, amount, frequency, due_day, next_due_date, is_active, notes, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [rc.id, rc.category, rc.name, rc.amount, rc.frequency, rc.due_day, rc.next_due_date, rc.is_active ?? 1, rc.notes, rc.created_at]);
            }

            // Restore Bill Types (v2+)
            for (const bt of data.billTypes || []) {
                await run(`INSERT INTO bill_types (id, name, unit_name, cost_per_unit, category_name, account_id, auto_transaction, icon, color, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [bt.id, bt.name, bt.unit_name, bt.cost_per_unit, bt.category_name, bt.account_id, bt.auto_transaction, bt.icon, bt.color, bt.created_at]);
            }

            // Restore Bill Readings (v2+)
            for (const br of data.billReadings || []) {
                await run(`INSERT INTO bill_readings (id, bill_type_id, date, units_used, total_cost, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [br.id, br.bill_type_id, br.date, br.units_used, br.total_cost, br.notes, br.created_at]);
            }

            await run('COMMIT');
            return true;
        } catch (err) {
            await run('ROLLBACK');
            throw err;
        }
    },

    exportAllToCSV: async () => {
        const escapeCSV = (val) => {
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const tableToCSV = (data, headers) => {
            if (!data || data.length === 0) return '';
            const headerRow = headers.join(',');
            const dataRows = data.map(row => headers.map(h => escapeCSV(row[h])).join(','));
            return [headerRow, ...dataRows].join('\n');
        };

        const sections = [];

        // Accounts
        const accounts = await FinanceModel.getAllAccounts();
        sections.push('## ACCOUNTS');
        sections.push(tableToCSV(accounts, ['id', 'name', 'type', 'balance', 'initial_balance', 'currency', 'status']));

        // Transactions
        const transactions = await FinanceModel.getAllTransactions();
        sections.push('\n## TRANSACTIONS');
        sections.push(tableToCSV(transactions, ['id', 'start_date', 'type', 'category', 'amount', 'currency', 'account_id', 'to_account_id', 'description', 'frequency', 'is_active']));

        // Categories
        const categories = await FinanceModel.getAllCategories();
        sections.push('\n## CATEGORIES');
        sections.push(tableToCSV(categories, ['id', 'type', 'name', 'status', 'is_default', 'color', 'icon']));

        // Budgets
        const budgets = await FinanceModel.getAllBudgets();
        sections.push('\n## BUDGETS');
        sections.push(tableToCSV(budgets, ['id', 'category', 'amount', 'period', 'start_date', 'end_date', 'created_at']));

        // Goals
        const goals = await FinanceModel.getAllGoals();
        sections.push('\n## GOALS');
        sections.push(tableToCSV(goals, ['id', 'name', 'description', 'target_amount', 'current_amount', 'monthly_contribution', 'target_date', 'status', 'priority']));

        // Goal Contributions
        const contributions = await all(`SELECT * FROM goal_contributions ORDER BY contributed_at DESC`);
        sections.push('\n## GOAL_CONTRIBUTIONS');
        sections.push(tableToCSV(contributions, ['id', 'goal_id', 'amount', 'source', 'notes', 'contributed_at']));

        // Recurring Charges
        const recurring = await FinanceModel.getAllRecurringCharges();
        sections.push('\n## RECURRING_CHARGES');
        sections.push(tableToCSV(recurring, ['id', 'category', 'name', 'amount', 'frequency', 'due_day', 'next_due_date', 'is_active', 'notes']));

        // Bill Types
        const billTypes = await FinanceModel.getBillTypes();
        sections.push('\n## BILL_TYPES');
        sections.push(tableToCSV(billTypes, ['id', 'name', 'unit_name', 'cost_per_unit', 'category_name', 'account_id', 'auto_transaction']));

        // Bill Readings
        const billReadings = await all(`SELECT * FROM bill_readings ORDER BY date DESC`);
        sections.push('\n## BILL_READINGS');
        sections.push(tableToCSV(billReadings, ['id', 'bill_type_id', 'date', 'units_used', 'total_cost', 'notes']));

        return sections.join('\n');
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
    },

    // ==================== BILLS ====================

    getBillTypes: async () => {
        return await all(`
            SELECT b.*, a.name as account_name 
            FROM bill_types b
            LEFT JOIN accounts a ON b.account_id = a.id
            ORDER BY b.name ASC
        `);
    },

    addBillType: async (data) => {
        const sql = `INSERT INTO bill_types (name, unit_name, cost_per_unit, category_name, account_id, auto_transaction, icon, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        return await run(sql, [
            data.name,
            data.unit_name || 'Units',
            data.cost_per_unit || 0,
            data.category_name || null,
            data.account_id || null,
            data.auto_transaction || 0,
            data.icon || 'file-text',
            data.color || '#7c3aed'
        ]);
    },

    updateBillType: async (id, data) => {
        const fields = [];
        const params = [];
        const allowed = ['name', 'unit_name', 'cost_per_unit', 'category_name', 'account_id', 'auto_transaction', 'icon', 'color'];
        for (let key in data) {
            if (allowed.includes(key)) {
                fields.push(`${key} = ?`);
                params.push(data[key]);
            }
        }
        params.push(id);
        const sql = `UPDATE bill_types SET ${fields.join(', ')} WHERE id = ?`;
        return await run(sql, params);
    },

    deleteBillType: async (id) => {
        return await run(`DELETE FROM bill_types WHERE id = ?`, [id]);
    },

    getBillReadings: async (filters = {}) => {
        let sql = `
            SELECT r.*, t.name as bill_name, t.unit_name, t.cost_per_unit as current_cost_per_unit, t.color, t.icon, t.category_name
            FROM bill_readings r
            JOIN bill_types t ON r.bill_type_id = t.id
        `;
        const params = [];
        const where = [];

        if (filters.bill_type_id) {
            where.push(`r.bill_type_id = ?`);
            params.push(filters.bill_type_id);
        }
        if (filters.year && filters.year != 0) {
            where.push(`strftime('%Y', r.date) = ?`);
            params.push(String(filters.year));
        }
        if (filters.month && filters.month != 0) {
            where.push(`strftime('%m', r.date) = ?`);
            params.push(String(filters.month).padStart(2, '0'));
        }

        if (where.length > 0) {
            sql += ` WHERE ` + where.join(' AND ');
        }

        sql += ` ORDER BY r.date DESC`;
        return await all(sql, params);
    },

    addBillReading: async (data) => {
        const sql = `INSERT INTO bill_readings (bill_type_id, date, units_used, total_cost, notes) VALUES (?, ?, ?, ?, ?)`;
        const result = await run(sql, [data.bill_type_id, data.date, data.units_used, data.total_cost, data.notes || null]);

        // AUTO-TRANSACTION FEATURE
        const billType = await get(`SELECT name, category_name, account_id, auto_transaction FROM bill_types WHERE id = ?`, [data.bill_type_id]);

        // Only register if auto_transaction is ON and a category is linked
        if (billType && billType.auto_transaction && billType.category_name) {
            let targetAccountId = billType.account_id;

            // If no specific account linked, find a default bank/wallet
            if (!targetAccountId) {
                const defaultAccount = await get(`SELECT id FROM accounts WHERE type IN ('bank', 'wallet') AND status = 'active' LIMIT 1`);
                if (defaultAccount) targetAccountId = defaultAccount.id;
            }

            if (targetAccountId) {
                await FinanceModel.createTransaction({
                    account_id: targetAccountId,
                    type: 'expense',
                    category: billType.category_name,
                    amount: data.total_cost,
                    description: `Bill: ${billType.name} reading (${data.units_used} units)`,
                    frequency: 'once',
                    start_date: data.date,
                    tags: 'bill-sync'
                });
            }
        }

        return result;
    },

    updateBillReading: async (id, data) => {
        const allowed = ['date', 'units_used', 'total_cost', 'notes'];
        const fields = [];
        const params = [];
        for (let key in data) {
            if (allowed.includes(key)) {
                fields.push(`${key} = ?`);
                params.push(data[key]);
            }
        }
        params.push(id);
        return await run(`UPDATE bill_readings SET ${fields.join(', ')} WHERE id = ?`, params);
    },

    deleteBillReading: async (id) => {
        return await run(`DELETE FROM bill_readings WHERE id = ?`, [id]);
    },

    getBillProjections: async () => {
        const billTypes = await FinanceModel.getBillTypes();
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth() + 1;

        const lastMonthDate = new Date();
        lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
        const lastYear = lastMonthDate.getFullYear();
        const lastMonth = lastMonthDate.getMonth() + 1;

        const projections = [];

        for (const type of billTypes) {
            // 1. Overall Average
            const stats = await get(`
                SELECT AVG(units_used) as avg_units, AVG(total_cost) as avg_cost
                FROM bill_readings
                WHERE bill_type_id = ?
            `, [type.id]);

            // 2. Last Month Actual
            const lastActual = await get(`
                SELECT SUM(total_cost) as total
                FROM bill_readings
                WHERE bill_type_id = ? 
                AND strftime('%Y', date) = ? 
                AND strftime('%m', date) = ?
            `, [type.id, String(lastYear), String(lastMonth).padStart(2, '0')]);

            // 3. This Month Actual
            const currentActual = await get(`
                SELECT SUM(total_cost) as total
                FROM bill_readings
                WHERE bill_type_id = ? 
                AND strftime('%Y', date) = ? 
                AND strftime('%m', date) = ?
            `, [type.id, String(curYear), String(curMonth).padStart(2, '0')]);

            const avgUnits = stats.avg_units || 0;
            const projectedCost = avgUnits * type.cost_per_unit;

            projections.push({
                ...type,
                avg_units: avgUnits,
                projected_cost: projectedCost || stats.avg_cost || 0,
                last_month_actual: lastActual.total || 0,
                this_month_actual: currentActual.total || 0
            });
        }

        return projections;
    },

    // ==================== EXCHANGE RATES ====================

    getExchangeRates: async () => {
        return await all(`SELECT * FROM exchange_rates ORDER BY from_currency, to_currency`);
    },

    getExchangeRate: async (fromCurrency, toCurrency) => {
        if (fromCurrency === toCurrency) return 1;

        // Try direct rate
        const direct = await get(
            `SELECT rate FROM exchange_rates WHERE from_currency = ? AND to_currency = ?`,
            [fromCurrency, toCurrency]
        );
        if (direct) return direct.rate;

        // Try inverse rate
        const inverse = await get(
            `SELECT rate FROM exchange_rates WHERE from_currency = ? AND to_currency = ?`,
            [toCurrency, fromCurrency]
        );
        if (inverse) return 1 / inverse.rate;

        return null; // No rate found
    },

    setExchangeRate: async (fromCurrency, toCurrency, rate, source = 'manual') => {
        return await run(`
            INSERT INTO exchange_rates (from_currency, to_currency, rate, source, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(from_currency, to_currency) DO UPDATE SET 
                rate = ?, source = ?, updated_at = CURRENT_TIMESTAMP
        `, [fromCurrency, toCurrency, rate, source, rate, source]);
    },

    setExchangeRatesBulk: async (rates, source = 'api') => {
        await run('BEGIN TRANSACTION');
        try {
            for (const { from, to, rate } of rates) {
                await run(`
                    INSERT INTO exchange_rates (from_currency, to_currency, rate, source, updated_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(from_currency, to_currency) DO UPDATE SET 
                        rate = ?, source = ?, updated_at = CURRENT_TIMESTAMP
                `, [from, to, rate, source, rate, source]);
            }
            await run('COMMIT');
            return true;
        } catch (err) {
            await run('ROLLBACK');
            throw err;
        }
    },

    deleteExchangeRate: async (id) => {
        return await run(`DELETE FROM exchange_rates WHERE id = ?`, [id]);
    },

    convertCurrency: async (amount, fromCurrency, toCurrency) => {
        if (fromCurrency === toCurrency) return amount;
        const rate = await FinanceModel.getExchangeRate(fromCurrency, toCurrency);
        if (rate === null) return null; // No conversion available
        return amount * rate;
    },

    // Get all currencies currently in use by accounts
    getUsedCurrencies: async () => {
        const rows = await all(`SELECT DISTINCT currency FROM accounts WHERE status = 'active'`);
        return rows.map(r => r.currency);
    },

    // Get accounts with converted balances to base currency
    getAccountsWithConvertedBalances: async (baseCurrency) => {
        const accounts = await FinanceModel.getAllAccounts();
        const result = [];

        for (const acc of accounts) {
            const convertedBalance = await FinanceModel.convertCurrency(acc.balance, acc.currency, baseCurrency);
            result.push({
                ...acc,
                converted_balance: convertedBalance,
                base_currency: baseCurrency,
                conversion_available: convertedBalance !== null
            });
        }

        return result;
    }
};

module.exports = FinanceModel;

