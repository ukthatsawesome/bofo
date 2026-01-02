/**
 * Navigation Router for managing view switching
 */
export class Router {
    constructor(app) {
        this.app = app;
        this.views = app.views;
        this.currentView = null;
        this.setupListeners();
    }

    setupListeners() {
        // Handle sidebar clicks
        document.querySelectorAll('.nav-links li').forEach(link => {
            link.addEventListener('click', () => {
                const viewName = link.getAttribute('data-view');
                if (viewName) {
                    this.navigate(viewName, { force: true });
                }
            });
        });
    }

    /**
     * Navigate to a specific view
     * @param {string} viewName 
     * @param {object} options - { force: boolean } to force navigation even if same view
     */
    navigate(viewName, options = {}) {
        const { force = false } = options;

        // Clear AI nav active state when navigating to any view
        const aiNavItem = document.getElementById('ai-status-nav');
        if (aiNavItem) {
            aiNavItem.classList.remove('active');
        }

        // If navigating to same view and force is true, reset the view (go to home)
        if (this.currentView === viewName) {
            if (force && this.views[viewName] && this.views[viewName].showHome) {
                this.views[viewName].showHome();
                this.updateSidebar(viewName);
            }
            return;
        }

        // Hide current view
        if (this.currentView && this.views[this.currentView]) {
            this.views[this.currentView].hide();
        }

        // Show new view
        if (this.views[viewName]) {
            this.views[viewName].show();
            this.currentView = viewName;
            this.updateSidebar(viewName);
        } else {
            console.error(`View ${viewName} not found`);
        }
    }

    /**
     * Update sidebar active state
     * @param {string} viewName 
     */
    updateSidebar(viewName) {
        document.querySelectorAll('.nav-links li').forEach(li => {
            li.classList.remove('active');
            if (li.getAttribute('data-view') === viewName) {
                li.classList.add('active');
            }
        });
    }
}
