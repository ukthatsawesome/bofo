/**
 * BOFO - Personal Finance Manager
 * Main Entry Point
 */

let app;

document.addEventListener('DOMContentLoaded', async () => {
    app = new App();
    window.app = app; // Expose to window for HTML event handlers
    await app.init();
});

// Helper bridges for static HTML onclick handlers
// These map old global functions to the new App class methods
window.showSettingsSubView = (id) => app.showSettingsSubView(id);
window.showSettingsHome = () => app.showSettingsHome();
window.updateAppSetting = (key, val) => app.updateAppSetting(key, val);
window.filterCategoryTable = (type) => app.filterCategoryTable(type);
window.handleAddNewCategory = () => app.handleAddNewCategory();