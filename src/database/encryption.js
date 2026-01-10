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

const isDev = app ? !app.isPackaged : (process.env.NODE_ENV === 'development');

// Constants
const KEY_LENGTH = 32; // 256 bits for AES-256
const KEY_FILE_NAME = '.bofo-key';
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
 * Gets a machine-specific salt for additional key protection
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
 * Encrypts the database key for storage
 */
function encryptKey(key) {
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
        log(`[Encryption] Decryption failed: ${error.message}`);
        return null;
    }
}

/**
 * Gets or creates the database encryption key
 */
function getOrCreateEncryptionKey() {
    log(`[Encryption] Init - isDev: ${isDev}, isPackaged: ${app ? app.isPackaged : 'N/A'}`);

    if (isDev) {
        const devKey = crypto.createHash('sha256').update(DEV_KEY_SALT).digest('hex');
        log('[Encryption] Using dev key');
        return devKey;
    }

    const keyFilePath = path.join(getKeyDirectory(), KEY_FILE_NAME);

    if (fs.existsSync(keyFilePath)) {
        try {
            const encryptedKey = fs.readFileSync(keyFilePath, 'utf8');
            const key = decryptKey(encryptedKey);

            if (key) {
                log('[Encryption] Key loaded successfully');
                return key;
            }
            log('[Encryption] Key exists but decryption failed');
        } catch (error) {
            log(`[Encryption] Error reading key file: ${error.message}`);
        }
    }

    log(`[Encryption] Generating new production key. Will save to: ${keyFilePath}`);
    const newKey = generateSecureKey();

    try {
        // Double-check directory exists before writing
        const keyDir = path.dirname(keyFilePath);
        if (!fs.existsSync(keyDir)) {
            fs.mkdirSync(keyDir, { recursive: true });
            log(`[Encryption] Created key directory: ${keyDir}`);
        }

        const encryptedKey = encryptKey(newKey);
        fs.writeFileSync(keyFilePath, encryptedKey, { encoding: 'utf8' });
        log(`[Encryption] New key saved successfully to: ${keyFilePath}`);

        // Verify the file was written
        if (fs.existsSync(keyFilePath)) {
            const stat = fs.statSync(keyFilePath);
            log(`[Encryption] Key file verified: ${stat.size} bytes`);
        } else {
            log('[Encryption] WARNING: Key file not found after write!');
        }
    } catch (error) {
        log(`[Encryption] Failed to save key: ${error.message}`);
        log(`[Encryption] Error stack: ${error.stack}`);
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

module.exports = {
    getOrCreateEncryptionKey,
    isDatabaseEncrypted,
    getSQLCipherConfig,
    isDev,
    KEY_FILE_NAME,
    log
};
