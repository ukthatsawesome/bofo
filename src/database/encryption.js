/**
 * Database Encryption Management
 * 
 * This module handles secure key generation, storage, and database encryption
 * using SQLCipher (AES-256 encryption at rest).
 * 
 * Security Model (Priority Order):
 * 1. Electron safeStorage API (OS-level credential store - most secure)
 *    - Windows: Credential Manager (DPAPI)
 *    - macOS: Keychain
 *    - Linux: Secret Service API / libsecret
 * 2. Fallback: Machine-salt encrypted file (for systems without safeStorage)
 * 3. Development: Deterministic key for debugging
 * 
 * Key Security Properties:
 * - safeStorage keys are encrypted by the OS and tied to the user session
 * - Cannot be decrypted even if copied to another machine
 * - Automatically migrates from legacy format to safeStorage
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

let app, safeStorage;
try {
    const electron = require('electron');
    app = electron.app;
    safeStorage = electron.safeStorage;
} catch (e) {
    app = null;
    safeStorage = null;
}

const isDev = app ? !app.isPackaged : (process.env.NODE_ENV === 'development');

// Constants
const KEY_LENGTH = 32; // 256 bits for AES-256
const KEY_FILE_NAME = '.bofo-key'; // Legacy format (machine-salt)
const SAFE_KEY_FILE_NAME = '.bofo-key-secure'; // New format (safeStorage)
const DEV_KEY_SALT = 'bofo-dev-environment-salt-2025';

// Log function to help debug production issues
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
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
function getKeyDirectory() {
    let dir;
    if (isDev) {
        dir = path.join(__dirname, '../..');
    } else {
        if (!app) {
            log('[Encryption] ERROR: app is null in production!');
            // Fallback to a safe default - use APPDATA directly
            const appData = process.env.APPDATA || process.env.HOME;
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
    } catch (err) {
        log(`[Encryption] Failed to create directory: ${err.message}`);
    }

    return dir;
}

/**
 * Generates a cryptographically secure random key
 */
function generateSecureKey() {
    return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Check if safeStorage is available and ready to use
 */
function isSafeStorageAvailable() {
    try {
        if (!safeStorage) {
            log('[Encryption] safeStorage module not available');
            return false;
        }
        const available = safeStorage.isEncryptionAvailable();
        log(`[Encryption] safeStorage.isEncryptionAvailable(): ${available}`);
        return available;
    } catch (error) {
        log(`[Encryption] safeStorage check failed: ${error.message}`);
        return false;
    }
}

/**
 * Encrypt a key using Electron's safeStorage API
 * Returns a Base64 encoded string of the encrypted buffer
 */
function encryptWithSafeStorage(key) {
    if (!isSafeStorageAvailable()) {
        throw new Error('safeStorage is not available');
    }
    
    const encrypted = safeStorage.encryptString(key);
    return JSON.stringify({
        data: encrypted.toString('base64'),
        version: 2, // Version 2 = safeStorage format
        timestamp: new Date().toISOString()
    });
}

/**
 * Decrypt a key using Electron's safeStorage API
 */
function decryptWithSafeStorage(encryptedData) {
    if (!isSafeStorageAvailable()) {
        throw new Error('safeStorage is not available');
    }
    
    try {
        const parsed = JSON.parse(encryptedData);
        
        if (parsed.version !== 2) {
            throw new Error(`Invalid safeStorage version: ${parsed.version}`);
        }
        
        const encryptedBuffer = Buffer.from(parsed.data, 'base64');
        return safeStorage.decryptString(encryptedBuffer);
    } catch (error) {
        log(`[Encryption] safeStorage decryption failed: ${error.message}`);
        return null;
    }
}

/**
 * Gets a machine-specific salt for additional key protection (legacy fallback)
 * Returns 64 hex characters = 32 bytes when decoded (required for AES-256)
 */
function getMachineSalt() {
    const os = require('os');
    const hostname = os.hostname() || 'unknown-host';
    const username = (os.userInfo() && os.userInfo().username) || 'unknown-user';
    // Return full 64-char hex string (32 bytes) for AES-256
    return crypto.createHash('sha256')
        .update(`${hostname}:${username}:bofo-finance-v1`)
        .digest('hex');
}

/**
 * Encrypts the database key for storage (legacy fallback method)
 */
function encryptKeyLegacy(key) {
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
        version: 1 // Version 1 = legacy machine-salt format
    });
}

/**
 * Decrypts a stored database key (legacy fallback method)
 */
function decryptKeyLegacy(encryptedData) {
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
    } catch (error) {
        log(`[Encryption] Legacy decryption failed: ${error.message}`);
        return null;
    }
}

/**
 * Migrate key from legacy format to safeStorage format
 */
function migrateToSafeStorage(key, keyDir) {
    if (!isSafeStorageAvailable()) {
        log('[Encryption] Cannot migrate: safeStorage not available');
        return false;
    }
    
    const safeKeyPath = path.join(keyDir, SAFE_KEY_FILE_NAME);
    
    try {
        const encryptedKey = encryptWithSafeStorage(key);
        fs.writeFileSync(safeKeyPath, encryptedKey, { encoding: 'utf8' });
        log('[Encryption] Successfully migrated key to safeStorage format');
        
        // Optionally, we could delete the legacy file here, but keeping it
        // as a backup is safer in case of issues
        return true;
    } catch (error) {
        log(`[Encryption] Migration to safeStorage failed: ${error.message}`);
        return false;
    }
}

/**
 * Save key using the best available method
 */
function saveKey(key, keyDir) {
    // Try safeStorage first (most secure)
    if (isSafeStorageAvailable()) {
        const safeKeyPath = path.join(keyDir, SAFE_KEY_FILE_NAME);
        try {
            const encryptedKey = encryptWithSafeStorage(key);
            fs.writeFileSync(safeKeyPath, encryptedKey, { encoding: 'utf8' });
            log(`[Encryption] Key saved with safeStorage to: ${safeKeyPath}`);
            return true;
        } catch (error) {
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
    } catch (error) {
        log(`[Encryption] Legacy save failed: ${error.message}`);
        return false;
    }
}

/**
 * Load key from storage, trying safeStorage first, then legacy
 */
function loadKey(keyDir) {
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
        } catch (error) {
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
        } catch (error) {
            log(`[Encryption] Error reading legacy key: ${error.message}`);
        }
    }
    
    return null;
}

/**
 * Gets or creates the database encryption key
 */
function getOrCreateEncryptionKey() {
    log(`[Encryption] Init - isDev: ${isDev}, isPackaged: ${app ? app.isPackaged : 'N/A'}`);
    log(`[Encryption] safeStorage available: ${isSafeStorageAvailable()}`);

    if (isDev) {
        const devKey = crypto.createHash('sha256').update(DEV_KEY_SALT).digest('hex');
        log('[Encryption] Using dev key');
        return devKey;
    }

    const keyDir = getKeyDirectory();
    
    // Try to load existing key
    const existingKey = loadKey(keyDir);
    if (existingKey) {
        return existingKey;
    }

    // Generate and save new key
    log('[Encryption] No existing key found, generating new production key...');
    const newKey = generateSecureKey();

    // Ensure directory exists
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
}

/**
 * Checks if a database file is encrypted with SQLCipher
 * Returns: true if encrypted, false if plaintext, null if error
 */
function isDatabaseEncrypted(dbPath) {
    if (!fs.existsSync(dbPath)) return false;

    let fd;
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
    } catch (error) {
        log(`[Encryption] DB Check Error: ${error.message}`);
        return null; // Uncertain
    } finally {
        if (fd !== undefined) fs.closeSync(fd);
    }
}

/**
 * Configuration for SQLCipher
 */
function getSQLCipherConfig(key) {
    return [
        `PRAGMA key = "x'${key}'"`,
        'PRAGMA cipher_compatibility = 4',
        'PRAGMA cipher_memory_security = OFF'
    ];
}

/**
 * Get security status for diagnostics
 */
function getSecurityStatus() {
    const keyDir = getKeyDirectory();
    const safeKeyPath = path.join(keyDir, SAFE_KEY_FILE_NAME);
    const legacyKeyPath = path.join(keyDir, KEY_FILE_NAME);
    
    return {
        safeStorageAvailable: isSafeStorageAvailable(),
        usingSafeStorage: fs.existsSync(safeKeyPath),
        hasLegacyKey: fs.existsSync(legacyKeyPath),
        keyDirectory: keyDir,
        isDev
    };
}

module.exports = {
    getOrCreateEncryptionKey,
    isDatabaseEncrypted,
    getSQLCipherConfig,
    getSecurityStatus,
    isSafeStorageAvailable,
    isDev,
    KEY_FILE_NAME,
    SAFE_KEY_FILE_NAME,
    log
};
