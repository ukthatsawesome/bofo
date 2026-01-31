
import { dbInstance } from '../database/db';
import { createDbHelpers } from '../database/helpers';

const { all } = createDbHelpers(dbInstance);

async function checkColumns() {
    console.log('Checking Transaction Table Columns...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const columns = await all(`PRAGMA table_info(transactions)`);
    const colNames = columns.map((c: any) => c.name);

    console.log('Columns in DB:', colNames);

    const fieldsInSchema = [
        'account_id', 'to_account_id', 'type', 'category', 'amount',
        'description', 'attachment', 'frequency', 'start_date', 'end_date',
        'currency', 'exchange_rate', 'to_amount', 'tags', 'is_active',
    ];

    const missingInSchema = colNames.filter(c => !fieldsInSchema.includes(c) && c !== 'id' && c !== 'created_at' && c !== 'updated_at' && c !== 'deleted_at');

    if (missingInSchema.length > 0) {
        console.log('COLUMNS IN DB BUT MISSING IN SCHEMA:', missingInSchema);
    } else {
        console.log('Schema covers all known DB columns.');
    }

    process.exit(0);
}

checkColumns().catch(err => {
    console.error(err);
    process.exit(1);
});
