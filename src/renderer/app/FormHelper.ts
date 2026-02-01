/**
 * FormHelper - Manages dropdown and form population utilities
 * Extracted from App to maintain single responsibility
 */
import type { StateManager } from '../lib/state/StateManager';
import type { Formatter } from '../lib/formatters';
import { CURRENCIES } from '../../shared/currencies';

export class FormHelper {
    private state: StateManager;
    private formatter: Formatter;

    // Selectors for specific element groups
    private static readonly ACCOUNT_SELECTORS = [
        '.account-dropdown',
        '#modal-tx-account',
        '#modal-tx-to-account',
    ];

    private static readonly CATEGORY_SELECTORS = [
        '.category-dropdown',
        '#modal-tx-category',
        '#budget-category',
    ];

    constructor(state: StateManager, formatter: Formatter) {
        this.state = state;
        this.formatter = formatter;
    }

    /**
     * Populate all currency select dropdowns
     */
    populateCurrencyDropdowns(): void {
        const html = CURRENCIES
            .map((c) => `<option value="${c.code}">${c.code} - ${c.name}</option>`)
            .join('');

        this.updateSelectElements(['.currency-select'], html);
    }

    /**
     * Update account dropdowns throughout the app
     */
    updateAccountDropdowns(): void {
        const accounts = (this.state.accounts || []).filter((a) => a.status !== 'archived');

        const html = accounts
            .map((a) => {
                const currency = a.currency || 'USD';
                return `<option value="${a.id}" data-currency="${currency}">${a.name} (${this.formatter.formatCurrency(a.balance, currency)})</option>`;
            })
            .join('');

        this.updateSelectElements(FormHelper.ACCOUNT_SELECTORS, html);
    }

    /**
     * Update category dropdowns throughout the app
     */
    updateCategoryDropdowns(): void {
        const categories = (this.state.categories || []).filter((c) => c.status !== 'archived');

        const html = categories
            .map((c) => `<option value="${c.name}">${c.name}</option>`)
            .join('');

        this.updateSelectElements(FormHelper.CATEGORY_SELECTORS, html);
    }

    /**
     * Helper to update a list of select elements while preserving current selection.
     * 
     * @param selectors - Array of CSS selector strings
     * @param optionsHtml - The inner HTML string containing <option> tags
     */
    private updateSelectElements(selectors: string[], optionsHtml: string): void {
        selectors.forEach((sel) => {
            document.querySelectorAll(sel).forEach((el) => {
                const select = el as HTMLSelectElement;
                const current = select.value;

                select.innerHTML = optionsHtml;

                // Restore previous selection if it still exists in the new options
                if (current) {
                    select.value = current;
                }
            });
        });
    }
}