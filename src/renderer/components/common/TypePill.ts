import { UIUtils } from '../../core/dom';

/**
 * TypePill Component - Tailwind version
 * Used to display transaction types (income, expense, transfer)
 */

interface TypePillProps {
    label: string; // Changed from text to label to match consistent props usage if desired, or keep text. Original used text.
    // Wait, TransactionRow passed "category" as text? 
    // TransactionRow usage: TypePill(category, type)
    // It was a FUNCTION calling args (text, type).
    // I should maintain signature OR switch to Props object.
    // Original JS: export const TypePill = (text, type) => { ... }
    // If I switch to Object props, I must update callers.
    // TransactionRow.ts (step 304) uses: TypePill({ label: category, type }) - wait, I updated TransactionRow to use object syntax?
    // Let's check TransactionRow.ts created in step 304.
    // TransactionRow content: `TypePill({ label: category, type })`
    // SO I MUST use Object Props here.
    type: string;
}

export const TypePill = ({ label, type }: TypePillProps): string => {
    const types: Record<string, string> = {
        income: 'bg-success/15 text-success border-success/20',
        expense: 'bg-danger/15 text-danger border-danger/20',
        transfer: 'bg-info/15 text-info border-info/20'
    };

    const typeClass = types[type] || 'bg-surface-input text-text-muted border-border';

    return `
    <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${typeClass}">
        ${UIUtils.escapeHTML(label)}
    </span>
`;
};
