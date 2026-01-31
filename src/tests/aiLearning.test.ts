import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Force Dev Mode BEFORE looking at any DB logic
process.env.NODE_ENV = 'development';
const dbPath = path.resolve(__dirname, 'test_ai_learning.db');
process.env.DATABASE_PATH = dbPath;

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
    let all: any;

    beforeAll(async () => {
        // Cleanup
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

        // Load modules dynamically
        const dbModule = await import('../main/database/db');
        db = dbModule.db;
        run = dbModule.run;
        all = dbModule.all;
        await dbModule.dbInitialized;

        // Load FinanceModel
        const financeModule = await import('../main/models/finance');
        FinanceModel = financeModule.FinanceModel;

        // Mock Side Effects
        FinanceModel.syncAccountBalance = vi.fn().mockResolvedValue(true);
        // Tables are initialized by db.ts bootstrap
    });

    afterAll(async () => {
        if (db) {
            await new Promise<void>((resolve) => db.close(() => resolve()));
        }
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

            expect(corrections.length).toBe(2);
        });
    });
});
