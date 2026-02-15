
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SETTING_KEYS } from '../shared/settings/keys';

// Force Dev Mode
process.env.NODE_ENV = 'development';
const dbPath = path.join(__dirname, 'test_transfer_exchange.db');
process.env.DATABASE_PATH = dbPath;

// Mock Electron
vi.mock('electron', () => ({
    app: {
        getPath: () => __dirname,
        isPackaged: false
    },
    ipcMain: { handle: () => { } }
}));

describe('Transfer with Exchange Rate (Cross-Currency)', () => {
    let FinanceModel: any;
    let db: any;
    let run: any;
    let get: any;
    let all: any;
    let closeDatabase: any;

    let sgdAccountId: number;
    let usdAccountId: number;

    beforeAll(async () => {
        // Cleanup
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

        // Load DB
        const dbModule = await import('../main/database/db');
        db = dbModule.db;
        run = dbModule.run;
        get = dbModule.get;
        all = dbModule.all;
        closeDatabase = dbModule.closeDatabase;
        await dbModule.dbInitialized;

        // Load FinanceModel
        const financeModule = await import('../main/models/finance');
        FinanceModel = financeModule.FinanceModel;

        // Set base currency to NPR
        await run(`INSERT OR REPLACE INTO settings (key, value, category) VALUES (?, 'NPR', 'currency')`, [SETTING_KEYS.CURRENCY.BASE]);

        // Verify setting was stored
        const setting = await get('SELECT value FROM settings WHERE key = ?', [SETTING_KEYS.CURRENCY.BASE]);
        console.log('[SETUP] currency_base setting:', setting);

        // Create SGD account with explicit currency
        const acc1 = await FinanceModel.create('account', {
            name: 'SGD Account',
            type: 'bank',
            balance: 1000,
            initial_balance: 1000,
            currency: 'SGD',
            is_active: 1
        });
        sgdAccountId = acc1.id;
        console.log('[SETUP] SGD account created, id:', sgdAccountId);

        // Create USD account with explicit currency
        const acc2 = await FinanceModel.create('account', {
            name: 'USD Account',
            type: 'bank',
            balance: 1000,
            initial_balance: 1000,
            currency: 'USD',
            is_active: 1
        });
        usdAccountId = acc2.id;
        console.log('[SETUP] USD account created, id:', usdAccountId);

        // Clear any auto-seeded rates and insert test rates
        await run(`DELETE FROM exchange_rates`);
        // Seed exchange rates as they would come from API (base: NPR)
        // NPR → SGD (e.g., 1 NPR = 0.0074 SGD)
        await run(`INSERT INTO exchange_rates (from_currency, to_currency, rate, source) VALUES (?, ?, ?, ?)`,
            ['NPR', 'SGD', 0.0074, 'api']);
        // NPR → USD (e.g., 1 NPR = 0.0075 USD)
        await run(`INSERT INTO exchange_rates (from_currency, to_currency, rate, source) VALUES (?, ?, ?, ?)`,
            ['NPR', 'USD', 0.0075, 'api']);

        console.log('[SETUP] Exchange rates seeded (NPR→SGD=0.0074, NPR→USD=0.0075)');

        // Verify exchange rates were stored
        const rates = await all('SELECT * FROM exchange_rates');
        console.log('[SETUP] All exchange rates in DB:', JSON.stringify(rates));

        // Ensure transfer category exists 
        await run(`INSERT OR IGNORE INTO categories (type, name, status, color, icon) VALUES ('transfer', 'Transfer', 'active', '#2563eb', 'arrow-right-left')`);
    });

    afterAll(async () => {
        if (closeDatabase) await closeDatabase();
        // Give a small delay for file handle release if necessary (Windows specific)
        await new Promise(resolve => setTimeout(resolve, 100));
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    });

    it('getExchangeRate should find direct rate (NPR→SGD)', async () => {
        const rate = await FinanceModel.getExchangeRate('NPR', 'SGD');
        console.log('[TEST] Direct rate NPR→SGD:', rate);
        expect(rate).toBe(0.0074);
    });

    it('getExchangeRate should compute reverse rate (SGD→NPR)', async () => {
        const rate = await FinanceModel.getExchangeRate('SGD', 'NPR');
        console.log('[TEST] Reverse rate SGD→NPR:', rate);
        expect(rate).toBeCloseTo(1 / 0.0074, 2);
    });

    it('getExchangeRate should compute cross-rate (SGD→USD)', async () => {
        // SGD→USD = (NPR→USD) / (NPR→SGD) = 0.0075 / 0.0074
        const rate = await FinanceModel.getExchangeRate('SGD', 'USD');
        const expectedRate = 0.0075 / 0.0074;
        console.log('[TEST] Cross-rate SGD→USD:', rate, '(expected:', expectedRate, ')');
        expect(rate).toBeCloseTo(expectedRate, 4);
    });

    it('getExchangeRate should compute cross-rate (USD→SGD)', async () => {
        // USD→SGD = (NPR→SGD) / (NPR→USD) = 0.0074 / 0.0075
        const rate = await FinanceModel.getExchangeRate('USD', 'SGD');
        const expectedRate = 0.0074 / 0.0075;
        console.log('[TEST] Cross-rate USD→SGD:', rate, '(expected:', expectedRate, ')');
        expect(rate).toBeCloseTo(expectedRate, 4);
    });

    it('should correctly apply exchange rate on SGD→USD transfer', async () => {
        const transferAmount = 100;
        const expectedRate = 0.0075 / 0.0074; // SGD→USD cross-rate ≈ 1.0135
        const expectedToAmount = Math.round(transferAmount * expectedRate * 100) / 100;

        console.log('[TEST] Creating transfer: 100 SGD from account', sgdAccountId, 'to account', usdAccountId);

        const tx = await FinanceModel.create('transaction', {
            type: 'transfer',
            account_id: sgdAccountId,
            to_account_id: usdAccountId,
            amount: transferAmount,
            start_date: new Date().toISOString().split('T')[0],
            description: 'Test Transfer SGD to USD'
        });

        console.log('[TEST] Transaction created:', JSON.stringify(tx));

        // Get the full transaction by ID
        const fullTx = await FinanceModel.getTransactionById(tx.id);
        console.log('[TEST] Full transaction from DB:', JSON.stringify(fullTx));

        // Verify exchange rate was applied
        const dbTx = await get('SELECT * FROM transactions WHERE id = ?', [tx.id]);
        console.log('[TEST] Raw DB transaction:', JSON.stringify(dbTx));

        expect(dbTx.currency).toBe('SGD');
        expect(dbTx.exchange_rate).toBeCloseTo(expectedRate, 4);
        expect(dbTx.to_amount).toBeCloseTo(expectedToAmount, 2);

        // Verify account balances
        const sgdAcc = await get('SELECT balance FROM accounts WHERE id = ?', [sgdAccountId]);
        const usdAcc = await get('SELECT balance FROM accounts WHERE id = ?', [usdAccountId]);

        console.log('[TEST] SGD account balance after transfer:', sgdAcc.balance, '(expected:', 1000 - transferAmount, ')');
        console.log('[TEST] USD account balance after transfer:', usdAcc.balance, '(expected:', 1000 + expectedToAmount, ')');

        // SGD account should have 1000 - 100 = 900
        expect(sgdAcc.balance).toBe(900);

        // USD account should have 1000 + converted amount (not raw 100)
        expect(usdAcc.balance).toBeCloseTo(1000 + expectedToAmount, 2);
        // Most importantly, it should NOT be 1100
        expect(usdAcc.balance).not.toBe(1100);
    });

    it('getAccountsWithConvertedBalances should convert to NPR correctly', async () => {
        const converted = await FinanceModel.getAccountsWithConvertedBalances('NPR');
        console.log('[TEST] Converted balances:', JSON.stringify(converted.map((a: any) => ({
            name: a.name,
            currency: a.currency,
            balance: a.balance,
            converted_balance: a.converted_balance
        }))));

        // Each account's converted_balance should be much higher than raw balance (since 1 SGD/USD ≈ 135 NPR)
        for (const acc of converted) {
            if (acc.currency === 'NPR') {
                expect(acc.converted_balance).toBe(acc.balance);
            } else {
                // Converted should be > raw (since NPR value of foreign currencies is much higher)
                expect(acc.converted_balance).toBeGreaterThan(acc.balance);
            }
        }
    });
});
