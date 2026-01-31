
import { dbInstance, dbInitialized } from '../database/db';
import { createDbHelpers } from '../database/helpers';

const { all } = createDbHelpers(dbInstance);

async function listTriggers() {
    await dbInitialized;
    console.log('--- Database Triggers ---');
    const triggers = await all("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger'");
    if (triggers.length === 0) {
        console.log('NO TRIGGERS FOUND.');
    } else {
        triggers.forEach((t: any) => {
            console.log(`- ${t.name} on ${t.tbl_name}`);
        });
    }

    console.log('\n--- Transaction History Sample ---');
    const history = await all("SELECT * FROM transaction_history LIMIT 5");
    console.log(history);

    process.exit(0);
}

listTriggers().catch(err => {
    console.error(err);
    process.exit(1);
});
