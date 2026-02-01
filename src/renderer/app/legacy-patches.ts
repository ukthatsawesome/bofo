import { createIcons, icons } from 'lucide';
import Chart from 'chart.js/auto';
import { App } from './App';
import type { Lucide } from '../lib/types';
import { api } from '../lib/api';

// ---------------------------------------------------------------------------
// Global Declarations
// ---------------------------------------------------------------------------

declare global {
    interface Window {
        app: App;
        Chart: typeof Chart;
        lucide: Lucide;


    }
}

// ---------------------------------------------------------------------------
// Legacy Patches
// ---------------------------------------------------------------------------

/**
 * Installs legacy compatibility patches and global objects.
 *
 * This ensures backward compatibility with:
 * 1. Inline HTML onclick handlers (window.app).
 * 2. Direct console/script access (window.Chart, window.lucide).
 */
export function installLegacyPatches(app: App): void {
    // 1. API Bridge
    // In Electron, window.api is provided by the ContextBridge.
    // We provide a fallback here if it's missing (e.g., for non-Electron debugging).
    if (!window.api) {
        (window as any).api = api;
    }

    // 2. Library Exposures
    window.Chart = Chart;
    window.lucide = { createIcons, icons };

    // Patch lucide.createIcons to automatically include the icons map
    // This allows calling window.lucide.createIcons() with minimal arguments
    const originalCreateIcons = createIcons;
    window.lucide.createIcons = (options: any) => {
        return originalCreateIcons({ icons, ...options });
    };

    // 3. App Instance
    window.app = app;


}