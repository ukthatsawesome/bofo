# TypeScript Migration TODO

This list tracks the remaining files and directories to be migrated from JavaScript to TypeScript.

## Core & Data Layer
- [ ] `src/models/finance.js` (High priority - contains most business logic)
- [ ] `src/database/db.js` (Database initialization and migrations)
- [ ] `src/database/helpers.js` (Cleanup redundant JS file if it still exists)
- [ ] `src/services/financeService.js` (Orchestrates model calls)

## Main Process
- [ ] `src/main/main.js`
- [ ] `src/main/preload.js`
- [ ] `src/main/ipc/handlers.js`

## Renderer Process
- [ ] `src/renderer/renderer.js` (Entry point)
- [ ] `src/renderer/core/` (Event bus, theme manager, etc.)
- [ ] `src/renderer/lib/`
- [ ] `src/renderer/components/` (28+ components)
- [ ] `src/renderer/views/` (10 views)
- [ ] `src/renderer/modals/` (7 modals)

## Infrastructure
- [ ] Update build process to strictly enforce types for CI/CD.
- [ ] Remove `allowJs` from `tsconfig.json` once migration is 100% complete.
