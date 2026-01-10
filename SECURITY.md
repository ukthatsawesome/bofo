# 🔐 Bofo Security Guide

This document describes the security measures implemented in Bofo to protect your financial data.

---

## 🛡️ Data Security Overview

Bofo is designed with **privacy-first** principles. All your financial data stays on your machine, encrypted and secure.

| Feature | Implementation | Status |
|---------|----------------|--------|
| **Encryption at Rest** | AES-256 via SQLCipher | ✅ Implemented |
| **Dev/Prod Separation** | Separate database files | ✅ Implemented |
| **Local-Only Data** | No cloud storage | ✅ Implemented |
| **XSS Protection** | DOM sanitization | ✅ Implemented |
| **SQL Injection Protection** | Parameterized queries | ✅ Implemented |
| **Content Security Policy** | CSP headers | ✅ Implemented |

---

## 🔒 Database Encryption

### How It Works

Bofo uses **SQLCipher**, an open-source extension to SQLite that provides transparent AES-256 encryption. This means:

1. **All database files are encrypted** - Your `finance.db` cannot be read by other applications
2. **Encryption is transparent** - The app works exactly the same, just more secure
3. **Industry standard** - SQLCipher is used by organizations worldwide for sensitive data

### Encryption Key Management

```
┌─────────────────────────────────────────────────────────────┐
│                    Key Generation Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   First Launch                                               │
│       │                                                      │
│       ▼                                                      │
│   Generate 256-bit random key                                │
│       │                                                      │
│       ▼                                                      │
│   Encrypt key with machine-specific salt                     │
│   (uses AES-256-GCM + hostname + username)                   │
│       │                                                      │
│       ▼                                                      │
│   Store encrypted key in userData/.bofo-key                  │
│       │                                                      │
│       ▼                                                      │
│   Use key to encrypt database                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Storage Locations

| Environment | Key Location | Notes |
|-------------|--------------|-------|
| **Production (Windows)** | `%APPDATA%\bofo\.bofo-key` | Encrypted, machine-bound |
| **Production (macOS)** | `~/Library/Application Support/bofo/.bofo-key` | Encrypted, machine-bound |
| **Production (Linux)** | `~/.config/bofo/.bofo-key` | Encrypted, machine-bound |
| **Development** | Deterministic key from salt | For debugging only |

### Security Properties

1. **Machine-Bound Keys**: The encryption key is further protected using a salt derived from your machine's hostname and username. This means:
   - The key file cannot be copied to another machine
   - Even if someone steals the key file, they cannot decrypt it elsewhere

2. **Unique Per Installation**: Each installation generates its own random encryption key

3. **No Network Transmission**: Keys are never sent over the network

---

## 🔀 Development vs Production Separation

### Database Files

| Environment | Database Path | Encryption Key |
|-------------|---------------|----------------|
| **Development** | `<project>/finance.dev.db` | Deterministic (for debugging) |
| **Production** | `%APPDATA%/bofo/finance.db` | Random, unique per install |

### How It's Determined

```javascript
const isDev = !app || !app.isPackaged || process.env.NODE_ENV === 'development';
```

This ensures:
- **Developers cannot accidentally access production databases**
- **Development changes don't affect user data**
- **Testing is isolated from real financial data**

---

## 🛠️ Migrating Existing Databases

### Automatic Migration

When Bofo detects an unencrypted database from a previous version, it will:

1. **Create a backup** of the unencrypted database (`.plaintext.bak`)
2. **Encrypt the database** using the new encryption key
3. **Replace the original** with the encrypted version
4. **Log the migration** for troubleshooting

### Manual Migration

If automatic migration fails, you can manually migrate:

1. **Backup your data** using Bofo's Export feature (Settings → Export → JSON)
2. **Delete the old database** (`finance.db`)
3. **Restart Bofo** - a new encrypted database will be created
4. **Import your data** using the Import feature

---

## 🔧 Troubleshooting

### "Database is encrypted or is not a database"

This error occurs when:
- The database was created with a different encryption key
- The key file (`.bofo-key`) was deleted or corrupted
- The database file is corrupted

**Solution:**
1. Check if `.bofo-key` exists in your userData folder
2. If you have a backup, restore from backup
3. If no backup, you may need to start fresh (data will be lost)

### "SQLCipher not available"

This warning means the encrypted database package didn't install properly.

**Solution:**
```bash
# Rebuild native modules
npm run rebuild

# Or reinstall dependencies
rm -rf node_modules
npm install
npx electron-rebuild
```

---

## 📊 Security Best Practices for Users

1. **Regular Backups**: Enable auto-backup in Settings
2. **Secure Your Machine**: Use full-disk encryption (BitLocker, FileVault)
3. **Lock Your Screen**: Always lock your computer when away
4. **Update Regularly**: Keep Bofo updated for security patches

---

## 🔬 Security Audit Checklist

For developers and security reviewers:

- [x] **Encryption at Rest**: SQLCipher AES-256
- [x] **Key Derivation**: CSPRNG for key generation
- [x] **Key Storage**: AES-256-GCM encrypted with machine salt
- [x] **SQL Injection**: Parameterized queries throughout
- [x] **XSS Prevention**: DOM sanitization in all user-facing inputs
- [x] **CSP Headers**: Content Security Policy enabled
- [x] **Dev/Prod Isolation**: Separate database files and keys
- [x] **No Hardcoded Secrets**: Keys generated at runtime
- [x] **Secure IPC**: contextIsolation and nodeIntegration settings

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `src/database/db.js` | Database connection with encryption |
| `src/database/encryption.js` | Key management and cryptography |
| `src/database/schema.sql` | Database schema definition |
| `src/main/preload.js` | Secure IPC bridge |

---

## 📞 Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do NOT** create a public GitHub issue
2. Email the security details privately to the maintainers
3. Include steps to reproduce the vulnerability
4. Allow reasonable time for a fix before public disclosure

---

*Last updated: January 2026*
