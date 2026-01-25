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
 */

import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import type { App } from 'electron';

// We need to use require for electron to avoid issues if we are in a non-electron constraint environment?
// But this is backend code.
// However, `electron` import is fine in Main process.
// We use `let` binding to handle potential missing electron in pure node tests if any.
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

// Constants
const KEY_LENGTH = 32; // 256 bits for AES-256
export const KEY_FILE_NAME = '.bofo-key'; // Legacy format (machine-salt)
export const SAFE_KEY_FILE_NAME = '.bofo-key-secure'; // New format (safeStorage)
const DEV_KEY_SALT = 'bofo-dev-environment-salt-2025';

// Log function to help debug production issues
export function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  if (isDev) console.log(message);
  try {
    if (app) {
      const logPath = path.join(app.getPath('userData'), 'bofo.log');
      fs.appendFileSync(logPath, logMessage);
    }
  } catch (e) { }
}

/**
 * Gets the directory for storing the encryption key
 */
function getKeyDirectory(): string {
  let dir: string;
  if (isDev) {
    dir = path.join(__dirname, '../..');
  } else {
    if (!app) {
      log('[Encryption] ERROR: app is null in production!');
      // Fallback to a safe default - use APPDATA directly
      const appData = process.env.APPDATA || process.env.HOME || '.';
      dir = path.join(appData, 'Bofo');
    } else {
      dir = app.getPath('userData');
    }
  }
  log(`[Encryption] Storage directory: ${dir}`);

  // Ensure the directory exists
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`[Encryption] Created storage directory: ${dir}`);
    }
  } catch (err: any) {
    log(`[Encryption] Failed to create directory: ${err.message}`);
  }

  return dir;
}

/**
 * Generates a cryptographically secure random key
 */
function generateSecureKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Check if safeStorage is available and ready to use
 */
export function isSafeStorageAvailable(): boolean {
  try {
    if (!safeStorage) {
      log('[Encryption] safeStorage module not available');
      return false;
    }
    const available = safeStorage.isEncryptionAvailable();
    log(`[Encryption] safeStorage.isEncryptionAvailable(): ${available}`);
    return available;
  } catch (error: any) {
    log(`[Encryption] safeStorage check failed: ${error.message}`);
    return false;
  }
}

/**
 * Encrypt a key using Electron's safeStorage API
 * Returns a Base64 encoded string of the encrypted buffer
 */
function encryptWithSafeStorage(key: string): string {
  if (!isSafeStorageAvailable() || !safeStorage) {
    throw new Error('safeStorage is not available');
  }

  const encrypted = safeStorage.encryptString(key);
  return JSON.stringify({
    data: encrypted.toString('base64'),
    version: 2, // Version 2 = safeStorage format
    timestamp: new Date().toISOString(),
  });
}

/**
 * Decrypt a key using Electron's safeStorage API
 */
function decryptWithSafeStorage(encryptedData: string): string | null {
  if (!isSafeStorageAvailable() || !safeStorage) {
    throw new Error('safeStorage is not available');
  }

  try {
    const parsed = JSON.parse(encryptedData);

    if (parsed.version !== 2) {
      throw new Error(`Invalid safeStorage version: ${parsed.version}`);
    }

    const encryptedBuffer = Buffer.from(parsed.data, 'base64');
    return safeStorage.decryptString(encryptedBuffer);
  } catch (error: any) {
    log(`[Encryption] safeStorage decryption failed: ${error.message}`);
    return null;
  }
}

/**
 * Gets a machine-specific salt for additional key protection (legacy fallback)
 * Returns 64 hex characters = 32 bytes when decoded (required for AES-256)
 */
function getMachineSalt(): string {
  const os = require('os');
  const hostname = os.hostname() || 'unknown-host';
  const username = (os.userInfo() && os.userInfo().username) || 'unknown-user';
  // Return full 64-char hex string (32 bytes) for AES-256
  return crypto
    .createHash('sha256')
    .update(`${hostname}:${username}:bofo-finance-v1`)
    .digest('hex');
}

/**
 * Encrypts the database key for storage (legacy fallback method)
 */
function encryptKeyLegacy(key: string): string {
  const salt = getMachineSalt();
  const iv = crypto.randomBytes(16);
  // Salt is 64 hex chars = 32 bytes, exactly what AES-256 needs
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

/**
 * Decrypts a stored database key (legacy fallback method)
 */
function decryptKeyLegacy(encryptedData: string): string | null {
  try {
    const { iv, authTag, data, version } = JSON.parse(encryptedData);

    if (version !== 1) {
      throw new Error(`Unsupported legacy key version: ${version}`);
    }

    const salt = getMachineSalt();
    // Salt is 64 hex chars = 32 bytes, exactly what AES-256 needs
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(salt, 'hex'),
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error: any) {
    log(`[Encryption] Legacy decryption failed: ${error.message}`);
    return null;
  }
}

/**
 * Migrate key from legacy format to safeStorage format
 */
function migrateToSafeStorage(key: string, keyDir: string): boolean {
  if (!isSafeStorageAvailable()) {
    log('[Encryption] Cannot migrate: safeStorage not available');
    return false;
  }

  const safeKeyPath = path.join(keyDir, SAFE_KEY_FILE_NAME);

  try {
    const encryptedKey = encryptWithSafeStorage(key);
    fs.writeFileSync(safeKeyPath, encryptedKey, { encoding: 'utf8' });
    log('[Encryption] Successfully migrated key to safeStorage format');
    return true;
  } catch (error: any) {
    log(`[Encryption] Migration to safeStorage failed: ${error.message}`);
    return false;
  }
}

/**
 * Save key using the best available method
 */
function saveKey(key: string, keyDir: string): boolean {
  // Try safeStorage first (most secure)
  if (isSafeStorageAvailable()) {
    const safeKeyPath = path.join(keyDir, SAFE_KEY_FILE_NAME);
    try {
      const encryptedKey = encryptWithSafeStorage(key);
      fs.writeFileSync(safeKeyPath, encryptedKey, { encoding: 'utf8' });
      log(`[Encryption] Key saved with safeStorage to: ${safeKeyPath}`);
      return true;
    } catch (error: any) {
      log(`[Encryption] safeStorage save failed: ${error.message}`);
      // Fall through to legacy method
    }
  }

  // Fallback to legacy machine-salt method
  const legacyKeyPath = path.join(keyDir, KEY_FILE_NAME);
  try {
    const encryptedKey = encryptKeyLegacy(key);
    fs.writeFileSync(legacyKeyPath, encryptedKey, { encoding: 'utf8' });
    log(`[Encryption] Key saved with legacy method to: ${legacyKeyPath}`);
    return true;
  } catch (error: any) {
    log(`[Encryption] Legacy save failed: ${error.message}`);
    return false;
  }
}

/**
 * Load key from storage, trying safeStorage first, then legacy
 */
function loadKey(keyDir: string): string | null {
  const safeKeyPath = path.join(keyDir, SAFE_KEY_FILE_NAME);
  const legacyKeyPath = path.join(keyDir, KEY_FILE_NAME);

  // Try safeStorage format first (version 2)
  if (fs.existsSync(safeKeyPath) && isSafeStorageAvailable()) {
    try {
      const encryptedKey = fs.readFileSync(safeKeyPath, 'utf8');
      const key = decryptWithSafeStorage(encryptedKey);
      if (key) {
        log('[Encryption] Key loaded from safeStorage');
        return key;
      }
      log('[Encryption] safeStorage key exists but decryption failed');
    } catch (error: any) {
      log(`[Encryption] Error reading safeStorage key: ${error.message}`);
    }
  }

  // Try legacy format (version 1)
  if (fs.existsSync(legacyKeyPath)) {
    try {
      const encryptedKey = fs.readFileSync(legacyKeyPath, 'utf8');
      const key = decryptKeyLegacy(encryptedKey);

      if (key) {
        log('[Encryption] Key loaded from legacy format');

        // Attempt to migrate to safeStorage for future use
        if (isSafeStorageAvailable() && !fs.existsSync(safeKeyPath)) {
          log('[Encryption] Attempting migration to safeStorage...');
          migrateToSafeStorage(key, keyDir);
        }

        return key;
      }
      log('[Encryption] Legacy key exists but decryption failed');
    } catch (error: any) {
      log(`[Encryption] Error reading legacy key: ${error.message}`);
    }
  }

  return null;
}

/**
 * Gets or creates the database encryption key
 */
export function getOrCreateEncryptionKey(): string {
  try {
    console.log('[Encryption] DEBUG: Entering getOrCreateEncryptionKey');
    require('fs').writeFileSync('encryption_debug.txt', 'Entering getOrCreateEncryptionKey\n');
    log(`[Encryption] Init - isDev: ${isDev}, isPackaged: ${app ? app.isPackaged : 'N/A'}`);
    require('fs').appendFileSync('encryption_debug.txt', 'After Init log\n');
    log('[Encryption] Checking safeStorage...');
    require('fs').appendFileSync('encryption_debug.txt', 'After SafeStorage log\n');

    if (isDev) {
      console.log('[Encryption] DEBUG: isDev branch');
      const devKey = crypto.createHash('sha256').update(DEV_KEY_SALT).digest('hex');
      console.log('[Encryption] DEBUG: devKey generated');
      log('[Encryption] Using dev key');
      return devKey;
    }

    const keyDir = getKeyDirectory();
    const existingKey = loadKey(keyDir);
    if (existingKey) {
      return existingKey;
    }

    log('[Encryption] No existing key found, generating new production key...');
    const newKey = generateSecureKey();

    if (!fs.existsSync(keyDir)) {
      fs.mkdirSync(keyDir, { recursive: true });
      log(`[Encryption] Created key directory: ${keyDir}`);
    }

    if (saveKey(newKey, keyDir)) {
      log('[Encryption] New key saved successfully');
    } else {
      log('[Encryption] WARNING: Failed to save key - data may be lost on restart!');
    }

    return newKey;
  } catch (err: any) {
    console.error('[Encryption] FATAL ERROR in getOrCreateEncryptionKey:', err);
    throw err;
  }
}

/**
 * Checks if a database file is encrypted with SQLCipher
 * Returns: true if encrypted, false if plaintext, null if error
 */
export function isDatabaseEncrypted(dbPath: string): boolean | null {
  if (!fs.existsSync(dbPath)) return false;

  let fd: number | undefined;
  try {
    const stats = fs.statSync(dbPath);
    if (stats.size < 16) return false; // Not a valid DB yet

    const header = Buffer.alloc(16);
    fd = fs.openSync(dbPath, 'r');
    fs.readSync(fd, header, 0, 16, 0);

    const sqliteHeader = 'SQLite format 3';
    const isPlain = header.toString('utf8', 0, 15) === sqliteHeader;

    log(`[Encryption] DB Check: ${dbPath} - isPlain: ${isPlain}`);
    return !isPlain;
  } catch (error: any) {
    log(`[Encryption] DB Check Error: ${error.message}`);
    return null; // Uncertain
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/**
 * Configuration for SQLCipher
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
export function getSecurityStatus(): any {
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
