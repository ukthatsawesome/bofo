
import { FinanceModel } from '../models/finance';
import { dbInstance } from '../database/db';
import { createDbHelpers } from '../database/helpers';

const { all } = createDbHelpers(dbInstance);

async function verifySingleSave() {
    console.log('Testing Write Flow & History Integrity...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get an account
    let account = (await FinanceModel.getAll('account'))[0];
    if (!account) {
        await FinanceModel.create('account', { name: 'Test Account', type: 'bank', balance: 100 });
        account = (await FinanceModel.getAll('account'))[0];
    }

    console.log('Creating Transaction...');
    const result = await FinanceModel.create('transaction', {
        account_id: account.id,
        type: 'expense',
        amount: 25.00,
        category: 'Food',
        description: 'History Verification Test',
        start_date: new Date().toISOString().split('T')[0],
        is_active: 1
    }, { source: 'VERIFIER' });

    console.log(`Transaction Created (ID: ${result.id}). Checking History...`);

    // Check transaction_history
    const history = await all(`SELECT * FROM transaction_history WHERE transaction_id = ?`, [result.id]);

    console.log(`Found ${history.length} history records.`);
    if (history.length === 1) {
        console.log('PASSED: Exactly one history record found (DB Trigger).');
    } else {
        console.error(`FAILED: Found ${history.length} history records! (Double save detected)`);
        console.log(history);
    }

    // Check audit_logs (should be 0 for transactions)
    const auditLogs = await all(`SELECT * FROM audit_logs WHERE entity_type = 'transaction' AND entity_id = ?`, [result.id]);
    console.log(`Found ${auditLogs.length} audit logs (should be 0).`);

    process.exit(history.length === 1 ? 0 : 1);
}

verifySingleSave().catch(err => {
    console.error(err);
    process.exit(1);
});
