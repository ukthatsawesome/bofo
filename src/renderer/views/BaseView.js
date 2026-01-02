/**
 * Base View class that all views inherit from
 */
export class BaseView {
    constructor(app, elementId) {
        this.app = app;
        this.id = elementId;
        this.element = document.getElementById(elementId);
    }

    get state() { return this.app.state; }
    get formatter() { return this.app.formatter; }
    get chartManager() { return this.app.chartManager; }

    /**
     * Show the view
     */
    show() {
        if (this.element) {
            this.element.classList.add('active');
            this.onShow();
        }
    }

    /**
     * Hide the view
     */
    hide() {
        if (this.element) {
            this.element.classList.remove('active');
        }
    }

    /**
     * Lifecycle hook called when view is shown
     */
    onShow() {
        this.render();
    }

    /**
     * Main render method to be overridden by subclasses
     */
    async render() {
        // To be overridden
    }

    /**
     * Helper to set inner text of an element
     */
    setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    }

    /**
     * Helper to set inner HTML of an element
     */
    setHTML(id, html) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    }

    /**
     * Refresh Lucide icons in this view or a specific container
     * @param {string|HTMLElement} container - Optional container to restrict icon refresh
     */
    refreshIcons(container) {
        if (window.lucide) {
            const target = container
                ? (typeof container === 'string' ? document.querySelector(container) : container)
                : this.element;

            if (target) {
                window.lucide.createIcons({
                    root: target
                });
            }
        }
    }
}
