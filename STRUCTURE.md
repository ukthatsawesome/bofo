# Bofo Project Structure

This document describes the organized structure of the Bofo application.

## Directory Tree

```
Bofo/
├── assets/                          # Static assets
│   ├── icons/
│   │   └── icon.png                 # App icon
│   └── images/                      # Other images
│
├── src/
│   ├── database/                    # Database layer
│   │   ├── db.js                    # SQLCipher connection & encryption
│   │   ├── helpers.ts               # Type-safe database helpers
│   │   ├── encryption.js            # Key management & cryptography
│   │   └── schema.sql               # Database schema
│   │
│   ├── main/                        # Electron Main Process
│   │   ├── main.js                  # Main process entry point
│   │   ├── preload.js               # Preload script for IPC
│   │   └── ipc/
│   │       └── handlers.js          # IPC handler registration
│   │
│   ├── models/                      # Data Models / Business Logic
│   │   └── finance.js               # Finance CRUD operations
│   │
│   ├── services/                    # Backend Services (TypeScript)
│   │   ├── aiService.ts             # Ollama AI integration
│   │   ├── currencyService.ts       # Exchange rate API integration
│   │   └── financeService.js        # Finance calculations
│   │
│   ├── shared/                      # Shared between main/renderer (TypeScript)
│   │   ├── constants.ts             # App-wide constants
│   │   └── currencies.ts            # Currency definitions
│   │
│   ├── utils/                       # Backend Utilities (TypeScript)
│   │   └── forecast.ts              # Forecasting algorithms
│   │
│   └── renderer/                    # Electron Renderer Process (UI)
│       ├── index.html               # App shell (~77 lines)
│       ├── renderer.js              # Renderer entry point
│       ├── tailwind-input.css       # Tailwind source (ALL styles)
│       ├── tailwind.css             # Generated CSS output
│       │
│       ├── core/                    # Core Application Modules
│       │   ├── app.js               # Main App class & orchestration
│       │   ├── router.js            # View navigation
│       │   ├── state.js             # State management
│       │   ├── eventBus.js          # Pub/sub event system
│       │   ├── formatter.js         # Currency/date formatting
│       │   ├── dom.js               # DOM utilities
│       │   └── utils.js             # General utilities
│       │
│       ├── components/              # Reusable UI Components
│       │   ├── common/              # General purpose components
│       │   │   ├── Badge.js
│       │   │   ├── BudgetCard.js
│       │   │   ├── Button.js
│       │   │   ├── Card.js
│       │   │   ├── EmptyState.js
│       │   │   ├── FeedbackItem.js
│       │   │   ├── FormGroup.js     # Includes Input, Select, Textarea
│       │   │   ├── GridCard.js
│       │   │   ├── InsightCard.js
│       │   │   ├── ListItem.js
│       │   │   ├── Modal.js
│       │   │   ├── Pagination.js
│       │   │   ├── ProgressBar.js
│       │   │   ├── SegmentedControl.js
│       │   │   ├── StatCard.js
│       │   │   ├── StatusBadge.js
│       │   │   └── TypePill.js
│       │   │
│       │   ├── charts/              # Chart-related components
│       │   │   ├── ChartManager.js
│       │   │   └── chartConfigs.js
│       │   │
│       │   ├── tables/              # Table components
│       │   │   ├── DataTable.js
│       │   │   ├── SortableHeader.js
│       │   │   └── TransactionRow.js
│       │   │
│       │   └── notifications/       # Notification system
│       │       └── NotificationManager.js
│       │
│       ├── views/                   # Page-level Views
│       │   ├── BaseView.js          # Base class for all views
│       │   ├── DashboardView.js     # Main dashboard
│       │   ├── TransactionsView.js  # Transaction history
│       │   ├── ForecastView.js      # Financial forecasting
│       │   ├── BudgetView.js        # Budget management
│       │   ├── SandboxView.js       # What-if scenarios
│       │   └── SettingsView.js      # App settings
│       │
│       ├── modals/                  # Modal Dialogs
│       │   ├── AccountModal.js
│       │   ├── BudgetModal.js
│       │   ├── CategoryModal.js
│       │   ├── SandboxModal.js
│       │   └── TransactionModal.js
│       │
│       └── lib/                     # External Libraries
│           └── chart.umd.js         # Chart.js
│
├── tailwind.config.js               # Tailwind configuration
├── package.json                     # NPM dependencies & scripts
└── finance.db                       # SQLite database (generated)
```

## CSS Architecture

All styles are consolidated into a **single source file**: `tailwind-input.css`

### What's in `tailwind-input.css`

| Section | Description |
|---------|-------------|
| **CSS Variables** | Theme tokens (colors, shadows, radii) for dark/light modes |
| **Base Styles** | Reset, body, headings, select arrows |
| **Layout** | App container, sidebar, content, views, stats grid |
| **Button Variants** | `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-text`, `.btn-sm` |
| **Card Variants** | `.card-glass`, `.card-panel`, `.card`, `.stat-card`, `.stat-card-tw` |
| **Form Elements** | `.input-field`, `.select-field`, `.form-group` |
| **Modal** | `.modal`, `.modal-content`, `.close` |
| **Tables** | `.data-table`, `.data-table-tw`, `.action-btn` |
| **Badges** | `.badge`, `.badge-success`, `.badge-danger`, `.badge-warning` |
| **View Specific** | Dashboard grid, settings menu, transactions filter |
| **Animations** | `slideIn`, `modalSlideUp`, `pulseSoft`, `spin` |

### Benefits

- **Single Source of Truth**: All styles in one file
- **Theme Support**: Dark/light modes via CSS variables
- **Tailwind Utilities**: Full access to Tailwind's utility classes
- **Custom Components**: Reusable component classes
- **No CSS Imports**: Just `tailwind.css` in HTML

### How Theming Works

```css
/* Dark theme (default) */
:root {
    --bg-dark: #0b0b10;
    --text-main: #f0f0f5;
    /* ... */
}

/* Light theme (via data attribute) */
[data-theme="light"] {
    --bg-dark: #f5f7ff;
    --text-main: #1a1a2e;
    /* ... */
}
```

Apply with: `document.documentElement.setAttribute('data-theme', 'light')`

## Architecture Overview

### Main Process (TypeScript/Node.js)
- **main.js**: Creates browser window, registers IPC handlers
- **preload.js**: Exposes safe APIs to renderer via contextBridge
- **ipc/handlers.js**: Centralizes all IPC handler registration
- **Core Logic**: TypeScript-powered services and utilities for type-safety

### Renderer Process (UI)
- **core/**: Application foundation (state, routing, events)
- **components/**: Reusable UI building blocks (Tailwind-styled)
- **views/**: Full-page views that compose components
- **modals/**: Modal dialogs for forms and confirmations

## Key Design Patterns

1. **ES Modules**: All JS files use import/export
2. **Component Functions**: UI pieces return HTML strings with Tailwind classes
3. **View Classes**: Extend BaseView for lifecycle management
4. **Event Bus**: Decoupled communication between modules
5. **State Manager**: Centralized application state
6. **Tailwind First**: All styling uses Tailwind utilities + custom components

## NPM Scripts

```bash
# Development
npm start       # Build CSS + start Electron
npm run dev     # Watch CSS + start Electron (development)
npm run build:css   # Build Tailwind CSS once
npm run watch:css   # Watch and rebuild CSS on changes

# Distribution (Production Builds)
npm run pack        # Create unpacked build (for testing)
npm run dist        # Create distributable for current platform
npm run dist:win    # Create Windows installer (.exe)
npm run dist:mac    # Create macOS installer (.dmg)
npm run dist:linux  # Create Linux installer (.AppImage, .deb)
```

## File Sizes

| File | Size | Notes |
|------|------|-------|
| `tailwind-input.css` | ~27 KB | Source (all custom styles) |
| `tailwind.css` | ~55 KB | Generated (includes Tailwind utilities) |
| `index.html` | ~3 KB | Minimal shell |
| Total JS Components | ~50 KB | All 17 component files |
