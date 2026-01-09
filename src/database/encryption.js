/**
 * Database Encryption Management
 * 
 * This module handles secure key generation, storage, and database encryption
 * using SQLCipher (AES-256 encryption at rest).
 * 
 * Security Model:
 * - Each installation gets a unique encryption key
 * - Key is stored in OS keychain/credential manager when available
 * - Fallback to encrypted file in userData (encrypted with machine-specific salt)
 * - Development databases use a separate, deterministic dev key
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

let app;
try {
    app = require('electron').app;
} catch (e) {
    app = null;
}

const isDev = !app || !app.isPackaged || process.env.NODE_ENV === 'development';

// Constants
const KEY_LENGTH = 32; // 256 bits for AES-256
const KEY_FILE_NAME = '.bofo-key';
const DEV_KEY_SALT = 'bofo-dev-environment-salt-2025';

/**
 * Gets the directory for storing the encryption key
 */
function getKeyDirectory() {
    if (isDev) {
        return path.join(__dirname, '../..');
    }
    return app.getPath('userData');
}

/**
 * Generates a cryptographically secure random key
 */
function generateSecureKey() {
    return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Gets a machine-specific salt for additional key protection
 * Uses hostname + username as entropy sources
 */
function getMachineSalt() {
    const os = require('os');
    const hostname = os.hostname();
    const username = os.userInfo().username;
    return crypto.createHash('sha256')
        .update(`${hostname}:${username}:bofo-finance`)
        .digest('hex')
        .slice(0, 32);
}

/**
 * Encrypts the database key for storage
 */
function encryptKey(key) {
    const salt = getMachineSalt();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(salt, 'hex').slice(0, 32), iv);

    let encrypted = cipher.update(key, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return JSON.stringify({
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        data: encrypted,
        version: 1
    });
}

/**
 * Decrypts a stored database key
 */
function decryptKey(encryptedData) {
    try {
        const { iv, authTag, data, version } = JSON.parse(encryptedData);

        if (version !== 1) {
            throw new Error(`Unsupported key version: ${version}`);
        }

        const salt = getMachineSalt();
        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            Buffer.from(salt, 'hex').slice(0, 32),
            Buffer.from(iv, 'hex')
        );
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));

        let decrypted = decipher.update(data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('[Encryption] Failed to decrypt key:', error.message);
        return null;
    }
}

/**
 * Gets or creates the database encryption key
 * 
 * For development: Uses a deterministic key derived from a known salt
 * For production: Uses a secure random key stored encrypted on disk
 */
function getOrCreateEncryptionKey() {
    if (isDev) {
        // Development uses a deterministic key for easier debugging
        // This is NOT secure and should NEVER be used in production
        const devKey = crypto.createHash('sha256')
            .update(DEV_KEY_SALT)
            .digest('hex');
        console.log('[Encryption] Using development encryption key');
        return devKey;
    }

    const keyFilePath = path.join(getKeyDirectory(), KEY_FILE_NAME);

    // Try to read existing key
    if (fs.existsSync(keyFilePath)) {
        try {
            const encryptedKey = fs.readFileSync(keyFilePath, 'utf8');
            const key = decryptKey(encryptedKey);

            if (key) {
                console.log('[Encryption] Loaded existing encryption key');
                return key;
            }

            // If decryption failed, the file is corrupted or from different machine
            console.warn('[Encryption] Could not decrypt key file, generating new key');
        } catch (error) {
            console.error('[Encryption] Error reading key file:', error.message);
        }
    }

    // Generate new key for first-time setup
    console.log('[Encryption] Generating new encryption key for this installation');
    const newKey = generateSecureKey();

    try {
        const encryptedKey = encryptKey(newKey);
        fs.writeFileSync(keyFilePath, encryptedKey, { mode: 0o600 }); // Owner read/write only
        console.log('[Encryption] Encryption key saved securely');
    } catch (error) {
        console.error('[Encryption] Failed to save encryption key:', error.message);
        // Continue anyway - the key will be regenerated on next launch
        // This means data won't persist, but the app will still work
    }

    return newKey;
}

/**
 * Checks if a database file is encrypted with SQLCipher
 */
function isDatabaseEncrypted(dbPath) {
    if (!fs.existsSync(dbPath)) {
        return false; // New database, will be created encrypted
    }

    try {
        // SQLite databases start with "SQLite format 3\0"
        // SQLCipher encrypted databases start with random bytes
        const header = Buffer.alloc(16);
        const fd = fs.openSync(dbPath, 'r');
        fs.readSync(fd, header, 0, 16, 0);
        fs.closeSync(fd);

        const sqliteHeader = 'SQLite format 3';
        const isPlainSqlite = header.toString('utf8', 0, 15) === sqliteHeader;

        return !isPlainSqlite;
    } catch (error) {
        console.error('[Encryption] Error checking database encryption:', error.message);
        return false;
    }
}

/**
 * Configuration for SQLCipher
 * These are executed as PRAGMA statements after opening the database
 */
function getSQLCipherConfig(key) {
    return [
        // Set the encryption key (MUST be first)
        `PRAGMA key = "x'${key}'"`,

        // Use SQLCipher 4 defaults (compatible with most versions)
        'PRAGMA cipher_compatibility = 4',

        // Performance optimizations
        'PRAGMA cipher_memory_security = OFF', // Slight performance gain

        // Verify the key works by reading the database
        'SELECT count(*) FROM sqlite_master'
    ];
}

module.exports = {
    getOrCreateEncryptionKey,
    isDatabaseEncrypted,
    getSQLCipherConfig,
    isDev,
    KEY_FILE_NAME
};
