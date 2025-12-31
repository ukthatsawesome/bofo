export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => document.querySelectorAll(selector);

export const UIUtils = {
    createElement(tag, className = '', innerHTML = '') {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (innerHTML) el.innerHTML = innerHTML;
        return el;
    },

    setHidden(selector, hidden) {
        const el = $(selector);
        if (el) {
            if (hidden) {
                el.classList.add('hidden', 'opacity-0', 'invisible', 'pointer-events-none');
            } else {
                el.classList.remove('hidden', 'opacity-0', 'invisible', 'pointer-events-none');
            }
        }
    },

    refreshIcons() {
        if (window.lucide) lucide.createIcons();
    },

    // Higher order helper for list rendering
    renderList(containerId, items, templateFn, emptyMsg = 'No items found.') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!items || items.length === 0) {
            if (container.tagName === 'TBODY') {
                container.innerHTML = `<tr><td colspan="100%" class="text-muted text-center py-4">${emptyMsg}</td></tr>`;
            } else {
                container.innerHTML = `<p class="text-muted text-center py-4">${emptyMsg}</p>`;
            }
            return;
        }

        container.innerHTML = items.map(templateFn).join('');
        this.refreshIcons();
    }
};
