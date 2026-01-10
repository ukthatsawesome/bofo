export class Formatter {
    constructor(stateManager) {
        this.state = stateManager;
        this.exchangeRates = {}; // Cache for exchange rates
        this.ratesLoaded = false;
    }

    /**
     * Load exchange rates from backend and cache them
     */
    async loadExchangeRates() {
        try {
            const rates = await window.api.getExchangeRates();
            this.exchangeRates = {};

            // Ensure rates is an array before iterating
            if (Array.isArray(rates)) {
                for (const r of rates) {
                    const key = `${r.from_currency}_${r.to_currency}`;
                    this.exchangeRates[key] = r.rate;
                }
            }
            this.ratesLoaded = true;
        } catch (e) {
            console.warn('Failed to load exchange rates:', e);
        }
    }

    /**
     * Get exchange rate from cache (sync operation)
     * Returns null if rate not found
     */
    getRate(fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) return 1;

        // Try direct rate
        const directKey = `${fromCurrency}_${toCurrency}`;
        if (this.exchangeRates[directKey]) {
            return this.exchangeRates[directKey];
        }

        // Try inverse rate
        const inverseKey = `${toCurrency}_${fromCurrency}`;
        if (this.exchangeRates[inverseKey]) {
            return 1 / this.exchangeRates[inverseKey];
        }

        return null;
    }

    /**
     * Convert amount from one currency to another (sync, uses cache)
     * Returns original amount if conversion not available
     */
    convert(amount, fromCurrency, toCurrency) {
        const rate = this.getRate(fromCurrency, toCurrency);
        return rate !== null ? amount * rate : amount;
    }

    /**
     * Check if conversion is available between two currencies
     */
    canConvert(fromCurrency, toCurrency) {
        return fromCurrency === toCurrency || this.getRate(fromCurrency, toCurrency) !== null;
    }

    /**
     * Format currency in its native format
     */
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

    /**
     * Format currency after converting to base currency
     * Use this for dashboard summaries and totals
     */
    formatCurrencyAsBase(amount, sourceCurrency) {
        const baseCurrency = this.state.getBaseCurrency();
        const converted = this.convert(amount, sourceCurrency, baseCurrency);
        return this.formatCurrency(converted, baseCurrency);
    }

    /**
     * Get numerical value converted to base currency
     */
    toBase(amount, sourceCurrency) {
        const baseCurrency = this.state.getBaseCurrency();
        return this.convert(amount, sourceCurrency, baseCurrency);
    }

    formatDate(dateStr) {
        if (!dateStr) return '-';
        return dateStr; // Can be enhanced to localized date
    }
}

window.Formatter = Formatter;

