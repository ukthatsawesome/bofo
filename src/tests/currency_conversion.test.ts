import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SETTING_KEYS } from '../shared/settings/keys';

process.env.NODE_ENV = 'development';
const dbPath = path.join(__dirname, 'test_currency.db');
process.env.TEST_DB_PATH = dbPath;

vi.mock('electron', () => ({
  app: {
    getPath: () => __dirname,
    isPackaged: false,
  },
  ipcMain: { handle: () => {} },
}));

describe('Currency Conversion Logic', () => {
  let FinanceModel: any;
  let db: any;
  let run: any;
  let get: any;

  let usdAccountId: number;
  let eurAccountId: number;

  beforeAll(async () => {
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

      const dbModule = await import('../main/database/db');
      db = dbModule.db;
      run = dbModule.run;
      get = dbModule.get;
      await dbModule.dbInitialized;

      const financeModule = await import('../main/models/finance');
      FinanceModel = financeModule.FinanceModel;

      await run(
        `INSERT OR IGNORE INTO categories (type, name, status, color, icon) VALUES ('transfer', 'Transfer', 'active', '#2563eb', 'arrow-right-left')`
      );

      await run(
        `INSERT OR IGNORE INTO categories (type, name, status, color, icon) VALUES ('expense', 'Groceries', 'active', '#10b981', 'shopping-cart')`
      );
      const catRes = await get('SELECT id FROM categories WHERE name = ? AND type = ?', [
        'Groceries',
        'expense',
      ]);
      const groceriesId = catRes.id;

      const acc1 = await FinanceModel.create('account', {
        name: 'Test USD Account',
        type: 'bank',
        balance: 1000,
        currency: 'USD',
        is_active: 1,
      });
      usdAccountId = acc1.id;

      const acc2 = await FinanceModel.create('account', {
        name: 'Test EUR Account',
        type: 'bank',
        balance: 0,
        currency: 'EUR',
        is_active: 1,
      });
      eurAccountId = acc2.id;

      await run(
        `INSERT OR REPLACE INTO settings (key, value, category) VALUES (?, 'USD', 'currency')`,
        [SETTING_KEYS.CURRENCY.BASE]
      );

      await run(
        `INSERT OR REPLACE INTO exchange_rates (from_currency, to_currency, rate, source) VALUES (?, ?, ?, ?)`,
        ['USD', 'EUR', 0.85, 'manual']
      );

      await run(
        `INSERT OR REPLACE INTO exchange_rates (from_currency, to_currency, rate, source) VALUES (?, ?, ?, ?)`,
        ['EUR', 'USD', 1.18, 'manual']
      );
    } catch (e) {
      console.error('BEFORE ALL ERROR:', e);
      throw e;
    }
  });

  afterAll(() => {
    // if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('should calculate to_amount and update balances correctly for USD -> EUR transfer', async () => {
    const transferAmount = 100;

    const result = await FinanceModel.create('transaction', {
      type: 'transfer',
      account_id: usdAccountId,
      to_account_id: eurAccountId,
      amount: transferAmount,
      start_date: new Date().toISOString().split('T')[0],
      description: 'Test Transfer USD to EUR',
    });

    const tx = await FinanceModel.getTransactionById(result.id);

    expect(tx.currency).toBe('USD');
    expect(tx.exchange_rate).toBe(0.85);
    expect(tx.to_amount).toBe(85);

    const usdAcc = await get('SELECT balance FROM accounts WHERE id = ?', [usdAccountId]);

    expect(usdAcc.balance).toBe(900);

    const eurAcc = await get('SELECT balance FROM accounts WHERE id = ?', [eurAccountId]);

    expect(eurAcc.balance).toBe(85);
  });

  it('should calculate base_amount (USD) correctly for EUR expense', async () => {
    const cat = await get('SELECT id FROM categories WHERE name = ?', ['Groceries']);
    const expenseAmountEUR = 100;

    const result = await FinanceModel.create('transaction', {
      type: 'expense',
      account_id: eurAccountId, // EUR Account
      amount: expenseAmountEUR,
      category: 'Groceries',
      category_id: cat.id,
      start_date: new Date().toISOString().split('T')[0],
      description: 'Test EUR Expense',
    });

    const tx = await FinanceModel.getTransactionById(result.id);

    expect(tx.currency).toBe('EUR');
    expect(tx.base_currency).toBe('USD');

    expect(Math.abs(tx.base_amount - 118)).toBeLessThan(0.01);
  });
});
