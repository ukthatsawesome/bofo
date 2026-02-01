# 📂 Bofo Directory Structure

This document provides a detailed overview of the Bofo project structure.

## 🏗️ Root Directory

| Name | Description |
|------|-------------|
| `.agent/` | Agent-specific configurations, workflows, and artifacts |
| `.vscode/` | VS Code settings and extensions |
| `assets/` | Static assets (icons, images, templates) |
| `dist/` | Compiled production files (Main & Renderer) |
| `node_modules/` | Project dependencies |
| `src/` | **Primary Source Code** |
| `.gitignore` | Git ignore rules |
| `finance.db` | Local development database (SQLite/SQLCipher) |
| `package.json` | Project metadata and dependencies |
| `README.md` | General project overview |
| `tsconfig.json` | TypeScript configuration |
| `vite.config.ts` | Vite configuration for the renderer process |

---

## 💻 Source Code (`src/`)

### 🧠 Main Process (`src/main/`)
The "Backend" of the application, running in a Node.js environment.

- `database/`: Database initialization, encryption, and migrations.
- `ipc/`: Inter-Process Communication handlers for frontend requests.
- `models/`: Data Access Objects (DAO) and business logic for specific entities.
- `scripts/`: Development utilities (`seed.ts` for populating test data).
- `services/`: External integrations (AI, Exchange Rates, etc.) and `anomalyService.ts`.
- `utils/`: shared utility functions for the main process.
- `main.ts`: Entry point for the Electron application.
- `preload.ts`: Secure bridge between Main and Renderer processes.
- `webServer.ts`: Optional local web server for remote access feature.

### 🎨 Renderer Process (`src/renderer/`)
The "Frontend" of the application, now organized by feature (Domain-Driven Design).

- `app/`: Application bootstrapping, core routing, and global styles.
- `features/`: **Feature Logic**. Each folder contains Views and Modals for that domain.
  - `dashboard/`: Dashboard view, Forecast view, and widgets.
  - `transactions/`: Transaction list view, filtering, and `TransactionModal`.
  - `budget/`: Budget management and modals.
  - `bills/`: Bill tracking, recurring charges, and usage readings.
  - `goals/`: Savings goals.
  - `settings/`: Application settings (Accounts, Categories, AI, Backup, etc.).
  - `sandbox/`: Scenario planning.
- `components/`: Shared UI elements.
  - `ui/`: Reusable "dumb" components (Buttons, Cards, Forms, Badges).
  - `charts/`: Chart.js wrappers and configs.
  - `layout/`: Layout components (ViewHeader, Sidebar).
- `lib/`: Business logic and utilities.
  - `api/`: API services (`FinanceService`).
  - `state/`: State management (`StateManager`).
  - `eventBus.ts`: Application-wide event emitter.
  - `dom.ts`, `formatters.ts`, `types.ts`: DOM helpers and data formatting.

### ♻️ Shared (`src/shared/`)
Code and types shared between Main and Renderer processes.

- `types.ts`: Common interfaces and enums used across the whole app.
- `constants.ts`: Shared configuration values and constants.

---

## 🛠️ Artifacts & Documentation

| File | Purpose |
|------|---------|
| `DEVELOPER_GUIDE.md` | Detailed guide for setting up and contributing |
| `SECURITY.md` | Security implementation details and best practices |
| `FIX_REPORT.md` | Log of historical bug fixes and technical debt resolution |
| `ARCHITECTURE_PROPOSAL.md` | (.agent/) Planned architectural changes |
| `GUIDELINES.md` | (.agent/) Coding standards and workflow rules |
| `plan.md` | (.agent/) Development roadmap and task tracking |
