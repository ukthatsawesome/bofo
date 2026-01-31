
import { FinanceModel } from '../models/finance';
import { dbInstance } from '../database/db';
import { createDbHelpers } from '../database/helpers';

const { all } = createDbHelpers(dbInstance);

// Set limit to prevent infinite hang
setTimeout(() => {
    console.error('Test TIMED OUT - DEADLOCK DETECTED!');
    process.exit(1);
}, 5000);

async function checkDeadlock() {
    console.log('Testing Nested Write (Potential Deadlock)...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create a BillType with auto_transaction enabled
    let account = (await FinanceModel.getAllAccounts())[0];
    if (!account) {
        await FinanceModel.create('account', { name: 'Test Account', type: 'bank', balance: 1000 });
        account = (await FinanceModel.getAllAccounts())[0];
    }

    console.log('Creating Bill Type...');
    const billType = await FinanceModel.create('billType', {
        name: 'Deadlock Bill',
        unit_name: 'Units',
        category_name: 'Utilities',
        account_id: account.id,
        auto_transaction: 1 // This triggers the recursive create()
    });

    console.log('Creating Bill Reading (Should trigger auto-transaction)...');

    // This calls create('billReading'), which calls afterWrite, which calls create('transaction')
    // If Mutex is not re-entrant, this hangs forever.
    await FinanceModel.create('billReading', {
        bill_type_id: billType.id,
        date: new Date().toISOString().split('T')[0],
        units_used: 10,
        total_cost: 50
    });

    console.log('Bill Reading created successfully. NO DEADLOCK.');
    process.exit(0);
}

checkDeadlock().catch(err => {
    console.error(err);
    process.exit(1);
});
