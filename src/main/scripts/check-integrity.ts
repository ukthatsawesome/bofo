
import { dbInstance } from '../database/db';
import { createDbHelpers } from '../database/helpers';

const { all } = createDbHelpers(dbInstance);

async function checkIntegrity() {
    console.log('Running Database Integrity Check...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 1. Check for Duplicate Transactions (heuristic: same amount, desc, date, account)
    // We group by these fields and see if count > 1
    console.log('--- Checking for Duplicates ---');
    const duplicates = await all(`
        SELECT 
            amount, description, start_date, account_id, COUNT(*) as count, GROUP_CONCAT(id) as ids
        FROM transactions
        WHERE is_active = 1
        GROUP BY amount, description, start_date, account_id
        HAVING count > 1
    `);

    if (duplicates.length > 0) {
        console.log(`FOUND ${duplicates.length} SETS OF DUPLICATE TRANSACTIONS:`);
        duplicates.forEach((d: any) => {
            console.log(`- x${d.count}: ${d.description} (${d.amount}) on ${d.start_date} [IDs: ${d.ids}]`);
        });
    } else {
        console.log('No obvious duplicates found.');
    }

    // 2. Check for NULLs in required fields (Type Mismatch Check)
    console.log('\n--- Checking for Invalid NULLs ---');
    const invalidRows = await all(`
        SELECT id, description FROM transactions 
        WHERE amount IS NULL 
           OR start_date IS NULL 
           OR account_id IS NULL 
           OR type IS NULL
    `);

    if (invalidRows.length > 0) {
        console.log(`FOUND ${invalidRows.length} INVALID TRANSACTIONS (NULL fields):`);
        console.log(invalidRows);
    } else {
        console.log('No invalid NULLs found in core fields.');
    }

    // 3. Check for Orphaned Transactions (account_id not in accounts)
    console.log('\n--- Checking for Orphaned Data ---');
    const orphans = await all(`
        SELECT t.id, t.description, t.account_id 
        FROM transactions t
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE a.id IS NULL AND t.account_id IS NOT NULL
    `);

    if (orphans.length > 0) {
        console.log(`FOUND ${orphans.length} ORPHANED TRANSACTIONS:`);
        console.log(orphans);
    } else {
        console.log('No orphaned transactions found.');
    }

    process.exit(0);
}

checkIntegrity().catch(err => {
    console.error(err);
    process.exit(1);
});
