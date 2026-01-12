/**
 * BOFO - Personal Finance Manager
 * Main Entry Point
 */
import './tailwind-input.css';
import { createIcons, icons } from 'lucide';
import Chart from 'chart.js/auto';
import { App } from './core/app.js';

// Expose globals for compatibility
window.Chart = Chart;
window.lucide = { createIcons, icons };

// Patch createIcons to default to using all icons if not specified
const originalCreateIcons = createIcons;
window.lucide.createIcons = (options) => {
    return originalCreateIcons({ icons, ...options });
};

let app;

document.addEventListener('DOMContentLoaded', async () => {
    app = new App();
    window.app = app; // Expose to window for legacy HTML event handlers if needed
    await app.init();
});

// Helper bridges for static HTML onclick handlers (if any remain)
window.showSettingsSubView = (id) => app.showSettingsSubView(id);
window.showSettingsHome = () => app.showSettingsHome();
window.updateAppSetting = (key, val) => app.updateAppSetting(key, val);
window.filterCategoryTable = (type) => app.filterCategoryTable(type);
window.handleAddNewCategory = () => app.handleAddNewCategory();
