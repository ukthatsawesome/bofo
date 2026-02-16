# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-02-16

### 🚀 New Features
- **Database Seeding**: Dev tool to populate database with demo data for testing via `window.api.seedDatabase()`.

### 🛡️ Security (v1.1.2 Audit)
- **Dependency Update**: Replaced `xlsx` package with `exceljs` to address CVE-2024-22363 (prototype pollution vulnerability).
- **Content Security Policy**: Hardened CSP headers with stricter `script-src` and removed unsafe patterns.
- **Web Server Security**: Default binding changed from `0.0.0.0` to `localhost` (127.0.0.1). External access requires explicit opt-in.
- **Debug Log Cleanup**: Removed debug console.log statements from production code paths.

### 🏛️ Architecture & Quality
- **Type Safety**: Strictly typed IPC payloads with `TransactionFilter`, `TransactionPayload`, etc. Removed `any` usage in `preload.ts` and `financeService.ts`.
- **Accessibility (A11y)**:
    - Added `role="dialog"` and `aria-modal="true"` to all modals.
    - Implemented global **Focus Trap** to cycle focus within active modals (Tab/Shift+Tab).
    - Standardized forms with accessible `FormGroup` components (explicit label association).
- **DOM Safety**: Introduced `UIUtils.getInputValue()` helper to safely cast DOM elements without unsafe type assertions.
- **Domain-Driven Architecture**:
    - Refactored `src/renderer` into `app`, `features`, `components`, and `lib`.
    - Moved all Views to their respective `features/` directories.
    - Centralized core logic in `lib/` (`state`, `api`, `dom`).
    - Decoupled `window.api` calls into `FinanceService`.

### ⚡ Performance
- **Smart Startup**: Database initialization now skips schema execution on already-initialized databases (improved from ~5s to ~6ms on subsequent launches).
- **Memory Optimization**: Fixed critical bug in transaction loader that ignored pagination options. Now correctly defaults to fetching only 100 items.
- **Chart Cleanup**: Implemented automatic chart instance destruction in `ChartManager` to prevent canvas memory leaks.

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
