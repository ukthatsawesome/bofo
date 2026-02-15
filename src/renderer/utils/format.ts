import { settings } from '../core/financeStore';
import { SETTING_KEYS } from '../../shared/settings/keys';

export const formatCurrency = (
    amount: number,
    currencyCode?: string,
    compact: boolean = false
): string => {
    // Default to USD/2 if settings not loaded yet
    const precision = parseInt(settings.value?.[SETTING_KEYS.CURRENCY.PRECISION] || '2');
    const currency = currencyCode || settings.value?.[SETTING_KEYS.CURRENCY.BASE] || 'USD';
    const fractionDigits = compact ? 0 : precision;

    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            currencyDisplay: 'code',
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
            notation: compact ? 'compact' : 'standard',
        }).format(amount);
    } catch (e) {
        return `${currency} ${amount.toFixed(fractionDigits)}`;
    }
};

/** Format a number without any currency symbol/code — digits only */
export const formatNumber = (
    amount: number,
    currencyCode?: string,
    compact: boolean = false
): string => {
    const precision = parseInt(settings.value?.[SETTING_KEYS.CURRENCY.PRECISION] || '2');
    const fractionDigits = compact ? 0 : precision;

    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
        notation: compact ? 'compact' : 'standard',
    }).format(amount);
};

/** Get the currency code for display */
export const getCurrencyCode = (currencyCode?: string): string => {
    return currencyCode || settings.value?.[SETTING_KEYS.CURRENCY.BASE] || 'USD';
};

export const formatDate = (dateStr: string | Date): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
};
