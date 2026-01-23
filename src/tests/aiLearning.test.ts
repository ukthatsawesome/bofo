import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Force Dev Mode BEFORE looking at any DB logic
process.env.NODE_ENV = 'development';
const dbPath = path.join(__dirname, 'test_ai_learning.db');
process.env.TEST_DB_PATH = dbPath;

// Mock Electron
vi.mock('electron', () => ({
    app: {
        getPath: () => __dirname,
        isPackaged: false
    },
    ipcMain: { handle: () => { } }
}));

describe('AI Learning Feedback', () => {
    let FinanceModel: any;
    let db: any;
    let run: any;

    beforeAll(async () => {
        // Cleanup
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

        // Load modules dynamically
        const dbModule = await import('../main/database/db');
        db = dbModule.db;
        run = dbModule.run;

        // Load FinanceModel
        const financeModule = await import('../main/models/finance');
        FinanceModel = financeModule.FinanceModel;

        // Mock Side Effects
        FinanceModel.syncAccountBalance = vi.fn().mockResolvedValue(true);

        // Init DB tables manually for test
        await run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        account_id INTEGER, 
        to_account_id INTEGER,
        amount INTEGER, 
        category TEXT, 
        description TEXT, 
        type TEXT,
        attachment TEXT,
        frequency TEXT,
        start_date TEXT,
        end_date TEXT,
        currency TEXT,
        exchange_rate REAL,
        to_amount INTEGER,
        tags TEXT,
        is_active INTEGER
    )`);

        await run(`CREATE TABLE IF NOT EXISTS transaction_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL,
        action TEXT CHECK(action IN ('CREATE', 'UPDATE', 'DELETE')) NOT NULL,
        old_data TEXT,
        new_data TEXT,
        source TEXT DEFAULT 'USER',
        metadata TEXT,
        changed_by TEXT DEFAULT 'system',
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

        await run(`CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        name TEXT, 
        type TEXT, 
        balance INTEGER,
        currency TEXT DEFAULT 'USD',
        is_archived INTEGER DEFAULT 0
    )`);
    });

    afterAll(() => {
        if (db) db.close();
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    });

    describe('getAICategoryCorrections', () => {
        it('should return empty array when no corrections exist', async () => {
            const corrections = await FinanceModel.getAICategoryCorrections(5);
            expect(Array.isArray(corrections)).toBe(true);
            expect(corrections.length).toBe(0);
        });

        it('should return corrections when AI-created transactions are corrected by user', async () => {
            // Setup: Create transaction via AI
            const tx = await FinanceModel.create('transaction', {
                amount: 50,
                type: 'expense',
                category: 'Food',
                description: 'Coffee at Starbucks',
                start_date: new Date().toISOString().split('T')[0]
            }, { source: 'AI' });

            // Simulate user correction: change category from Food to Coffee
            await FinanceModel.update('transaction', tx.id, {
                category: 'Coffee'
            }, { source: 'USER' });

            // Fetch corrections
            const corrections = await FinanceModel.getAICategoryCorrections(5);

            // Should have at least one correction
            expect(corrections.length).toBeGreaterThanOrEqual(1);

            // Find our correction
            const ourCorrection = corrections.find(
                (c: any) => c.description === 'Coffee at Starbucks'
            );

            expect(ourCorrection).toBeDefined();
            if (ourCorrection) {
                expect(ourCorrection.original).toBe('Food');
                expect(ourCorrection.corrected).toBe('Coffee');
            }
        });

        it('should not return corrections for non-AI transactions', async () => {
            // Create transaction via USER (not AI)
            const tx = await FinanceModel.create('transaction', {
                amount: 100,
                type: 'expense',
                category: 'Shopping',
                description: 'User-created transaction',
                start_date: new Date().toISOString().split('T')[0]
            }, { source: 'USER' });

            // User updates their own transaction
            await FinanceModel.update('transaction', tx.id, {
                category: 'Entertainment'
            }, { source: 'USER' });

            // Fetch corrections - should NOT include user's own corrections
            const corrections = await FinanceModel.getAICategoryCorrections(10);

            const userCorrection = corrections.find(
                (c: any) => c.description === 'User-created transaction'
            );

            // User-created transactions should not appear in AI corrections
            expect(userCorrection).toBeUndefined();
        });

        it('should respect limit parameter', async () => {
            // Create multiple AI transactions and corrections
            for (let i = 0; i < 3; i++) {
                const tx = await FinanceModel.create('transaction', {
                    amount: 10 + i,
                    type: 'expense',
                    category: 'Misc',
                    description: `Limit test ${i}`,
                    start_date: new Date().toISOString().split('T')[0]
                }, { source: 'AI' });

                await FinanceModel.update('transaction', tx.id, {
                    category: `Category${i}`
                }, { source: 'USER' });
            }

            // Request only 2 corrections
            const corrections = await FinanceModel.getAICategoryCorrections(2);

            expect(corrections.length).toBeLessThanOrEqual(2);
        });
    });
});
