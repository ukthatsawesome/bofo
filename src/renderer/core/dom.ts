export const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null =>
  document.querySelector(selector);
export const $$ = (selector: string): NodeListOf<Element> => document.querySelectorAll(selector);

export const UIUtils = {
  createElement(tag: string, className: string = '', innerHTML: string = ''): HTMLElement {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
  },

  setHidden(selector: string, hidden: boolean): void {
    const el = $<HTMLElement>(selector);
    if (el) {
      if (hidden) {
        el.classList.add('hidden', 'opacity-0', 'invisible', 'pointer-events-none');
      } else {
        el.classList.remove('hidden', 'opacity-0', 'invisible', 'pointer-events-none');
      }
    }
  },

  /**
   * Refresh Lucide icons in a specific container or the whole document
   */
  refreshIcons(container?: HTMLElement | null): void {
    if (window.lucide) {
      window.lucide.createIcons({
        root: container || document.body,
      });
    }
  },

  // Higher order helper for list rendering
  renderList<T>(
    containerId: string,
    items: T[],
    templateFn: (item: T, index: number) => string,
    emptyMsg: string = 'No items found.'
  ): void {
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

    container.innerHTML = items.map((item, index) => templateFn(item, index)).join('');
    this.refreshIcons(container);
  },

  escapeHTML(str: any): string {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
};
