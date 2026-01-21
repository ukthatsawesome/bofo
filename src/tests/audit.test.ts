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
  ipcMain: { handle: () => {} }
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
        run = dbModule.run; // Exported from db.ts
        
        // Load FinanceModel
        const financeModule = await import('../main/models/finance');
        FinanceModel = financeModule.FinanceModel;
        
        // Mock Side Effects
        FinanceModel.syncAccountBalance = vi.fn().mockResolvedValue(true);

        // Init DB tables manually for test (since we bypass full bootstrap)
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
        
        await run(`CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL,
            entity_id INTEGER NOT NULL,
            action TEXT CHECK(action IN ('CREATE', 'UPDATE', 'DELETE')) NOT NULL,
            source TEXT DEFAULT 'USER',
            changes JSON,
            metadata JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        await run(`CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            name TEXT, 
            type TEXT, 
            balance INTEGER,
            currency TEXT DEFAULT 'USD',
            is_archived INTEGER DEFAULT 0
        )`);
        
        // Verify tables exist
        // await run("INSERT INTO transactions (amount) VALUES (1)");
    });

    afterAll(() => {
        if (db) db.close();
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    });

    it('should log Transaction creation with default USER source', async () => {
        const tx = await FinanceModel.create('transaction', {
            amount: 100,
            category: 'Food',
            description: 'Lunch'
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
        const tx = await FinanceModel.create('transaction', {
            amount: 50,
            category: 'Misc'
        });

        await FinanceModel.update('transaction', tx.id, { category: 'Coffee' }, { source: 'AI', metadata: { confidence: 0.99 } });

        const logs = await new Promise<any[]>((resolve, reject) => {
            db.all("SELECT * FROM transaction_history WHERE transaction_id = ? ORDER BY changed_at DESC", [tx.id], (err: any, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        expect(logs[0].action).toBe('UPDATE');
        expect(logs[0].source).toBe('AI');
        
        const meta = JSON.parse(logs[0].metadata);
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
