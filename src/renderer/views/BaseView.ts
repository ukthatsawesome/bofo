import type { App } from '../core/app';

/**
 * Base View class that all views inherit from
 */
export class BaseView {
  protected app: App;
  protected id: string;
  protected element: HTMLElement | null;
  protected isInitialized: boolean = false;

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
