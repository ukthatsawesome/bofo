
import { FinanceModel } from '../models/finance';
import { dbInstance } from '../database/db';
import { createDbHelpers } from '../database/helpers';

const { all } = createDbHelpers(dbInstance);

async function checkDoubleWrite() {
    console.log('Simulating User Transaction Creation...');

    // Give DB time to connect
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get an account to use
    const accounts = await FinanceModel.getAllAccounts();
    if (accounts.length === 0) {
        console.log('No accounts found. Seeding one.');
        await FinanceModel.create('account', { name: 'Test Account', type: 'bank', balance: 1000 });
    }
    const account = (await FinanceModel.getAllAccounts())[0];

    // Create a transaction (normal user flow)
    console.log('Creating transaction...');
    const result = await FinanceModel.create('transaction', {
        account_id: account.id,
        type: 'expense',
        amount: 50,
        category: 'Food',
        description: 'Test Double Write',
        start_date: new Date().toISOString().split('T')[0],
        is_active: 1
    }, { source: 'USER' }); // Default audit context

    console.log(`Created transaction ID: ${result.id}`);

    // Check history for this ID
    const history = await all(`
        SELECT * FROM transaction_history WHERE transaction_id = ?
    `, [result.id]);

    console.log(`Found ${history.length} history entries for ID ${result.id}`);
    console.log(JSON.stringify(history, null, 2));

    process.exit(0);
}

checkDoubleWrite().catch(err => {
    console.error(err);
    process.exit(1);
});
