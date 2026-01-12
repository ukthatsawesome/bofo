import { TypePill } from '../common/TypePill';
import { UIUtils } from '../../core/dom';
import type { Formatter } from '../../core/formatter';

/**
 * TransactionRow Component - Tailwind version
 * Table row for displaying a transaction
 */

interface TransactionRowProps {
    id: number;
    date: string;
    category: string;
    type: 'income' | 'expense' | 'transfer';
    accountText: string;
    description: string;
    amount: number;
    formatter: Formatter;
    onEdit: string;
    onDelete: string;
}

export const TransactionRow = ({
    id,
    date,
    category,
    type,
    accountText,
    description,
    amount,
    formatter,
    onEdit,
    onDelete
}: TransactionRowProps): string => {
    const amountColors: Record<string, string> = {
        income: 'text-success',
        expense: 'text-danger',
        transfer: 'text-info'
    };

    const amountColor = amountColors[type] || 'text-text-main';

    return `
    <tr class="group transition-colors hover:bg-white/[0.02]">
        <td class="px-5 py-4 bg-surface-panel/30 first:rounded-l-xl text-sm text-text-main">
            ${date}
        </td>
        <td class="px-5 py-4 bg-surface-panel/30 text-sm">
            ${TypePill({ label: category, type })}
        </td>
        <td class="px-5 py-4 bg-surface-panel/30 text-sm text-text-muted">
            ${UIUtils.escapeHTML(accountText)}
        </td>
        <td class="px-5 py-4 bg-surface-panel/30 text-sm text-text-muted">
            ${UIUtils.escapeHTML(description || '-')}
        </td>
        <td class="px-5 py-4 bg-surface-panel/30 text-sm font-semibold ${amountColor}">
            ${type === 'expense' ? '-' : ''}${formatter.formatCurrency(amount)}
        </td>
        <td class="px-5 py-4 bg-surface-panel/30 last:rounded-r-xl">
            <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    class="w-8 h-8 rounded-lg border border-border bg-surface-card text-text-muted
                           flex items-center justify-center transition-all duration-200
                           hover:text-accent hover:border-accent hover:scale-110" 
                    onclick="${onEdit}"
                >
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                </button>
                <button 
                    class="w-8 h-8 rounded-lg border border-border bg-surface-card text-text-muted
                           flex items-center justify-center transition-all duration-200
                           hover:text-danger hover:border-danger hover:scale-110" 
                    onclick="${onDelete}"
                >
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </td>
    </tr>
`;
};
