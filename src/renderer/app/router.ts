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
    links.forEach((link) => {
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
  async navigate(viewName: string, options: { force?: boolean } = {}): Promise<void> {
    const { force = false } = options;

    // Clear AI nav active state when navigating to any view
    const aiNavItem = document.getElementById('ai-status-nav');
    if (aiNavItem) {
      aiNavItem.classList.remove('active');
    }

    // Get current instantiated view if it exists
    const currentViewInstance = this.currentView ? this.views[this.currentView] : null;

    // If navigating to same view
    if (this.currentView === viewName) {
      if (force && currentViewInstance && currentViewInstance.showHome) {
        currentViewInstance.showHome();
        this.updateSidebar(viewName);
      }
      return;
    }

    // Show loading state
    if (this.app.setLoading) {
      this.app.setLoading(true);
    }

    try {
      // Lazy load the requested view
      const view = await this.app.getView(viewName);

      // Hide current view
      if (currentViewInstance) {
        currentViewInstance.hide();
        // Strict lifestyle management: destroy to free memory
        if (typeof currentViewInstance.destroy === 'function') {
          currentViewInstance.destroy();
        }
      }

      // Show new view
      view.show();
      this.currentView = viewName;
      this.updateSidebar(viewName);
    } catch (error) {
      console.error(`Failed to navigate to ${viewName}`, error);
      // Optional: show error toast
    } finally {
      if (this.app.setLoading) {
        this.app.setLoading(false);
      }
    }
  }

  /**
   * Update sidebar active state
   */
  updateSidebar(viewName: string): void {
    const links = document.querySelectorAll('.nav-links li');
    links.forEach((li) => {
      li.classList.remove('active');
      if (li.getAttribute('data-view') === viewName) {
        li.classList.add('active');
      }
    });
  }
}
