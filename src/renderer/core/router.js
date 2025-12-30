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
                    this.navigate(viewName);
                }
            });
        });
    }

    /**
     * Navigate to a specific view
     * @param {string} viewName 
     */
    navigate(viewName) {
        if (this.currentView === viewName) return;

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
