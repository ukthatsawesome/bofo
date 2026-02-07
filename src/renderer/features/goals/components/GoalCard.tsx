import { h } from 'preact';
import { clsx } from 'clsx';
import { Target, Calendar, TrendingUp, MoreVertical, Edit2, Trash2, Plus } from 'lucide-preact';
import { UiCard } from '@/components/ui/UiCard';
import { UiButton } from '@/components/ui/UiButton';
import { IconButton } from '@/components/ui/IconButton';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { Goal } from '../../../../shared/types';
import { useState } from 'preact/hooks';

interface GoalCardProps {
    goal: Goal;
    onContribute: (id: number) => void;
    onEdit: (id: number) => void;
    onDelete: (id: number) => void;
}

export const GoalCard = ({ goal, onContribute, onEdit, onDelete }: GoalCardProps) => {
    const [showMenu, setShowMenu] = useState(false);

    const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
    const remaining = Math.max(goal.target_amount - goal.current_amount, 0);

    return (
        <UiCard className="relative group hover:shadow-md transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
                <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                        {/* We might need a dynamic icon mapper, for now default or check if we have an icon helper */}
                        <Target size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-text-primary mb-1">{goal.name}</h3>
                        <p className="text-sm text-text-muted line-clamp-1">{goal.description || 'No description'}</p>
                    </div>
                </div>

                <div className="relative">
                    <IconButton
                        icon={MoreVertical}
                        variant="ghost"
                        onClick={() => setShowMenu(!showMenu)}
                    />

                    {showMenu && (
                        <div className="absolute right-0 top-full mt-2 w-36 bg-surface-card border border-border rounded-lg shadow-lg z-10 p-1 flex flex-col animate-fade-in-up">
                            <button
                                onClick={() => { setShowMenu(false); onEdit(goal.id); }}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover rounded-md text-left w-full"
                            >
                                <Edit2 size={14} /> Edit
                            </button>
                            <button
                                onClick={() => { setShowMenu(false); onDelete(goal.id); }}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-surface-hover rounded-md text-left w-full"
                            >
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    )}
                    {/* Click outside listener could be added here or strictly handled */}
                    {showMenu && <div className="fixed inset-0 z-0" onClick={() => setShowMenu(false)} />}
                </div>
            </div>

            <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold text-text-primary">{formatCurrency(goal.current_amount)}</span>
                    <span className="text-text-muted">of {formatCurrency(goal.target_amount)}</span>
                </div>
                <div className="h-2.5 w-full bg-surface-active rounded-full overflow-hidden">
                    <div
                        className="h-full bg-brand-primary rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-xs">
                    <span className="text-brand-primary font-medium">{formatPercent(progress / 100)}</span>
                    {remaining > 0 ? (
                        <span className="text-text-muted">{formatCurrency(remaining)} to go</span>
                    ) : (
                        <span className="text-success font-bold flex items-center gap-1">
                            Completed!
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                <div className="flex flex-col gap-1">
                    {goal.target_date && (
                        <div className="flex items-center gap-1.5 text-xs text-text-muted">
                            <Calendar size={14} />
                            <span>{new Date(goal.target_date).toLocaleDateString()}</span>
                        </div>
                    )}
                    {goal.monthly_contribution && goal.monthly_contribution > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-text-muted">
                            <TrendingUp size={14} />
                            <span>{formatCurrency(goal.monthly_contribution)}/mo</span>
                        </div>
                    )}
                </div>

                <UiButton
                    variant="primary"
                    size="sm"
                    icon={<Plus size={16} />}
                    onClick={() => onContribute(goal.id)}
                    className="shadow-sm"
                >
                    Add
                </UiButton>
            </div>
        </UiCard>
    );
};
