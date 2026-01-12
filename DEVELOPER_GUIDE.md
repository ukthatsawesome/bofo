# 👩‍💻 Bofo Developer Guide

Welcome to the Bofo codebase! This guide will help you understand the architecture and how to add new features.

## 🏗️ Architecture Overview

Bofo uses a **Main-Renderer** architecture typical of Electron apps, but with a strict separation of concerns:

- **Frontend (Renderer Process)**:
  - Located in `src/renderer/`
  - Built with Vanilla TypeScript + DOM (no heavy framework like React/Vue).
  - Uses `window.api` (via ContextBridge) to communicate with the backend.
  - **State Management**: Simple observable state in `src/renderer/core/state.ts`.
  - **Routing**: Hashtag-based router in `src/renderer/core/router.ts`.

- **Backend (Main Process)**:
  - Located in `src/main/`
  - **Node.js Environment**: Full access to file system, database, and OS APIs.
  - **Database**: SQLCipher (SQLite with encryption) via `src/main/database/`.
  - **IPC**: Handlers in `src/main/ipc/` receive requests from the frontend.
  - **Services**: `aiService` and `currencyService` encapsulate complex business logic.

- **Shared**:
  - `src/shared/`: Types and constants shared between both processes.

## 🎨 CSS Architecture

The project uses **Tailwind CSS** with a single custom input file: `src/renderer/tailwind-input.css`.

| Section | Description |
|---------|-------------|
| **CSS Variables** | Theme tokens (colors, shadows, radii) for dark/light modes |
| **Components** | Custom classes like `.btn-primary`, `.card`, `.badge` composed with `@apply` |
| **Utilities** | Standard Tailwind utilities (`flex`, `p-4`, `text-center`) |

### Usage
- Edit `tailwind-input.css` for global styles or reusable components.
- Use Tailwind utility classes directly in your HTML/TypeScript files.
- **Theming**: Handled via CSS variables (e.g., `--bg-dark`) that switch based on `data-theme="light|dark"`.

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
1.  Create a View in `src/renderer/views/` (e.g., `MyNewView.ts`) inheriting from `BaseView`.
2.  Add HTML template and logic.
3.  Register the route in `src/renderer/core/router.ts`.

## 🧪 Testing
- Run `npm run typecheck` to verify TypeScript types.
- Run `npm run build` to ensure the build pipeline succeeds.

## 🤝 Contribution Guidelines
- **Type Safety**: Avoid `any`. Define interfaces in `src/shared/types.ts` or local files.
- **Async/Await**: Use async/await for all asynchronous operations.
- **Comments**: Document complex logic, especially in the AI and Calculation engines.
