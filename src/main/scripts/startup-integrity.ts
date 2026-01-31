
import { dbInitialized, db, all } from '../database/db';
import { FinanceModel } from '../models/finance';

async function testStartup() {
    console.log('[Test] Starting Startup Integrity Check...');

    try {
        console.log('[Test] Waiting for DB initialization...');
        await dbInitialized;
        console.log('[Test] DB Initialized successfully.');

        console.log('[Test] Checking Pragmas...');
        const wal = await all("PRAGMA journal_mode");
        const sync = await all("PRAGMA synchronous");
        const timeout = await all("PRAGMA busy_timeout");
        console.log('[Test] journal_mode:', wal);
        console.log('[Test] synchronous:', sync);
        console.log('[Test] busy_timeout:', timeout);

        console.log('[Test] Loading basic metadata via FinanceModel...');
        // Note: getAllAccounts is a specialized method in FinanceModel
        const accounts = await (FinanceModel as any).getAllAccounts();
        console.log(`[Test] Loaded ${accounts.length} accounts.`);

        console.log('[Test] Fetching monthly totals...');
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const monthlyStats = await (FinanceModel as any).getMonthlyTotals(firstDay, lastDay);
        console.log('[Test] Monthly Stats:', monthlyStats);

        console.log('[Test] PASSED: Main process logic is stable.');
        process.exit(0);
    } catch (err) {
        console.error('[Test] FAILED with error:', err);
        process.exit(1);
    }
}

testStartup().catch(err => {
    console.error('[Test] Fatal Error:', err);
    process.exit(1);
});
