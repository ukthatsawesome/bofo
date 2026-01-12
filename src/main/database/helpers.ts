/**
 * Shared Database Helper Functions
 * Promisified wrappers for sqlite3 callback-based methods
 */

import type { Database, RunResult } from 'sqlite3';

export interface DbRunResult {
    id: number;
    changes: number;
}

export interface DbHelpers {
    run: (sql: string, params?: unknown[]) => Promise<DbRunResult>;
    get: <T = unknown>(sql: string, params?: unknown[]) => Promise<T | undefined>;
    all: <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
}

/**
 * Creates promisified database helpers bound to a db instance
 */
export function createDbHelpers(db: Database): DbHelpers {
    return {
        run(sql: string, params: unknown[] = []): Promise<DbRunResult> {
            return new Promise((resolve, reject) => {
                db.run(sql, params, function (this: RunResult, err: Error | null) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, changes: this.changes });
                });
            });
        },

        get<T = unknown>(sql: string, params: unknown[] = []): Promise<T | undefined> {
            return new Promise((resolve, reject) => {
                db.get(sql, params, (err: Error | null, row: T) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        },

        all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
            return new Promise((resolve, reject) => {
                db.all(sql, params, (err: Error | null, rows: T[]) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
    };
}
