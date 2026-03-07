import { h } from 'preact';
import { clsx } from 'clsx';
import { PieChart, MoreVertical, Edit2, Trash2, Calendar, AlertCircle } from 'lucide-preact';
import { UiCard } from '@/components/ui/UiCard';
import { UiButton } from '@/components/ui/UiButton';
import { IconButton } from '@/components/ui/IconButton';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { useState } from 'preact/hooks';
import { Budget } from '../../../../shared/types';

interface BudgetCardProps {
  budget: Budget & {
    spent: number;
    percent: number;
    remaining: number;
    status: 'ok' | 'warning' | 'over';
  };
  onEdit: (budget: Budget) => void;
  onDelete: (id: number) => void;
}

export const BudgetCard = ({ budget, onEdit, onDelete }: BudgetCardProps) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <UiCard
      className={clsx(
        'relative group hover:shadow-md transition-all duration-300',
        budget.status === 'over'
          ? 'border-l-4 border-l-danger'
          : budget.status === 'warning'
            ? 'border-l-4 border-l-warning'
            : 'border-l-4 border-l-success'
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-4">
          <div
            className={clsx(
              'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
              budget.status === 'over'
                ? 'bg-danger/10 text-danger'
                : budget.status === 'warning'
                  ? 'bg-warning/10 text-warning'
                  : 'bg-success/10 text-success'
            )}
          >
            <PieChart size={24} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-text-primary mb-1">{budget.category}</h3>
            <div className="flex items-center gap-1 text-xs text-text-muted">
              <Calendar size={12} />
              <span className="capitalize">{budget.period}</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <IconButton icon={MoreVertical} variant="ghost" onClick={() => setShowMenu(!showMenu)} />

          {showMenu && (
            <div className="absolute right-0 top-full mt-2 w-36 bg-surface-card border border-border rounded-lg shadow-lg z-10 p-1 flex flex-col animate-fade-in-up">
              <button
                onClick={() => {
                  setShowMenu(false);
                  onEdit(budget);
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover rounded-md text-left w-full"
              >
                <Edit2 size={14} /> Edit
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onDelete(budget.id);
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-surface-hover rounded-md text-left w-full"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
          {showMenu && <div className="fixed inset-0 z-0" onClick={() => setShowMenu(false)} />}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-semibold text-text-primary">{formatCurrency(budget.spent)}</span>
          <span className="text-text-muted">of {formatCurrency(budget.amount)}</span>
        </div>
        <div className="h-2.5 w-full bg-surface-active rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-1000 ease-out',
              budget.status === 'over'
                ? 'bg-danger'
                : budget.status === 'warning'
                  ? 'bg-warning'
                  : 'bg-success'
            )}
            style={{ width: `${Math.min(budget.percent, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs">
          <span
            className={clsx(
              'font-medium',
              budget.status === 'over' ? 'text-danger' : 'text-text-muted'
            )}
          >
            {budget.percent.toFixed(0)}% Used
          </span>
          {budget.remaining >= 0 ? (
            <span className="text-text-muted">{formatCurrency(budget.remaining)} left</span>
          ) : (
            <span className="text-danger font-bold flex items-center gap-1">
              {formatCurrency(Math.abs(budget.remaining))} over
            </span>
          )}
        </div>
      </div>
    </UiCard>
  );
};
