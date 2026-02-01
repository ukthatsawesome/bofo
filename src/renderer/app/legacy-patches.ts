import { createIcons, icons } from 'lucide';
import Chart from 'chart.js/auto';
import { App } from './App';
import type { Lucide } from '../lib/types';
import { api } from '../lib/api';

// Declare globals for legacy patches
declare global {
    interface Window {
        app: App;
        Chart: any;
        lucide: Lucide;
        // Legacy bridges
        showSettingsSubView: (id: string) => void;
        showSettingsHome: () => void;
        updateAppSetting: (key: string, val: string) => void;
        filterCategoryTable: (type: string) => void;
        handleAddNewCategory: () => void;
    }
}

/**
 * Installs legacy compatibility patches and globals.
 * usage: installLegacyPatches(app);
 */
export function installLegacyPatches(app: App) {
    // Legacy compatibility: ensure window.api refers to our service
    // This keeps all existing views working without finding/replacing every usage.
    // In Electron, window.api is read-only (ContextBridge), so we don't overwrite it if it exists.
    if (!window.api) {
        (window as any).api = api;
    }

    // Expose globals for compatibility
    window.Chart = Chart;
    window.lucide = { createIcons, icons };

    // Patch createIcons to default to using all icons if not specified
    const originalCreateIcons = createIcons;
    window.lucide.createIcons = (options: any) => {
        return originalCreateIcons({ icons, ...options });
    };

    window.app = app; // Expose to window for legacy HTML event handlers if needed

    // Helper bridges for static HTML onclick handlers (if any remain)
    window.showSettingsSubView = (id: string) => (app.views.settings as any).showSubView?.(id);
    // Removed showSettingsHome as it's likely handled by routing
    window.updateAppSetting = (key: string, val: string) => app.updateAppSetting(key, val);
    // Removed filterCategoryTable & handleAddNewCategory as they are handled in SettingsView internally or via app.views.settings
}
