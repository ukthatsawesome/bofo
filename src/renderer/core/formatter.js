export class Formatter {
    constructor(stateManager) {
        this.state = stateManager;
    }

    formatCurrency(num, currencyCode) {
        const precision = this.state.getCurrencyPrecision();
        const currency = currencyCode || this.state.getBaseCurrency();
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency,
                minimumFractionDigits: precision,
                maximumFractionDigits: precision
            }).format(num);
        } catch (e) {
            return `${currency} ${num.toFixed(precision)}`;
        }
    }

    formatDate(dateStr) {
        if (!dateStr) return '-';
        return dateStr; // Can be enhanced to localized date
    }
}

window.Formatter = Formatter;
