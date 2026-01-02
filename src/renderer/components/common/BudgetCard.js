/**
 * BudgetCard Component - Tailwind version
 * Displays budget progress with spending info
 */
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
}) => {
    const percent = Math.min((spent / limit) * 100, 100);
    const isOver = spent > limit;
    const remaining = limit - spent;

    // Progress bar color based on percentage
    const getProgressColor = (pct) => {
        if (pct > 100) return 'bg-danger';
        if (pct > 85) return 'bg-warning';
        if (pct > 60) return 'bg-brand-primary';
        return 'bg-success';
    };

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
            
            <div class="flex items-baseline gap-2 mb-3">
                <span class="text-xl font-bold ${isOver ? 'text-danger' : 'text-text-main'}">
                    ${formatter.formatCurrency(spent)}
                </span>
                <span class="text-sm text-text-muted">
                    of ${formatter.formatCurrency(limit)}
                </span>
            </div>
            
            <div class="h-2 bg-surface-input rounded-full overflow-hidden mb-3">
                <div 
                    class="h-full ${getProgressColor(percent)} rounded-full transition-all duration-500"
                    style="width: ${percent}%"
                ></div>
            </div>
            
            <div class="text-sm font-medium ${remaining < 0 ? 'text-danger' : 'text-success'}">
                ${remaining < 0 ? 'Over by' : 'Remaining:'} ${formatter.formatCurrency(Math.abs(remaining))}
            </div>
        </div>
    `;
};
