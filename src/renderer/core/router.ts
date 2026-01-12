/**
 * Navigation Router for managing view switching
 */
export class Router {
    private app: any;
    private views: Record<string, any>;
    private currentView: string | null;

    constructor(app: any) {
        this.app = app;
        this.views = app.views;
        this.currentView = null;
        this.setupListeners();
    }

    get currentViewName(): string | null {
        return this.currentView;
    }

    setupListeners(): void {
        // Handle sidebar clicks
        const links = document.querySelectorAll('.nav-links li');
        links.forEach(link => {
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
     */
    navigate(viewName: string, options: { force?: boolean } = {}): void {
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
     */
    updateSidebar(viewName: string): void {
        const links = document.querySelectorAll('.nav-links li');
        links.forEach(li => {
            li.classList.remove('active');
            if (li.getAttribute('data-view') === viewName) {
                li.classList.add('active');
            }
        });
    }
}
