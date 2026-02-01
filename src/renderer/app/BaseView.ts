import type { App } from './App';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Represents an event listener that is tracked for automatic cleanup.
 */
interface TrackedListener {
  element: Element | Window | Document;
  type: string;
  handler: EventListener;
}

// ---------------------------------------------------------------------------
// Base View Class
// ---------------------------------------------------------------------------

/**
 * Base View class that all views inherit from.
 * Handles lifecycle, event listener cleanup, and common rendering utilities.
 */
export class BaseView {
  protected app: App;
  protected id: string;
  protected element: HTMLElement | null;
  protected isInitialized: boolean = false;
  protected listeners: TrackedListener[] = [];

  constructor(app: App, elementId: string) {
    this.app = app;
    this.id = elementId;
    this.element = document.getElementById(elementId);
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  get state() {
    return this.app.state;
  }

  get formatter() {
    return this.app.formatter;
  }

  get chartManager() {
    return this.app.chartManager;
  }

  // ---------------------------------------------------------------------------
  // Event Management
  // ---------------------------------------------------------------------------

  /**
   * Add an event listener that will be automatically cleaned up on hide/destroy.
   */
  addListener(
    element: Element | Window | Document | null,
    type: string,
    handler: EventListener
  ): void {
    if (!element) return;

    element.addEventListener(type, handler);
    this.listeners.push({ element, type, handler });
  }

  /**
   * Remove all tracked event listeners to prevent memory leaks.
   */
  removeAllListeners(): void {
    for (const { element, type, handler } of this.listeners) {
      element.removeEventListener(type, handler);
    }
    this.listeners = [];
  }

  // ---------------------------------------------------------------------------
  // Lifecycle Methods
  // ---------------------------------------------------------------------------

  /**
   * Activates the view: adds the active class and triggers the render cycle.
   */
  show(): void {
    if (this.element) {
      this.element.classList.add('active');
      // Catch errors in render to prevent app crash if a specific view fails to load
      this.onShow().catch(err =>
        console.error(`[BaseView] Error showing view "${this.id}":`, err)
      );
    }
  }

  /**
   * Deactivates the view and cleans up event listeners.
   */
  hide(): void {
    if (this.element) {
      this.element.classList.remove('active');
    }
    // Clean up listeners when hiding to prevent memory leaks
    this.removeAllListeners();
  }

  /**
   * Destroys the view completely.
   * Clears DOM, listeners, and resets initialization state.
   */
  destroy(): void {
    this.removeAllListeners();
    if (this.element) {
      this.element.innerHTML = '';
    }
    this.isInitialized = false;
  }

  /**
   * Lifecycle hook called when the view is shown.
   * By default, triggers the render method.
   */
  async onShow(): Promise<void> {
    await this.render();
  }

  /**
   * Main render method to be overridden by subclasses.
   */
  async render(): Promise<void> {
    // To be overridden
  }

  // ---------------------------------------------------------------------------
  // Helper Methods
  // ---------------------------------------------------------------------------

  /**
   * Helper to set inner text of an element by ID.
   */
  setText(id: string, text: string): void {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
  }

  /**
   * Helper to set inner HTML of an element by ID.
   */
  setHTML(id: string, html: string): void {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  /**
   * Refresh Lucide icons within a specific container or the entire view.
   * 
   * @param container - Optional CSS selector string or HTMLElement to restrict icon refresh.
   */
  refreshIcons(container?: string | HTMLElement): void {
    const lucide = (window as any).lucide;
    if (!lucide) return;

    // Determine the root element to refresh icons in
    let target: HTMLElement | null = null;

    if (!container) {
      target = this.element;
    } else if (typeof container === 'string') {
      target = document.querySelector(container) as HTMLElement;
    } else {
      target = container;
    }

    if (target) {
      lucide.createIcons({ root: target });
    }
  }
}