/**
 * TypePill Component - Tailwind version
 * Used to display transaction types (income, expense, transfer)
 */
export const TypePill = (text, type) => {
    const types = {
        income: 'bg-success/15 text-success border-success/20',
        expense: 'bg-danger/15 text-danger border-danger/20',
        transfer: 'bg-info/15 text-info border-info/20'
    };

    const typeClass = types[type] || 'bg-surface-input text-text-muted border-border';

    return `
    <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${typeClass}">
        ${text}
    </span>
`;
};
