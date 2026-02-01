/**
 * Navigation Router for managing view switching
 */
import type { App } from './App';
import type { BaseView } from './BaseView';

interface ViewWithHome {
  showHome(): void;
}

function isViewWithHome(view: unknown): view is ViewWithHome {
  return (
    typeof view === 'object' &&
    view !== null &&
    'showHome' in view &&
    typeof (view as { showHome: unknown }).showHome === 'function'
  );
}

export class Router {
  private app: App;
  private views: Record<string, BaseView>;
  private currentView: string | null;

  constructor(app: App) {
    this.app = app;
    this.views = app.views;
    this.currentView = null;
    this.setupListeners();
  }

  get currentViewName(): string | null {
    return this.currentView;
  }

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------

  setupListeners(): void {
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

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  /**
   * Navigate to a specific view.
   * Handles lazy loading, view destruction, and loading states.
   */
  async navigate(viewName: string, options: { force?: boolean } = {}): Promise<void> {
    const { force = false } = options;
    const currentViewInstance = this.currentView ? this.views[this.currentView] : null;

    // If navigating to same view (Refresh behavior)
    if (this.currentView === viewName) {
      if (force && currentViewInstance && isViewWithHome(currentViewInstance)) {
        currentViewInstance.showHome();
        this.updateSidebar(viewName);
      }
      return;
    }

    // Show loading state
    this.app.setLoading(true);

    try {
      // Lazy load the requested view
      const view = await this.app.getView(viewName);

      // Hide and destroy previous view
      if (currentViewInstance) {
        currentViewInstance.hide();

        // Cleanup memory for complex views
        if (typeof currentViewInstance.destroy === 'function') {
          currentViewInstance.destroy();
        }
      }

      // Show new view
      view.show();
      this.currentView = viewName;

      // Update Sidebar
      this.updateSidebar(viewName);
    } catch (error) {
      console.error(`Failed to navigate to ${viewName}`, error);
      this.app.notifications.toast(`Error`, `Failed to load view: ${viewName}. Please try again.`);
    } finally {
      this.app.setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // UI Updates
  // ---------------------------------------------------------------------------

  /**
   * Update sidebar active state based on current view name.
   * Automatically handles AI settings navigation via data-view attributes.
   */
  private updateSidebar(viewName: string): void {
    const links = document.querySelectorAll('.nav-links li');

    links.forEach((li) => {
      const targetView = li.getAttribute('data-view');

      if (targetView === viewName) {
        li.classList.add('active');
      } else {
        li.classList.remove('active');
      }
    });
  }
}