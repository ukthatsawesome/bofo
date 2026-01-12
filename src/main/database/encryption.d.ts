/**
 * Type declarations for encryption.js
 */

/**
 * Get or create the encryption key for the database
 */
export function getOrCreateEncryptionKey(): string;

/**
 * Check if a database file is encrypted
 * @param dbPath Path to the database file
 * @returns true if encrypted, false if plaintext, null if unable to determine
 */
export function isDatabaseEncrypted(dbPath: string): boolean | null;

/**
 * Get SQLCipher configuration pragmas
 * @param key The encryption key
 * @returns Array of PRAGMA statements
 */
export function getSQLCipherConfig(key: string): string[];

/**
 * Whether we're in development mode
 */
export const isDev: boolean;

/**
 * Log a message to console and file
 */
export function log(message: string): void;
