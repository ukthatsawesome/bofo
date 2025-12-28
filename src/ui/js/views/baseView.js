class BaseView {
    constructor(app, elementId) {
        this.app = app;
        this.id = elementId;
        this.element = document.getElementById(elementId);
    }

    get state() { return this.app.state; }
    get formatter() { return this.app.formatter; }
    get chartManager() { return this.app.chartManager; }

    show() {
        if (this.element) {
            this.element.classList.add('active');
            this.onShow();
        }
    }

    hide() {
        if (this.element) {
            this.element.classList.remove('active');
        }
    }

    onShow() {
        // To be overridden by subclasses
        this.render();
    }

    async render() {
        // To be overridden by subclasses
    }

    setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    }

    setHTML(id, html) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    }

    refreshIcons() {
        UIUtils.refreshIcons();
    }
}

window.BaseView = BaseView;
