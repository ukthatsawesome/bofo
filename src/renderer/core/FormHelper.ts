/**
 * FormHelper - Manages dropdown and form population utilities
 * Extracted from App to maintain single responsibility
 */
import type { StateManager } from './state';
import type { Formatter } from './formatter';
import { CURRENCIES } from '../../shared/currencies';

export class FormHelper {
    private state: StateManager;
    private formatter: Formatter;

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

        document.querySelectorAll('.currency-select').forEach((el) => {
            const select = el as HTMLSelectElement;
            const current = select.value;
            select.innerHTML = html;
            if (current) select.value = current;
        });
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

        const selectors = ['.account-dropdown', '#modal-tx-account', '#modal-tx-to-account'];
        selectors.forEach((sel) => {
            document.querySelectorAll(sel).forEach((el) => {
                const select = el as HTMLSelectElement;
                const current = select.value;
                select.innerHTML = html;
                if (current) select.value = current;
            });
        });
    }

    /**
     * Update category dropdowns throughout the app
     */
    updateCategoryDropdowns(): void {
        const categories = (this.state.categories || []).filter((c) => c.status !== 'archived');
        const html = categories.map((c) => `<option value="${c.name}">${c.name}</option>`).join('');

        const selectors = ['.category-dropdown', '#modal-tx-category', '#budget-category'];
        selectors.forEach((sel) => {
            document.querySelectorAll(sel).forEach((el) => {
                const select = el as HTMLSelectElement;
                const current = select.value;
                select.innerHTML = html;
                if (current) select.value = current;
            });
        });
    }
}
