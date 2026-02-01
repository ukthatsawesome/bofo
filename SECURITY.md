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

Bofo uses **Electron's safeStorage API** as the primary method for securing the database encryption key. This provides **OS-level credential protection** that is significantly more secure than file-based storage.

```
┌─────────────────────────────────────────────────────────────┐
│                    Key Generation Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   First Launch                                               │
│       │                                                      │
│       ▼                                                      │
│   Generate 256-bit random key (CSPRNG)                       │
│       │                                                      │
│       ▼                                                      │
│   ┌─────────────────────────────────────────┐                │
│   │ Is safeStorage available?               │                │
│   │ (OS Credential Store)                   │                │
│   └──────────────┬──────────────────────────┘                │
│              YES │                    NO                     │
│       ┌──────────┴───────────┐    ┌─────────────────────┐    │
│       ▼                      │    ▼                     │    │
│   Encrypt with safeStorage   │  Encrypt with machine   │    │
│   (OS credential manager)    │  salt (AES-256-GCM)     │    │
│       │                      │    │                     │    │
│       ▼                      │    ▼                     │    │
│   Save to .bofo-key-secure   │  Save to .bofo-key      │    │
│       └──────────────────────┴────┘                          │
│                       │                                      │
│                       ▼                                      │
│   Use key to encrypt database with SQLCipher                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### safeStorage Protection (Primary Method)

The safeStorage API uses the operating system's native secure credential storage:

| Platform | Backend | Protection |
|----------|---------|------------|
| **Windows** | Credential Manager (DPAPI) | Tied to Windows user session |
| **macOS** | Keychain | Tied to macOS user account |
| **Linux** | Secret Service API / libsecret | Tied to user session/GNOME Keyring |

**Why safeStorage is more secure:**
- 🔒 **OS-level encryption**: Keys are encrypted by the operating system itself
- 🚫 **Cannot be copied**: Even if you copy the encrypted file, it cannot be decrypted on another machine or by another user
- 🔑 **Session-bound**: Tied to the user's OS session, not just machine identifiers
- ✅ **Industry standard**: Uses the same mechanisms as password managers and browsers

### Key Storage Locations

| Environment | Primary Key Location | Fallback Location |
|-------------|---------------------|-------------------|
| **Production (Windows)** | `%APPDATA%\bofo\.bofo-key-secure` | `%APPDATA%\bofo\.bofo-key` |
| **Production (macOS)** | `~/Library/Application Support/bofo/.bofo-key-secure` | `~/Library/Application Support/bofo/.bofo-key` |
| **Production (Linux)** | `~/.config/bofo/.bofo-key-secure` | `~/.config/bofo/.bofo-key` |
| **Development** | N/A (in-memory deterministic key) | N/A |

### Security Properties

1. **OS-Protected Keys (safeStorage)**: The encryption key is protected by the operating system's credential manager:
   - 🔐 Windows: Uses DPAPI (Data Protection API) tied to your Windows login
   - 🔐 macOS: Stored in the Keychain, protected by your macOS password
   - 🔐 Linux: Uses libsecret/GNOME Keyring or similar

2. **Automatic Migration**: If you have an existing installation with the legacy key format, Bofo will automatically:
   - Load the key from the legacy format
   - Re-encrypt it using safeStorage
   - Use the more secure format going forward

3. **Fallback Protection**: On systems where safeStorage is unavailable, keys are encrypted with a machine-specific salt (hostname + username + AES-256-GCM)

4. **Unique Per Installation**: Each installation generates its own random encryption key
5. **No Network Transmission**: Keys are never sent over the network

---

## 📡 Remote Access Security (Beta)

Bofo includes an optional feature to view your financial dashboard from other devices on your local network.

### Security Architecture

1.  **Local Network Only**: The server binds to your local IP address. It is **not** exposed to the public internet unless you manually port-forward (which is **strongly discouraged**).
2.  **Access Key Authentication**: A user-defined Access Key (password) is required to view any data.
    - The key is stored in the encrypted settings database.
    - All requests must include this key in the Authorization header or query parameter.
3.  **Full Access Control**: The remote API provides full capability to manage your finances, including adding transactions. Treat your Access Key like a password.

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Man-in-the-Middle** | The local server runs on HTTP. **Only enable this on trusted private networks (Home LAN).** Do not use on public Wi-Fi. |
| **Brute Force** | The server implements rate-limiting to prevent password guessing attacks. |
| **Unauthorized Write** | The API requires authentication for ALL operations. No unauthenticated writes are possible. |
| **Exposure** | The feature is **disabled by default**. You must explicitly turn it on in Settings. |

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
- The key file (`.bofo-key-secure` or `.bofo-key`) was deleted or corrupted
- The database file is corrupted
- The OS credential store has been reset (safeStorage uses OS credentials)

**Solution:**
1. Check if `.bofo-key-secure` or `.bofo-key` exists in your userData folder
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
- [x] **Key Storage (Primary)**: Electron safeStorage API (OS credential store)
- [x] **Key Storage (Fallback)**: AES-256-GCM encrypted with machine salt
- [x] **Key Migration**: Automatic upgrade from legacy to safeStorage format
- [x] **SQL Injection**: Parameterized queries throughout
- [x] **XSS Prevention**: DOM sanitization in all user-facing inputs
- [x] **CSP Headers**: Content Security Policy enabled (hardened in v1.1.2)
- [x] **Dev/Prod Isolation**: Separate database files and keys
- [x] **No Hardcoded Secrets**: Keys generated at runtime
- [x] **Secure IPC**: contextIsolation and nodeIntegration settings
- [x] **Dependency Audit**: Replaced vulnerable `xlsx` with `exceljs` (CVE-2024-22363)
- [x] **Web Server Security**: Default localhost binding, explicit opt-in for external access
- [x] **Debug Log Cleanup**: Removed debug console.log statements from production paths

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `src/main/database/db.ts` | Database connection with SQLCipher encryption |
| `src/main/preload.ts` | Secure IPC bridge / Context Bridge |
| `src/main/main.ts` | Main process entry and security configurations |
| `src/renderer/lib/api/FinanceService.ts` | Frontend API consumer |

---

## 📞 Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do NOT** create a public GitHub issue
2. Email the security details privately to the maintainers
3. Include steps to reproduce the vulnerability
4. Allow reasonable time for a fix before public disclosure

---

*Last updated: January 2026*
