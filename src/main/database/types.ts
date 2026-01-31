/**
 * Database Type Definitions
 *
 * This module serves as the central type authority for the database layer.
 * It re-exports shared application types and defines internal database-specific 
 * interfaces (migrations, helpers, configuration).
 *
 * @module types
 */

import type { Database, RunResult } from 'sqlite3';

// =============================================================================
// SHARED TYPES RE-EXPORT
// =============================================================================

import type {
  Account,
  AccountType,
  BillReading,
  BillType,
  Budget,
  Category,
  ExchangeRate,
  Goal,
  GoalContribution,
  RecurringCharge,
  Setting,
  Transaction,
  TransactionFrequency,
  TransactionType,
  TransactionWithCategory,
} from '../../shared/types';

export type {
  Account,
  AccountType,
  BillReading,
  BillType,
  Budget,
  Category,
  ExchangeRate,
  Goal,
  GoalContribution,
  RecurringCharge,
  Setting,
  Transaction,
  TransactionFrequency,
  TransactionType,
  TransactionWithCategory,
};

// =============================================================================
// DATABASE HELPER TYPES
// =============================================================================

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
   * @param params - Optional parameters to bind to the SQL statement.
   */
  run: (sql: string, params?: unknown[]) => Promise<DbRunResult>;

  /**
   * Retrieves a single row from the database.
   * @template T - The expected type of the row object.
   * @param sql - The SQL SELECT string.
   * @param params - Optional parameters to bind to the SQL statement.
   */
  get: <T = unknown>(sql: string, params?: unknown[]) => Promise<T | undefined>;

  /**
   * Retrieves all rows from a query.
   * @template T - The expected type of the row objects.
   * @param sql - The SQL SELECT string.
   * @param params - Optional parameters to bind to the SQL statement.
   */
  all: <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
}

// =============================================================================
// MIGRATION TYPES
// =============================================================================

/**
 * Defines a database migration step.
 */
export interface Migration {
  /** Unique identifier for the migration (ascending order) */
  id: number;
  /** Human-readable name describing the migration's purpose */
  name: string;
  /** The asynchronous function that applies the database changes */
  up: () => Promise<void>;
}

/**
 * Represents a migration record stored in the `migrations` table.
 */
export interface AppliedMigration {
  /** Unique identifier for the migration */
  id: number;
  /** Human-readable name of the migration */
  name: string;
  /** ISO timestamp string of when the migration was applied */
  applied_at: string;
}

/**
 * Represents column metadata returned by `PRAGMA table_info`.
 */
export interface ColumnInfo {
  /** Column ID (index in the table) */
  cid: number;
  /** Name of the column */
  name: string;
  /** Declared data type of the column */
  type: string;
  /** Whether the column has a NOT NULL constraint (1 = true, 0 = false) */
  notnull: number;
  /** Default value defined for the column */
  dflt_value: unknown;
  /** Whether the column is part of the primary key (1 = true, 0 = false) */
  pk: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * A union type of all valid table names in the database schema.
 * Useful for generic functions or type guards that accept a table name as an argument.
 */
export type TableName =
  | 'accounts'
  | 'transactions'
  | 'categories'
  | 'budgets'
  | 'goals'
  | 'goal_contributions'
  | 'recurring_charges'
  | 'bill_types'
  | 'bill_readings'
  | 'exchange_rates'
  | 'settings'
  | 'transaction_history'
  | 'migrations'
  | 'audit_logs';

/**
 * Configuration required to initialize the database connection.
 */
export interface DatabaseConfig {
  /** The filesystem path to the database file */
  path: string;
  /** The encryption key used for SQLCipher */
  encryptionKey: string;
  /** Flag indicating if the application is running in development mode */
  isDev: boolean;
}

/**
 * Context object passed to migration functions to execute queries and log output.
 */
export interface MigrationContext {
  /** Database helper to execute run operations */
  run: DbHelpers['run'];
  /** Database helper to execute get operations */
  get: DbHelpers['get'];
  /** Database helper to execute all operations */
  all: DbHelpers['all'];
  /** Logging function for migration output */
  log: (message: string) => void;
}

// =============================================================================
// SQLITE3 TYPE RE-EXPORTS
// =============================================================================

/** Re-export core sqlite3 types for convenience within the DB module */
export type { Database, RunResult };