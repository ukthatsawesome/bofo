# 👩‍💻 Bofo Developer Guide

Welcome to the Bofo codebase! This guide will help you understand the architecture and how to add new features.

## 🏗️ Architecture Overview

Bofo uses a **Main-Renderer** architecture typical of Electron apps, but with a strict separation of concerns:

- **Frontend (Renderer Process)**:
  - Located in `src/renderer/`
  - **Feature-Based Architecture**: Code is co-located by domain in `src/renderer/features/`.
  - **App Core**: `src/renderer/app/` handles initialization (`main.ts`), global styles, and Routing (`router.ts`).
  - **State Management**: managed by `StateManager` in `src/renderer/lib/state`.
  - **API Layer**: `FinanceService` in `src/renderer/lib/api` bridges UI and Backend.
  - **Components**: Shared UI atoms (Buttons, Cards) live in `src/renderer/components/ui/`.
  - **View Architecture**:
    - Views extend `BaseView` (from `app/BaseView.ts`).
    - Complex logic is split into helper classes or mixins within the feature folder.

- **Backend (Main Process)**:
  - Located in `src/main/`
  - `database/`: Database initialization, encryption, and migrations.
  - `ipc/`: Inter-Process Communication handlers for frontend requests.
  - `models/`: Data Access Objects (DAO) and business logic for specific entities.
  - `scripts/`: Development utilities (e.g., `seed.ts` for populating test data).
  - `services/`: External integrations (AI, Exchange Rates, etc.) and `anomalyService.ts`.
  - `utils/`: shared utility functions for the main process.
  - `main.ts`: Entry point for the Electron application.
  - `preload.ts`: Secure bridge between Main and Renderer processes.
  - `webServer.ts`: Optional local web server for remote access feature.
  - **Node.js Environment**: Full access to file system, database, and OS APIs.
  - **Database**: SQLCipher (SQLite with encryption) via `src/main/database/`.
  - **IPC**: Handlers in `src/main/ipc/` receive requests from the frontend.
  - **Services**: `aiService`, `currencyService`, `financeService`, and `anomalyService` encapsulate complex business logic.

- **Shared**:
  - `src/shared/`: Types and constants shared between both processes.

## 🎨 CSS Architecture

The project uses **Tailwind CSS** with a **Soft UI** design system in `src/renderer/app/styles/tailwind-input.css`.

| Layer | Description |
|-------|-------------|
| **Design Tokens** | CSS variables in `:root` for colors, shadows, spacing, radii |
| **Components** | Reusable classes: `.btn-*`, `.card`, `.badge-*`, `.stat-card` |
| **Bento Grid** | Layout system: `.bento-grid`, `.bento-1` to `.bento-12` |
| **Utilities** | Standard Tailwind utilities |

### Design Principles
- **Bento Layouts**: CSS Grid-based responsive layouts
- **Dark Mode Scaffolding**: Support for `.dark` class is implemented via CSS variables, but full UI theme is in progress.

### Component Variants
| Component | Variants |
|-----------|----------|
| Card | `default`, `panel`, `flat` |
| Button | `primary`, `secondary`, `danger`, `text` |
| Badge | `success`, `danger`, `warning`, `info` |

### Usage
- Edit `tailwind-input.css` for global styles or reusable components.
- Use Tailwind utility classes directly in your HTML/TypeScript files.
- **Theming**: CSS variables in `:root` define the light theme.

## 🔌 Adding a New Feature

### 1. Define the Data Model
If your feature needs database storage:
1.  Add a migration in `src/main/database/migrations/` (handled via code in `db.ts` currently, or schema updates).
2.  Update `src/database/types.ts` (shared types).
3.  Add the model logic to `src/main/models/finance.ts`. Use the generic `FinanceModel` CRUD helpers if possible.

### 2. Create the IPC Handler
Expose your data to the frontend:
1.  Go to `src/main/ipc/handlers.ts`.
2.  Add a route to `SIMPLE_ROUTES` (for basic CRUD) or register a new `ipcMain.handle` (for complex logic).
3.  **Security Note**: Always validate inputs.

### 3. Expose via Preload
1.  Go to `src/main/preload.ts`.
2.  Add a function to the `api` object.
3.  Update the `Window` interface in `src/renderer/types.ts` (or `renderer/renderer.ts`) to include the new API signature.

### 4. Build the UI
1.  Create a Feature folder in `src/renderer/features/` (e.g., `myfeature/`).
2.  Create the View class (e.g., `MyFeatureView.ts`) inheriting from `BaseView`.
3.  **Components**: If the feature needs specific modals or components, create them inside `features/myfeature/components` or `modals`.
4.  **Shared UI**: Use generic components from `src/renderer/components/ui/` (e.g. `Button`, `Card`).
5.  Register the route in `src/renderer/app/router.ts`.

## 🧪 Testing & Quality
- **Unit Testing**: Run `npm run test` to execute Vitest suites.
- **UI Testing**: Run `npm run test:ui` for the visual Vitest dashboard.
- **Linting**: Run `npm run lint` to check code style.
- **Formatting**: Run `npm run format` to apply Prettier rules.
- **Type Checking**: Run `npm run typecheck` to verify TypeScript types.
- **Build**: Run `npm run build` to ensure the build pipeline succeeds.

## 🤝 Contribution Guidelines

### Coding Standards
- **Clean Code**: Follow industry best practices. Create minimal, efficient, and readable code.
- **Type Safety**:
    - **No `any`**: Use specific interfaces (e.g., `TransactionPayload`, `TransactionFilter`) from `src/shared/types.ts`.
    - **DOM Types**: Do not unsafe cast. Use `UIUtils.getInputValue('#id')` instead of `(document.getElementById('id') as ...).value`.
- **Modular Design**: Prefer small, single-responsibility files (Mixins, Components, Dedicated Views).
- **Async/Await**: Use async/await for all asynchronous operations.

### Accessibility (A11y) Standards
- **Modals**: Must include `role="dialog"`, `aria-modal="true"`, and manage focus. (Handled by `Modal` component and `App.ts` Focus Trap).
- **Forms**: Use `FormGroup` to ensure every input has a matching `for/id` label association.
- **Keyboard**: Ensure all interactive elements are reachable via Tab and activatable via Enter/Space. Modals must close on Escape.

### Performance Guidelines
- **Pagination**: Never request "all" records (e.g., `getTransactions()`). Always pass `{ limit, offset }`.
- **Cleanup**: Views must implement `destroy()` to remove event listeners and destroy Chart instances using `this.app.chartManager.destroyChart()`.
- **Listeners**: Use `this.addListener(el, 'click', fn)` in `BaseView` subclasses to ensure automatic cleanup.

### UI/UX Standards
- **Soft UI Design**: Maintain clean, light surfaces with subtle shadows.
- **Performance**: Ensure smooth animations (60fps) and minimal main-thread blocking.

## 📖 Related Documents
- [README.md](README.md)
- [DIRECTORY_STRUCTURE.md](DIRECTORY_STRUCTURE.md)
- [SECURITY.md](SECURITY.md)
