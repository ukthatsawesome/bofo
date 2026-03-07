/**
 * Database Encryption Management
 *
 * This module handles secure key generation, storage, and database encryption
 * using SQLCipher (AES-256 encryption at rest).
 *
 * Security Model (Priority Order):
 * 1. Electron safeStorage API (OS-level credential store - most secure)
 * 2. Fallback: Machine-salt encrypted file (for systems without safeStorage)
 * 3. Development: Deterministic key for debugging
 *
 * @module encryption
 */

import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import type { App } from 'electron';

let app: App | null = null;
let safeStorage: typeof import('electron').safeStorage | null = null;

try {
  const electron = require('electron');
  app = electron.app;
  safeStorage = electron.safeStorage;
} catch (e) {
  app = null;
  safeStorage = null;
}

export const isDev = app ? !app.isPackaged : process.env.NODE_ENV === 'development';

const KEY_LENGTH = 32;
export const KEY_FILE_NAME = '.bofo-key';
export const SAFE_KEY_FILE_NAME = '.bofo-key-secure';
const DEV_KEY_SALT = 'bofo-dev-environment-salt-2025';

/**
 * Logs a message to console and, if available, to the application log file.
 */
function logInternal(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  if (isDev) console.log(message);

  try {
    if (app) {
      const logPath = path.join(app.getPath('userData'), 'bofo.log');
      fs.appendFileSync(logPath, logMessage);
    }
  } catch {
    // Intentionally empty: Log file write failure should not crash the app
  }
}

/**
 * Determines and ensures the existence of the directory for storing encryption keys.
 */
function getKeyDirectory(): string {
  let dir: string;

  if (isDev) {
    dir = path.join(__dirname, '../..');
  } else {
    if (!app) {
      logInternal('[Encryption] ERROR: app is null in production!');

      const appData = process.env.APPDATA || process.env.HOME || '.';
      dir = path.join(appData, 'Bofo');
    } else {
      dir = app.getPath('userData');
    }
  }

  logInternal(`[Encryption] Storage directory: ${dir}`);

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logInternal(`[Encryption] Created storage directory: ${dir}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logInternal(`[Encryption] Failed to create directory: ${message}`);
  }

  return dir;
}

/**
 * Generates a cryptographically secure random key (hex string).
 */
function generateSecureKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Generates a machine-specific salt for additional key protection (legacy fallback).
 * Returns 64 hex characters (32 bytes) suitable for AES-256.
 */
function getMachineSalt(): string {
  const hostname = os.hostname() || 'unknown-host';
  const username = (os.userInfo() && os.userInfo().username) || 'unknown-user';

  return crypto
    .createHash('sha256')
    .update(`${hostname}:${username}:bofo-finance-v1`)
    .digest('hex');
}

function isSafeStorageAvailable(): boolean {
  if (!safeStorage) {
    logInternal('[Encryption] safeStorage module not available');
    return false;
  }
  try {
    const available = safeStorage.isEncryptionAvailable();
    logInternal(`[Encryption] safeStorage.isEncryptionAvailable(): ${available}`);
    return available;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logInternal(`[Encryption] safeStorage check failed: ${message}`);
    return false;
  }
}

function encryptWithSafeStorage(key: string): string {
  if (!safeStorage) {
    throw new Error('safeStorage is not available');
  }

  const encrypted = safeStorage.encryptString(key);
  return JSON.stringify({
    data: encrypted.toString('base64'),
    version: 2, // Version 2 = safeStorage format
    timestamp: new Date().toISOString(),
  });
}

function decryptWithSafeStorage(encryptedData: string): string | null {
  if (!safeStorage) {
    throw new Error('safeStorage is not available');
  }

  try {
    const parsed = JSON.parse(encryptedData);

    if (parsed.version !== 2) {
      throw new Error(`Invalid safeStorage version: ${parsed.version}`);
    }

    const encryptedBuffer = Buffer.from(parsed.data, 'base64');
    return safeStorage.decryptString(encryptedBuffer);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logInternal(`[Encryption] safeStorage decryption failed: ${message}`);
    return null;
  }
}

function encryptKeyLegacy(key: string): string {
  const salt = getMachineSalt();
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(salt, 'hex'), iv);

  let encrypted = cipher.update(key, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted,
    version: 1, // Version 1 = legacy machine-salt format
  });
}

function decryptKeyLegacy(encryptedData: string): string | null {
  try {
    const { iv, authTag, data, version } = JSON.parse(encryptedData);

    if (version !== 1) {
      throw new Error(`Unsupported legacy key version: ${version}`);
    }

    const salt = getMachineSalt();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(salt, 'hex'),
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logInternal(`[Encryption] Legacy decryption failed: ${message}`);
    return null;
  }
}

/**
 * Migrates a legacy key to the safeStorage format.
 */
function migrateToSafeStorage(key: string, keyDir: string): boolean {
  if (!isSafeStorageAvailable()) {
    logInternal('[Encryption] Cannot migrate: safeStorage not available');
    return false;
  }

  const safeKeyPath = path.join(keyDir, SAFE_KEY_FILE_NAME);

  try {
    const encryptedKey = encryptWithSafeStorage(key);
    fs.writeFileSync(safeKeyPath, encryptedKey, { encoding: 'utf8' });
    logInternal('[Encryption] Successfully migrated key to safeStorage format');
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logInternal(`[Encryption] Migration to safeStorage failed: ${message}`);
    return false;
  }
}

/**
 * Saves the encryption key using the best available method.
 */
function saveKey(key: string, keyDir: string): boolean {
  if (isSafeStorageAvailable()) {
    const safeKeyPath = path.join(keyDir, SAFE_KEY_FILE_NAME);
    try {
      const encryptedKey = encryptWithSafeStorage(key);
      fs.writeFileSync(safeKeyPath, encryptedKey, { encoding: 'utf8' });
      logInternal(`[Encryption] Key saved with safeStorage to: ${safeKeyPath}`);
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logInternal(`[Encryption] safeStorage save failed: ${message}`);
      // Fall through to legacy method
    }
  }

  const legacyKeyPath = path.join(keyDir, KEY_FILE_NAME);
  try {
    const encryptedKey = encryptKeyLegacy(key);
    fs.writeFileSync(legacyKeyPath, encryptedKey, { encoding: 'utf8' });
    logInternal(`[Encryption] Key saved with legacy method to: ${legacyKeyPath}`);
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logInternal(`[Encryption] Legacy save failed: ${message}`);
    return false;
  }
}

/**
 * Loads the encryption key from storage.
 * Tries safeStorage (Version 2) first, then legacy (Version 1).
 */
function loadKey(keyDir: string): string | null {
  const safeKeyPath = path.join(keyDir, SAFE_KEY_FILE_NAME);
  const legacyKeyPath = path.join(keyDir, KEY_FILE_NAME);

  if (fs.existsSync(safeKeyPath) && isSafeStorageAvailable()) {
    try {
      const encryptedKey = fs.readFileSync(safeKeyPath, 'utf8');
      const key = decryptWithSafeStorage(encryptedKey);
      if (key) {
        logInternal('[Encryption] Key loaded from safeStorage');
        return key;
      }
      logInternal('[Encryption] safeStorage key exists but decryption failed');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logInternal(`[Encryption] Error reading safeStorage key: ${message}`);
    }
  }

  if (fs.existsSync(legacyKeyPath)) {
    try {
      const encryptedKey = fs.readFileSync(legacyKeyPath, 'utf8');
      const key = decryptKeyLegacy(encryptedKey);

      if (key) {
        logInternal('[Encryption] Key loaded from legacy format');

        if (isSafeStorageAvailable() && !fs.existsSync(safeKeyPath)) {
          logInternal('[Encryption] Attempting migration to safeStorage...');
          migrateToSafeStorage(key, keyDir);
        }

        return key;
      }
      logInternal('[Encryption] Legacy key exists but decryption failed');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logInternal(`[Encryption] Error reading legacy key: ${message}`);
    }
  }

  return null;
}

/**
 * Logs a message to console and file
 */
export function log(message: string): void {
  logInternal(message);
}

/**
 * Check if safeStorage is available and ready to use (re-export)
 */
export { isSafeStorageAvailable };

/**
 * Gets or creates the encryption key for the database
 */
export function getOrCreateEncryptionKey(): string {
  try {
    logInternal(`[Encryption] Init - isDev: ${isDev}, isPackaged: ${app ? app.isPackaged : 'N/A'}`);
    logInternal('[Encryption] Checking safeStorage...');

    if (isDev) {
      const devKey = crypto.createHash('sha256').update(DEV_KEY_SALT).digest('hex');
      logInternal('[Encryption] Using dev key');
      return devKey;
    }

    const keyDir = getKeyDirectory();
    const existingKey = loadKey(keyDir);

    if (existingKey) {
      return existingKey;
    }

    logInternal('[Encryption] No existing key found, generating new production key...');
    const newKey = generateSecureKey();

    if (!fs.existsSync(keyDir)) {
      fs.mkdirSync(keyDir, { recursive: true });
      logInternal(`[Encryption] Created key directory: ${keyDir}`);
    }

    if (saveKey(newKey, keyDir)) {
      logInternal('[Encryption] New key saved successfully');
    } else {
      logInternal('[Encryption] WARNING: Failed to save key - data may be lost on restart!');
    }

    return newKey;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Encryption] FATAL ERROR in getOrCreateEncryptionKey:', message);
    throw err;
  }
}

/**
 * Check if a database file is encrypted
 * @param dbPath Path to the database file
 * @returns true if encrypted, false if plaintext, null if unable to determine
 */
export function isDatabaseEncrypted(dbPath: string): boolean | null {
  if (!fs.existsSync(dbPath)) return false;

  let fd: number | undefined;
  try {
    const stats = fs.statSync(dbPath);
    if (stats.size < 16) return false;

    const header = Buffer.alloc(16);
    fd = fs.openSync(dbPath, 'r');
    fs.readSync(fd, header, 0, 16, 0);

    const sqliteHeader = 'SQLite format 3';
    const isPlain = header.toString('utf8', 0, 15) === sqliteHeader;

    logInternal(`[Encryption] DB Check: ${dbPath} - isPlain: ${isPlain}`);
    return !isPlain;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logInternal(`[Encryption] DB Check Error: ${message}`);
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/**
 * Get SQLCipher configuration pragmas
 * @param key The encryption key
 * @returns Array of PRAGMA statements
 */
export function getSQLCipherConfig(key: string): string[] {
  return [
    `PRAGMA key = "x'${key}'"`,
    'PRAGMA cipher_compatibility = 4',
    'PRAGMA cipher_memory_security = OFF',
  ];
}

/**
 * Get security status for diagnostics
 */
export function getSecurityStatus(): {
  safeStorageAvailable: boolean;
  usingSafeStorage: boolean;
  hasLegacyKey: boolean;
  keyDirectory: string;
  isDev: boolean;
} {
  const keyDir = getKeyDirectory();
  const safeKeyPath = path.join(keyDir, SAFE_KEY_FILE_NAME);
  const legacyKeyPath = path.join(keyDir, KEY_FILE_NAME);

  return {
    safeStorageAvailable: isSafeStorageAvailable(),
    usingSafeStorage: fs.existsSync(safeKeyPath),
    hasLegacyKey: fs.existsSync(legacyKeyPath),
    keyDirectory: keyDir,
    isDev,
  };
}
