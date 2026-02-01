import type { App } from './App';

/**
 * Tracked event listener for cleanup
 */
interface TrackedListener {
  element: Element | Window | Document;
  type: string;
  handler: EventListener;
}

/**
 * Base View class that all views inherit from
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

  get state() {
    return this.app.state;
  }
  get formatter() {
    return this.app.formatter;
  }
  get chartManager() {
    return this.app.chartManager;
  }

  /**
   * Add an event listener that will be automatically cleaned up on destroy
   */
  addListener(element: Element | Window | Document | null, type: string, handler: EventListener): void {
    if (!element) return;
    element.addEventListener(type, handler);
    this.listeners.push({ element, type, handler });
  }

  /**
   * Remove all tracked event listeners
   */
  removeAllListeners(): void {
    for (const { element, type, handler } of this.listeners) {
      element.removeEventListener(type, handler);
    }
    this.listeners = [];
  }

  /**
   * Show the view
   */
  show(): void {
    if (this.element) {
      this.element.classList.add('active');
      this.onShow();
    }
  }

  /**
   * Hide the view
   */
  hide(): void {
    if (this.element) {
      this.element.classList.remove('active');
    }
    // Clean up listeners when hiding to prevent memory leaks
    this.removeAllListeners();
  }

  /**
   * Destroy the view and clean up resources
   * This is called when the view is being removed or heavy cleanup is needed
   */
  destroy(): void {
    this.removeAllListeners();
    if (this.element) {
      this.element.innerHTML = '';
    }
    this.isInitialized = false;
  }

  /**
   * Lifecycle hook called when view is shown
   */
  onShow(): void | Promise<void> {
    this.render();
  }

  /**
   * Main render method to be overridden by subclasses
   */
  async render(): Promise<void> {
    // To be overridden
  }

  /**
   * Helper to set inner text of an element
   */
  setText(id: string, text: string): void {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
  }

  /**
   * Helper to set inner HTML of an element
   */
  setHTML(id: string, html: string): void {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  /**
   * Refresh Lucide icons in this view or a specific container
   * @param {string|HTMLElement} container - Optional container to restrict icon refresh
   */
  refreshIcons(container?: string | HTMLElement): void {
    if ((window as any).lucide) {
      const target = container
        ? typeof container === 'string'
          ? document.querySelector(container)
          : container
        : this.element;

      if (target) {
        (window as any).lucide.createIcons({
          root: target,
        });
      }
    }
  }
}
