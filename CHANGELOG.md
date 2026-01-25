# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### 🚀 New Features
- **Database Seeding**: Dev tool to populate database with demo data for testing via `window.api.seedDatabase()`.

### 🛡️ Security (v1.1.2 Audit)
- **Dependency Update**: Replaced `xlsx` package with `exceljs` to address CVE-2024-22363 (prototype pollution vulnerability).
- **Content Security Policy**: Hardened CSP headers with stricter `script-src` and removed unsafe patterns.
- **Web Server Security**: Default binding changed from `0.0.0.0` to `localhost` (127.0.0.1). External access requires explicit opt-in.
- **Debug Log Cleanup**: Removed debug console.log statements from production code paths.

### ⚡ Performance
- **Startup Optimization**: Database initialization now skips schema execution on already-initialized databases (improved from ~5s to ~6ms on subsequent launches).
- **Timing Infrastructure**: Added startup timing logs for future performance profiling.

### 🛠 Improvements
- **Dashboard Charts**: Fixed property name mismatch between backend and frontend for chart data.
- **IPC Handlers**: Added missing `get-dashboard-data`, `get-summary-stats`, and `get-category-spending` handlers.

---

## [1.1.1] - 2026-01-15

### 🚀 New Features

- **Interactive Dashboard**: Completely redesigned dashboard with AI-driven financial insights, quick transaction entry, and real-time visualization of spending habits.
- **Bill Tracking**: New module for managing utility bills, tracking cost-per-unit over time, and handling recurring payment types.
- **Financial Sandbox**: A new scenario planning tool that allows users to project their wealth based on hypothetical life changes (e.g., salary increase, new debt).
- **AI Settings**: Configurable local AI integration (Ollama) to drive transaction categorization and financial advice.
- **Remote Access (Beta)**: Added optional local server to view dashboard from other devices on the LAN.

### 🛠 Improvements

- **Settings Architecture**: modularized settings into separate mixins (Accounts, Categories, Backup) for better maintainability.
- **Navigation**: Improved routing stability and "active" state handling across views.
- **Forecasting**: Enhanced projection algorithms to include/exclude recurring charges dynamically.
- **Data Export**: Added ability to export specific transaction sets to CSV/Excel alongside full JSON backups.

### 🐛 Bug Fixes

- Fixed an issue where settings were not persisting correctly after restart.
- Resolved UI layout shifts in the Bento Grid components.
- Fixed currency conversion rate sync reliability.

---

## [1.0.0] - Initial Release

- Core features: Transaction logging, Categories, Budgets, and Local-first Database.
