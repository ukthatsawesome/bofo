# Fix Report

## Issues Resolved

1.  **`SQLITE_ERROR: no such table`**:
    *   **Root Cause**: The database schema file (`schema.sql`) was not being correctly properly loaded or found during the bootstrap process in the built environment, causing tables to be missing.
    *   **Fix**: Inlined the SQL schema directly into `src/main/database/db.ts` to ensure reliable database initialization without file path dependencies. Verified `finance.dev.db` recreation.

2.  **`ForecastEngine is not a constructor`**:
    *   **Root Cause**: Incorrect import of `ForecastEngine` in `src/main/ipc/handlers.ts` using `require`. The TypeScript class is exported as a named export, but the code treated it as a default export.
    *   **Fix**: Updated `src/main/ipc/handlers.ts` to destructure the import: `const { ForecastEngine } = require('../utils/forecast');`.

3.  **`ForecastEngine` Regression (Recurring Charges)**:
    *   **Root Cause**: The migrated TypeScript version of `ForecastEngine` lacked the logic to handle recurring charges, which existed in the JS version.
    *   **Fix**: 
        *   Updated `src/main/utils/forecast.ts` to accept `recurringCharges` in the constructor.
        *   Implemented `_mergeRecurringIntoTransactions` to generate virtual expenses from recurring charges for the forecast period.
        *   Updated `src/main/services/financeService.ts` to fetch and pass recurring charges to the engine.

4.  **Build & Cleanup**:
    *   Removed conflicting CSS (`src/renderer/styles.css`) that was causing build issues alongside Tailwind.
    *   Removed unnecessary/harmful type definitions (`@types/electron-store`, `@types/ws`).
    *   Configured `tsconfig.json` (`allowJs: false`) and `package.json` to ensure a clean TypeScript build.

## Verification
- `npm run build` passes successfully.
- Application starts without critical errors.
- Database tables are created correctly.
