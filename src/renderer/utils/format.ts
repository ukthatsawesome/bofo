import { settings } from '../core/financeStore';

export const formatCurrency = (amount: number, currencyCode?: string): string => {
    // Default to USD/2 if settings not loaded yet
    const precision = parseInt(settings.value?.currency_precision || '2');
    const currency = currencyCode || settings.value?.currency_base || 'USD';

    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            currencyDisplay: 'code',
            minimumFractionDigits: precision,
            maximumFractionDigits: precision,
        }).format(amount);
    } catch (e) {
        return `${currency} ${amount.toFixed(precision)}`;
    }
};

export const formatDate = (dateStr: string | Date): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
};
