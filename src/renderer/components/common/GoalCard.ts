import { UIUtils } from '../../core/dom';
import type { Formatter } from '../../core/formatter';

/**
 * GoalCard Component - Displays a savings goal with progress
 */

interface GoalCardProps {
  id: number | string;
  name: string;
  description?: string;
  target_amount: number;
  current_amount?: number;
  monthly_contribution?: number;
  icon?: string;
  color?: string;
  status?: 'active' | 'completed' | 'paused' | 'cancelled';
  target_date?: string | null;
  formatter: Formatter;
  onContribute: string;
  onEdit: string;
  onDelete: string;
}

export const GoalCard = ({
  id,
  name,
  description = '',
  target_amount,
  current_amount = 0,
  monthly_contribution = 0,
  icon = 'target',
  color = '#a29bfe',
  status = 'active',
  target_date = null,
  formatter,
  onContribute,
  onEdit,
  onDelete,
}: GoalCardProps): string => {
  const progress = target_amount > 0 ? Math.min((current_amount / target_amount) * 100, 100) : 0;
  const remaining = target_amount - current_amount;
  const isCompleted = status === 'completed' || progress >= 100;

  // Calculate estimated completion
  let estimatedCompletion = '';
  if (!isCompleted && monthly_contribution > 0 && remaining > 0) {
    const monthsToGo = Math.ceil(remaining / monthly_contribution);
    const completionDate = new Date();
    completionDate.setMonth(completionDate.getMonth() + monthsToGo);
    estimatedCompletion = completionDate.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  }

  // Progress bar color based on progress
  const getProgressColor = () => {
    if (isCompleted) return 'bg-success';
    if (progress >= 75) return 'bg-success';
    if (progress >= 50) return 'bg-info';
    if (progress >= 25) return 'bg-warning';
    return 'bg-brand-primary';
  };

  const statusBadge: Record<string, string> = {
    active: 'bg-info/15 text-info',
    completed: 'bg-success/15 text-success',
    paused: 'bg-warning/15 text-warning',
    cancelled: 'bg-danger/15 text-danger',
  };

  return `
    <div class="card-panel relative overflow-hidden ${isCompleted ? 'border-success/30' : ''}" data-goal-id="${id}">
        <!-- Colored top accent -->
        <div class="absolute top-0 left-0 right-0 h-1" style="background: ${color}"></div>
        
        <div class="pt-2">
            <!-- Header -->
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-xl flex items-center justify-center" 
                         style="background: ${color}20; color: ${color}">
                        <i data-lucide="${icon}" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <h4 class="text-base font-bold text-text-main flex items-center gap-2">
                            ${UIUtils.escapeHTML(name)}
                            ${isCompleted ? '<i data-lucide="check-circle-2" class="w-4 h-4 text-success"></i>' : ''}
                        </h4>
                        ${description ? `<p class="text-xs text-text-muted mt-0.5">${UIUtils.escapeHTML(description)}</p>` : ''}
                    </div>
                </div>
                <span class="px-2 py-1 rounded-full text-xs font-semibold ${statusBadge[status] || statusBadge.active}">
                    ${status?.charAt(0).toUpperCase() + status?.slice(1)}
                </span>
            </div>

            <!-- Progress Bar -->
            <div class="mb-4">
                <div class="flex justify-between text-sm mb-1.5">
                    <span class="font-semibold text-text-main">${formatter.formatCurrency(current_amount)}</span>
                    <span class="text-text-muted">of ${formatter.formatCurrency(target_amount)}</span>
                </div>
                <div class="h-3 bg-surface-input rounded-full overflow-hidden">
                    <div class="h-full ${getProgressColor()} rounded-full transition-all duration-500 ease-out"
                         style="width: ${progress}%"></div>
                </div>
                <div class="flex justify-between text-xs text-text-muted mt-1">
                    <span>${progress.toFixed(1)}% complete</span>
                    <span>${formatter.formatCurrency(remaining)} to go</span>
                </div>
            </div>

            <!-- Stats Row -->
            <div class="grid grid-cols-2 gap-3 mb-4">
                <div class="bg-surface-input/50 rounded-lg p-3 text-center">
                    <p class="text-xs text-text-muted mb-0.5">Monthly</p>
                    <p class="text-sm font-bold text-text-main">${formatter.formatCurrency(monthly_contribution)}</p>
                </div>
                <div class="bg-surface-input/50 rounded-lg p-3 text-center">
                    <p class="text-xs text-text-muted mb-0.5">${isCompleted ? 'Completed' : 'ETA'}</p>
                    <p class="text-sm font-bold ${isCompleted ? 'text-success' : 'text-text-main'}">
                        ${isCompleted ? '🎉' : estimatedCompletion || (target_date ? new Date(target_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—')}
                    </p>
                </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2">
                ${
                  !isCompleted
                    ? `
                    <button class="btn-primary flex-1 text-sm py-2.5" onclick="${onContribute}(${id})">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        Contribute
                    </button>
                `
                    : `
                    <button class="btn-secondary flex-1 text-sm py-2.5 text-success border-success/30" disabled>
                        <i data-lucide="party-popper" class="w-4 h-4"></i>
                        Goal Achieved!
                    </button>
                `
                }
                <button class="btn-secondary px-3" onclick="${onEdit}(${id})" title="Edit">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                </button>
                <button class="btn-secondary px-3 hover:text-danger hover:border-danger" onclick="${onDelete}(${id})" title="Delete">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    </div>
`;
};
