# 🚀 Bofo Migration & Update Guide

This guide explains how to safely update the Bofo application and its database without losing user data or causing crashes.

---

## 🏗️ 1. Database Migrations (Existing Users)

Bofo uses a **transactional migration system** located in `src/database/db.js`. When you need to change the database structure (add columns, new tables, etc.), **NEVER** modify the user's existing database directly.

### How to add a migration:
1. Open `src/database/db.js`.
2. Find the `migrations` array.
3. Add a new object at the end with a unique, incremented `id`.

**Example: Adding a 'notes' column to Accounts**
```javascript
const migrations = [
    // ... existing migrations ...
    {
        id: 4, // Next sequential ID
        description: 'Add notes to accounts table',
        run: async (db) => {
            await db.run('ALTER TABLE accounts ADD COLUMN notes TEXT DEFAULT ""');
        }
    }
];
```

### Rules for Migrations:
*   **Sequential IDs**: IDs must only increase. The app tracks the last run ID in the `migrations` table.
*   **Null Safety/Defaults**: Always provide a `DEFAULT` value for new columns or allow them to be `NULL`. This prevents errors in existing records.
*   **No Deletions**: Avoid deleting columns (`DROP COLUMN`). If a column is no longer needed, simply stop using it in the code. SQLite has limited support for dropping columns.

---

## 📜 2. The Schema Rule (New Users)

When you update the database via a migration, you must also update `src/database/schema.sql`.

*   **Existing Users**: Get the update via the migration in `db.js`.
*   **New Users**: Get the latest structure via `schema.sql` when the app is first installed.

Keep these two files in sync!

---

## 🔢 3. Versioning & Packaging

### Steps to release a new version:
1.  **Bump Version**: Update `"version": "1.x.x"` in `package.json`.
2.  **Verify CSS**: Run `npm run build:css` (though the build script handles this).
3.  **Build Installer**: Run `npm run dist:win`.
    *   This creates a new `.exe` in the `dist/` folder.
    *   The installer is smart: it replaces the app code but **leaves the user's database (`finance.db`) untouched**.

---

## 🛡️ 4. Safety Checklist

1.  **Test the Path**: Before distributing a new version, copy a production `finance.db` to your development `userData` folder and see if the app starts and migrates correctly.
2.  **Auto-Backup**: Ensure the "Daily Auto-Backup" feature is functioning. This is the ultimate safety net if a migration fails.
3.  **Error Logging**: If a migration fails, the app will log the error and stop. Users can find logs or contact support.

---

## 📁 Key Files Summary
*   `src/database/db.js`: Where the migration logic and history live.
*   `src/database/schema.sql`: The master template for new installations.
*   `package.json`: Versioning and build configurations.
*   `%APPDATA%/bofo/finance.db`: Where the user's actual data lives (on Windows).
