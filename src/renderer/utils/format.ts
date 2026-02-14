import { settings } from '../core/financeStore';

export const formatCurrency = (
    amount: number,
    currencyCode?: string,
    compact: boolean = false
): string => {
    // Default to USD/2 if settings not loaded yet
    const precision = parseInt(settings.value?.currency_precision || '2');
    const currency = currencyCode || settings.value?.currency_base || 'USD';
    const fractionDigits = compact ? 0 : precision;

    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            currencyDisplay: 'symbol',
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
            notation: compact ? 'compact' : 'standard',
        }).format(amount);
    } catch (e) {
        return `${currency} ${amount.toFixed(fractionDigits)}`;
    }
};

export const formatDate = (dateStr: string | Date): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
};
