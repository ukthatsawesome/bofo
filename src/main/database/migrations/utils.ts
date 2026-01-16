/**
 * Migration Utilities
 *
 * Helper functions to reduce boilerplate in migration definitions.
 * These utilities make migrations more concise and less error-prone.
 */

import type { DbHelpers } from '../helpers';
import type { ColumnInfo } from '../types';

/**
 * Check if a column exists in a table
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
 * Add a column if it doesn't exist
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
 * Create an index if it doesn't exist
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
 * Drop and recreate a trigger
 */
export async function createTrigger(
  run: DbHelpers['run'],
  name: string,
  sql: string
): Promise<void> {
  await run(`DROP TRIGGER IF EXISTS ${name}`);
  await run(sql);
}

/**
 * Get column names for a table
 */
export async function getColumnNames(all: DbHelpers['all'], table: string): Promise<string[]> {
  const columns = await all<ColumnInfo>(`PRAGMA table_info(${table})`);
  return columns.map((c) => c.name);
}

/**
 * Batch add columns to a table
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
 * Create multiple indexes in parallel
 */
export async function createIndexes(
  run: DbHelpers['run'],
  indexes: Array<{ name: string; table: string; columns: string | string[]; unique?: boolean }>
): Promise<void> {
  for (const idx of indexes) {
    await createIndex(run, idx.name, idx.table, idx.columns, { unique: idx.unique });
  }
}
