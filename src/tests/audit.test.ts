import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Force Dev Mode BEFORE looking at any DB logic
process.env.NODE_ENV = 'development';
const dbPath = path.join(__dirname, 'test_audit.db');
process.env.TEST_DB_PATH = dbPath;

// Mock Electron
vi.mock('electron', () => ({
    app: {
        getPath: () => __dirname,
        isPackaged: false
    },
    ipcMain: { handle: () => { } }
}));

describe('Audit System Integration', () => {
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
        await dbModule.dbInitialized;

        // Load FinanceModel
        const financeModule = await import('../main/models/finance');
        FinanceModel = financeModule.FinanceModel;

        // Mock Side Effects
        FinanceModel.syncAccountBalance = vi.fn().mockResolvedValue(true);

        // Tables are initialized by db.ts bootstrap

        // Verify tables exist
        // await run("INSERT INTO transactions (amount) VALUES (1)");
    });

    afterAll(() => {
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    });

    it('should log Transaction creation with default USER source', async () => {
        // Create a dummy account first
        const account = await FinanceModel.create('account', {
            name: 'Test Account',
            type: 'bank',
            balance: 1000
        });

        const tx = await FinanceModel.create('transaction', {
            amount: 100,
            type: 'expense',
            category: 'Food',
            description: 'Lunch',
            start_date: new Date().toISOString().split('T')[0],
            account_id: account.id
        });

        const logs = await new Promise<any[]>((resolve, reject) => {
            db.all("SELECT * FROM transaction_history WHERE transaction_id = ?", [tx.id], (err: any, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        expect(logs.length).toBeGreaterThan(0);
        expect(logs[0].action).toBe('CREATE');
        expect(logs[0].source).toBe('USER');
    });

    it('should log Transaction update with AI source', async () => {
        // Create a dummy account first
        const account = await FinanceModel.create('account', {
            name: 'Test Account 2',
            type: 'bank',
            balance: 1000
        });

        const tx = await FinanceModel.create('transaction', {
            amount: 50,
            type: 'expense',
            category: 'Misc',
            start_date: new Date().toISOString().split('T')[0],
            account_id: account.id
        });

        await FinanceModel.update('transaction', tx.id, { category: 'Coffee' }, { source: 'AI', metadata: { confidence: 0.99 } });

        const logs = await new Promise<any[]>((resolve, reject) => {
            db.all("SELECT * FROM transaction_history WHERE transaction_id = ? ORDER BY id DESC", [tx.id], (err: any, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Should have at least 2 logs: CREATE and UPDATE
        expect(logs.length).toBeGreaterThanOrEqual(2);

        // The most recent log (first when sorted by id DESC) should be UPDATE
        const updateLog = logs.find(l => l.action === 'UPDATE');
        expect(updateLog).toBeDefined();
        expect(updateLog.source).toBe('AI');

        const meta = JSON.parse(updateLog.metadata);
        expect(meta.confidence).toBe(0.99);
    });

    it('should log Generic Entity (Account) to audit_logs', async () => {
        const acc = await FinanceModel.create('account', {
            name: 'Audit Bank',
            type: 'bank',
            balance: 1000
        }, { source: 'User2' });

        const logs = await new Promise<any[]>((resolve, reject) => {
            db.all("SELECT * FROM audit_logs WHERE entity_type = 'account' AND entity_id = ?", [acc.id], (err: any, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        expect(logs.length).toBeGreaterThan(0);
        expect(logs[0].action).toBe('CREATE');
        expect(logs[0].source).toBe('User2');
    });
});
