/**
 * Migration Utilities
 *
 * Helper functions to reduce boilerplate in migration definitions.
 * These utilities make migrations more concise, readable, and less error-prone.
 *
 * @module utils
 */

import type { DbHelpers } from '../helpers';
import type { ColumnInfo } from '../types';

/**
 * Checks if a specific column exists in a table.
 *
 * @param all - The `all` helper from DbHelpers to execute the PRAGMA query.
 * @param table - The name of the table to check.
 * @param column - The name of the column to look for.
 * @returns True if the column exists, false otherwise.
 */
export async function hasColumn(
  all: DbHelpers['all'],
  table: string,
  column: string
): Promise<boolean> {
  const columns = await all<ColumnInfo>(`PRAGMA table_info(${table})`);
  return columns.some((c) => c.name === column);
}

/**
 * Retrieves a list of column names for a specific table.
 *
 * @param all - The `all` helper from DbHelpers.
 * @param table - The name of the table.
 * @returns An array of column names.
 */
export async function getColumnNames(all: DbHelpers['all'], table: string): Promise<string[]> {
  const columns = await all<ColumnInfo>(`PRAGMA table_info(${table})`);
  return columns.map((c) => c.name);
}

/**
 * Adds a single column to a table if it does not already exist.
 *
 * @param helpers - The DbHelpers object.
 * @param table - The name of the table.
 * @param column - The name of the column to add.
 * @param definition - The SQL definition of the column (e.g., 'TEXT NOT NULL').
 * @param log - A logging function to record changes.
 * @returns True if the column was added, false if it already existed.
 */
export async function addColumnIfNotExists(
  helpers: DbHelpers,
  table: string,
  column: string,
  definition: string,
  log: (msg: string) => void
): Promise<boolean> {
  if (await hasColumn(helpers.all, table, column)) {
    return false;
  }

  await helpers.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  log(`[DB] Added ${column} to ${table}`);
  return true;
}

/**
 * Adds multiple columns to a table in sequence, skipping existing ones.
 *
 * @param helpers - The DbHelpers object.
 * @param table - The name of the table.
 * @param columns - An array of objects defining the column name and SQL definition.
 * @param log - A logging function to record changes.
 * @returns The number of columns that were actually added.
 */
export async function addColumns(
  helpers: DbHelpers,
  table: string,
  columns: Array<{ name: string; definition: string }>,
  log: (msg: string) => void
): Promise<number> {
  const existing = await getColumnNames(helpers.all, table);
  let added = 0;

  for (const col of columns) {
    if (!existing.includes(col.name)) {
      await helpers.run(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.definition}`);
      log(`[DB] Added ${col.name} to ${table}`);
      added++;
    }
  }

  return added;
}

/**
 * Creates a database index if it does not exist.
 *
 * @param run - The `run` helper from DbHelpers.
 * @param name - The name of the index to create.
 * @param table - The name of the table to index.
 * @param columns - A single column name (string) or an array of column names.
 * @param options - Optional settings (e.g., unique index).
 */
export async function createIndex(
  run: DbHelpers['run'],
  name: string,
  table: string,
  columns: string | string[],
  options: { unique?: boolean } = {}
): Promise<void> {
  const cols = Array.isArray(columns) ? columns.join(', ') : columns;
  const unique = options.unique ? 'UNIQUE ' : '';
  await run(`CREATE ${unique}INDEX IF NOT EXISTS ${name} ON ${table}(${cols})`);
}

/**
 * Creates multiple indexes in sequence.
 *
 * @param run - The `run` helper from DbHelpers.
 * @param indexes - An array of index definitions to create.
 */
export async function createIndexes(
  run: DbHelpers['run'],
  indexes: Array<{ name: string; table: string; columns: string | string[]; unique?: boolean }>
): Promise<void> {
  for (const idx of indexes) {
    await createIndex(run, idx.name, idx.table, idx.columns, { unique: idx.unique });
  }
}

/**
 * Drops an existing trigger (if any) and creates a new one.
 * This function simulates a "CREATE OR REPLACE TRIGGER" behavior since SQLite does not support it natively.
 *
 * @param run - The `run` helper from DbHelpers.
 * @param name - The name of the trigger.
 * @param sql - The full SQL statement to create the trigger.
 */
export async function createTrigger(
  run: DbHelpers['run'],
  name: string,
  sql: string
): Promise<void> {
  await run(`DROP TRIGGER IF EXISTS ${name}`);
  await run(sql);
}
