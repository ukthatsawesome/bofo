import { formatCurrency as formatCurrencyBase } from './format';

export const formatCurrency = (amount: number, currency?: string, compact: boolean = false): string => {
    return formatCurrencyBase(amount, currency, compact);
};

export const formatPercent = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    }).format(value);
};
