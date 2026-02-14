
import * as fs from 'fs';
import * as path from 'path';

// Set Env Vars BEFORE other imports
process.env.NODE_ENV = 'development';
process.env.DATABASE_PATH = path.join(__dirname, 'debug_currency.db');

async function main() {
    try {
        console.log("Starting verification...");

        // Dynamic Import to ensure Env Vars are set first
        console.log("Importing modules...");
        const { FinanceModel } = await import('../main/models/finance');
        const { db, run, get, dbInitialized } = await import('../main/database/db');
        console.log("Modules imported.");

        // Ensure DB is init
        console.log("Waiting for DB init...");
        try {
            await dbInitialized;
            console.log("DB Initialized successfully.");
        } catch (e) {
            console.error("DB Init FAILED:", e);
            throw e;
        }

        // Seed Categories
        console.log("Seeding categories...");
        try {
            await run(`INSERT OR IGNORE INTO categories (type, name, status, color, icon) VALUES ('transfer', 'Transfer', 'active', '#2563eb', 'arrow-right-left')`);
            await run(`INSERT OR IGNORE INTO categories (type, name, status, color, icon) VALUES ('expense', 'Groceries', 'active', '#10b981', 'shopping-cart')`);
        } catch (e) {
            console.error("Seeding Failed:", e);
            throw e;
        }

        const catRes = await get<any>('SELECT id FROM categories WHERE name = ? AND type = ?', ['Groceries', 'expense']);
        if (!catRes) throw new Error("Category seeding failed");
        const groceriesId = catRes.id;
        console.log("Categories seeded");

        // Create Accounts
        const acc1 = await FinanceModel.create('account', {
            name: 'Debug USD',
            type: 'checking',
            balance: 1000,
            currency: 'USD',
            is_active: 1
        });
        const usdAccountId = acc1.id;

        const acc2 = await FinanceModel.create('account', {
            name: 'Debug EUR',
            type: 'checking',
            balance: 0,
            currency: 'EUR',
            is_active: 1
        });
        const eurAccountId = acc2.id;
        console.log("Accounts created", { usdAccountId, eurAccountId });

        // Seed Rates
        await run(`INSERT INTO exchange_rates (from_currency, to_currency, rate, date, source) VALUES (?, ?, ?, ?, ?)`,
            ['USD', 'EUR', 0.85, new Date().toISOString(), 'manual']);
        await run(`INSERT INTO exchange_rates (from_currency, to_currency, rate, date, source) VALUES (?, ?, ?, ?, ?)`,
            ['EUR', 'USD', 1.18, new Date().toISOString(), 'manual']);
        console.log("Rates seeded");

        // Test 1: Transfer USD -> EUR
        const txRes = await FinanceModel.create('transaction', {
            type: 'transfer',
            account_id: usdAccountId,
            to_account_id: eurAccountId,
            amount: 100,
            start_date: new Date().toISOString(),
            description: 'Debug Transfer USD to EUR'
        });
        const txId = txRes.id;

        const tx = await get<any>('SELECT * FROM transactions WHERE id = ?', [txId]);
        console.log("Transaction created:", tx);

        if (tx.currency !== 'USD') console.error("FAIL: Currency expected USD, got", tx.currency);
        if (tx.exchange_rate !== 0.85) console.error("FAIL: Rate expected 0.85, got", tx.exchange_rate);
        if (tx.to_amount !== 85) console.error("FAIL: To Amount expected 85, got", tx.to_amount);

        const usdAcc = await get<any>('SELECT * FROM accounts WHERE id = ?', [usdAccountId]); //FinanceModel.getAccount(usdAccountId);
        const eurAcc = await get<any>('SELECT * FROM accounts WHERE id = ?', [eurAccountId]); //FinanceModel.getAccount(eurAccountId);

        console.log("Balances:", { USD: usdAcc.balance, EUR: eurAcc.balance });

        // Rounding issues might occur, use epsilon or strict integer math if cents?
        // Logic rounds to 2 decimals.
        if (usdAcc.balance !== 900) console.error("FAIL: USD Balance expected 900, got", usdAcc.balance);
        if (eurAcc.balance !== 85) console.error("FAIL: EUR Balance expected 85, got", eurAcc.balance);

        if (tx.currency === 'USD' && tx.to_amount === 85 && usdAcc.balance === 900 && eurAcc.balance === 85) {
            console.log("SUCCESS: Currency Conversion Verified!");
        } else {
            console.error("VERIFICATION FAILED");
            process.exit(1);
        }

    } catch (e) {
        console.error("CRITICAL ERROR:", e);
        process.exit(1);
    }
}

main();
