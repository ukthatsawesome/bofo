import type { Formatter } from '../../lib/formatters';

/**
 * RecurringChargeItem Component - Displays a recurring expense/charge
 */

interface RecurringChargeItemProps {
  id: number | string;
  category: string;
  name: string;
  amount: number;
  frequency?: 'weekly' | 'monthly' | 'yearly';
  due_day?: number;
  is_active?: boolean;
  notes?: string;
  formatter: Formatter;
  onEdit: string;
  onDelete: string;
  onToggle: string;
}

export const RecurringChargeItem = ({
  id,
  category,
  name,
  amount,
  frequency = 'monthly',
  due_day = 1,
  is_active = true,
  notes = '',
  formatter,
  onEdit,
  onDelete,
  onToggle,
}: RecurringChargeItemProps): string => {
  const frequencyLabels: Record<string, string> = {
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
  };

  const frequencyIcons: Record<string, string> = {
    weekly: 'calendar-days',
    monthly: 'calendar',
    yearly: 'calendar-range',
  };

  // Calculate monthly equivalent
  const monthlyAmount =
    frequency === 'weekly' ? amount * 4.33 : frequency === 'yearly' ? amount / 12 : amount;

  return `
    <div class="flex items-center gap-4 p-4 rounded-xl bg-surface-panel/50 border border-border 
                transition-all hover:border-border-strong ${!is_active ? 'opacity-50' : ''}"
         data-charge-id="${id}">
        
        <!-- Category Icon -->
        <div class="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0">
            <i data-lucide="${frequencyIcons[frequency] || 'repeat'}" class="w-5 h-5"></i>
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
                <h4 class="text-sm font-semibold text-text-main truncate">${name}</h4>
                <span class="px-2 py-0.5 rounded-full text-xs bg-surface-input text-text-muted">${category}</span>
            </div>
            <p class="text-xs text-text-muted mt-0.5">
                ${frequencyLabels[frequency]} • Due day ${due_day}
                ${notes ? ` • ${notes}` : ''}
            </p>
        </div>

        <!-- Amount -->
        <div class="text-right shrink-0">
            <p class="text-sm font-bold text-danger">${formatter.formatCurrency(amount)}</p>
            ${frequency !== 'monthly'
      ? `
                <p class="text-xs text-text-muted">${formatter.formatCurrency(monthlyAmount)}/mo</p>
            `
      : ''
    }
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-1 shrink-0">
            <button class="w-8 h-8 rounded-lg flex items-center justify-center border border-border
                          text-text-muted hover:text-brand-primary hover:border-brand-primary transition-all"
                    onclick="${onToggle}(${id}, ${is_active ? 'false' : 'true'})"
                    title="${is_active ? 'Pause' : 'Resume'}">
                <i data-lucide="${is_active ? 'pause' : 'play'}" class="w-4 h-4"></i>
            </button>
            <button class="w-8 h-8 rounded-lg flex items-center justify-center border border-border
                          text-text-muted hover:text-accent hover:border-accent transition-all"
                    onclick="${onEdit}(${id})" title="Edit">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button class="w-8 h-8 rounded-lg flex items-center justify-center border border-border
                          text-text-muted hover:text-danger hover:border-danger transition-all"
                    onclick="${onDelete}(${id})" title="Delete">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    </div>
`;
};

/**
 * RecurringChargesSummary - Shows total monthly recurring charges
 */

interface RecurringChargesSummaryProps {
  total: number;
  formatter: Formatter;
}

export const RecurringChargesSummary = ({
  total,
  formatter,
}: RecurringChargesSummaryProps): string => `
    <div class="flex items-center justify-between p-4 rounded-xl bg-danger/10 border border-danger/20">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-danger/20 flex items-center justify-center text-danger">
                <i data-lucide="receipt" class="w-5 h-5"></i>
            </div>
            <div>
                <p class="text-sm font-bold text-text-main">Monthly Fixed Expenses</p>
                <p class="text-xs text-text-muted">Total recurring charges</p>
            </div>
        </div>
        <p class="text-xl font-bold text-danger">${formatter.formatCurrency(total)}</p>
    </div>
`;
