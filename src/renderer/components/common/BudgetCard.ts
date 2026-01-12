/**
 * BudgetCard Component - Tailwind version
 * Displays budget progress with spending info
 */
import { ProgressBar } from './ProgressBar';
import type { Formatter } from '../../core/formatter';

interface BudgetCardProps {
    category: string;
    period: string;
    startDate: string;
    endDate: string;
    spent: number;
    limit: number;
    formatter: Formatter;
    onEdit: string;
    onDelete: string;
}

export const BudgetCard = ({
    category,
    period,
    startDate,
    endDate,
    spent,
    limit,
    formatter,
    onEdit,
    onDelete
}: BudgetCardProps): string => {
    const percent = Math.min((spent / limit) * 100, 100);
    const isOver = spent > limit;
    const remaining = limit - spent;

    // Determine color
    let barColor = 'bg-success';
    if (percent > 100) barColor = 'bg-danger';
    else if (percent > 85) barColor = 'bg-warning';
    else if (percent > 60) barColor = 'bg-brand-primary';

    return `
        <div class="card-panel ${isOver ? 'border-danger/50' : ''}">
            <div class="flex items-start justify-between mb-4">
                <div>
                    <h3 class="text-base font-bold text-text-main mb-1">${category}</h3>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-input text-xs text-text-muted">
                        ${period} · ${startDate} → ${endDate}
                    </span>
                </div>
                <div class="flex gap-2">
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
            </div>
            
            ${ProgressBar({
        label: 'Spending',
        value: `${formatter.formatCurrency(spent)} of ${formatter.formatCurrency(limit)}`,
        percent: percent,
        color: barColor,
        showPercent: false,
        size: 'sm'
    })}
            
            <div class="text-sm font-medium ${remaining < 0 ? 'text-danger' : 'text-success'}">
                ${remaining < 0 ? 'Over by' : 'Remaining:'} ${formatter.formatCurrency(Math.abs(remaining))}
            </div>
        </div>
    `;
};
