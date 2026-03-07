/**
 * Shared Database Helper Functions
 *
 * This module provides a set of promisified wrappers around the standard
 * sqlite3 callback-based API. This allows the use of async/await syntax
 * for database operations.
 *
 * @module helpers
 */

import type { Database, RunResult } from './types';

/**
 * The result object returned by a successful database `run` operation.
 */
export interface DbRunResult {
  /** The ID of the last inserted row (for INSERT operations) */
  id: number;
  /** The number of rows affected by the operation (for UPDATE/DELETE) */
  changes: number;
}

/**
 * A collection of helper methods for interacting with the database.
 * These methods wrap the standard sqlite3 methods in Promises.
 */
export interface DbHelpers {
  /**
   * Executes a SQL statement (INSERT, UPDATE, DELETE, etc.).
   * @param sql - The SQL string to execute.
   * @param params - Parameters to bind to the SQL statement.
   * @returns A promise resolving to the run result (ID and changes).
   */
  run: (sql: string, params?: unknown[]) => Promise<DbRunResult>;

  /**
   * Retrieves a single row from the database.
   * @template T - The expected type of the row object.
   * @param sql - The SQL SELECT string.
   * @param params - Parameters to bind to the SQL statement.
   * @returns A promise resolving to the row object or undefined if not found.
   */
  get: <T = unknown>(sql: string, params?: unknown[]) => Promise<T | undefined>;

  /**
   * Retrieves all rows from a query.
   * @template T - The expected type of the row objects.
   * @param sql - The SQL SELECT string.
   * @param params - Parameters to bind to the SQL statement.
   * @returns A promise resolving to an array of row objects.
   */
  all: <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
}

/**
 * Creates a set of promisified database helpers bound to a specific database instance.
 *
 * @param db - The active sqlite3 Database instance.
 * @returns An object containing `run`, `get`, and `all` methods.
 */
export function createDbHelpers(db: Database): DbHelpers {
  return {
    run(sql: string, params: unknown[] = []): Promise<DbRunResult> {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function (this: RunResult, err: Error | null) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, changes: this.changes });
          }
        });
      });
    },

    get<T = unknown>(sql: string, params: unknown[] = []): Promise<T | undefined> {
      return new Promise((resolve, reject) => {
        db.get(sql, params, (err: Error | null, row: T | undefined) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
    },

    all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err: Error | null, rows: T[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
    },
  };
}
