import { h } from 'preact';
import { useState } from 'preact/hooks';
import { clsx } from 'clsx';
import {
    Plus, Target, PiggyBank, Flag, CalendarCheck, Wallet,
    Laptop, Car, Home, Plane, Gift, Heart, GraduationCap, Briefcase, Gem, Trophy
} from 'lucide-preact';
import { useGoals } from '@/features/goals/hooks/useGoals';
import { UiCard } from '@/components/ui/UiCard';
import { UiButton } from '@/components/ui/UiButton';
import { UiStatCard } from '@/components/ui/UiStatCard';
import { UiSelect } from '@/components/ui/UiSelect';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { GoalCard } from './components/GoalCard';
import { formatCurrency } from '@/utils/format';
import { ViewLayout } from '@/components/layout/ViewLayout';

// Icon mapping
const ICON_MAP: Record<string, any> = {
    'target': Target,
    'laptop': Laptop,
    'car': Car,
    'home': Home,
    'plane': Plane,
    'gift': Gift,
    'heart': Heart,
    'piggy-bank': PiggyBank,
    'graduation-cap': GraduationCap,
    'briefcase': Briefcase,
    'gem': Gem,
    'trophy': Trophy
};

export const GoalsPage = () => {
    const {
        goals,
        summary,
        available,
        isLoading,
        filter,
        setFilter,
        createGoal,
        updateGoal,
        deleteGoal,
        contribute
    } = useGoals();

    // Modal States
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);
    const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
    const [contributeGoalId, setContributeGoalId] = useState<number | null>(null);

    // Goal Form State
    const [goalForm, setGoalForm] = useState({
        name: '',
        description: '',
        target_amount: 0,
        monthly_contribution: 0,
        target_date: '',
        priority: 1,
        icon: 'target'
    });

    // Contribute Form State
    const [contributeForm, setContributeForm] = useState({
        amount: 0,
        source: '',
        notes: ''
    });

    const handleNewGoal = () => {
        setEditingGoalId(null);
        setGoalForm({
            name: '',
            description: '',
            target_amount: 0,
            monthly_contribution: 0,
            target_date: '',
            priority: 1,
            icon: 'target'
        });
        setIsGoalModalOpen(true);
    };

    const handleEditGoal = (id: number) => {
        const goal = goals.find((g: any) => g.id === id);
        if (!goal) return;
        setEditingGoalId(id);
        setGoalForm({
            name: goal.name,
            description: goal.description || '',
            target_amount: goal.target_amount,
            monthly_contribution: goal.monthly_contribution || 0,
            target_date: goal.target_date || '',
            priority: goal.priority,
            icon: goal.icon || 'target'
        });
        setIsGoalModalOpen(true);
    };

    const handleOpenContribute = (id: number) => {
        setContributeGoalId(id);
        setContributeForm({ amount: 0, source: '', notes: '' });
        setIsContributeModalOpen(true);
    };

    const handleGoalSubmit = async (e: Event) => {
        e.preventDefault();
        try {
            if (editingGoalId) {
                await updateGoal(editingGoalId, goalForm);
            } else {
                await createGoal(goalForm);
            }
            setIsGoalModalOpen(false);
        } catch (error) {
            console.error(error);
            // Optionally add toast logic here
        }
    };

    const handleContributeSubmit = async (e: Event) => {
        e.preventDefault();
        if (contributeGoalId) {
            await contribute(contributeGoalId, contributeForm.amount, contributeForm.source, contributeForm.notes);
            setIsContributeModalOpen(false);
        }
    };

    const contributeGoalName = goals.find((g: any) => g.id === contributeGoalId)?.name || 'Goal';

    const HeaderActions = (
        <div className="flex gap-3">
            <div className="flex bg-surface-card border border-border rounded-lg p-1">
                {(['active', 'completed', 'all'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={clsx(
                            "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize",
                            filter === f ? "bg-brand-primary text-white" : "text-text-muted hover:text-text-primary"
                        )}
                    >
                        {f}
                    </button>
                ))}
            </div>
            <UiButton icon={<Plus size={18} />} onClick={handleNewGoal}>New Goal</UiButton>
        </div>
    );

    return (
        <ViewLayout
            title="Savings Goals"
            subtitle="Track your progress towards financial milestones"
            actions={HeaderActions}
        >
            <div className="space-y-6">

                {/* Summary Stats */}
                {summary && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <UiStatCard
                            label="Active Goals"
                            value={summary.activeGoals}
                            icon={Target}
                        />
                        <UiStatCard
                            label="Total Saved"
                            value={formatCurrency(summary.totalSaved)}
                            icon={PiggyBank}
                            trend="up"
                            trendValue={`${summary.totalProgress.toFixed(1)}%`}
                            color="success"
                        />
                        <UiStatCard
                            label="Total Target"
                            value={formatCurrency(summary.totalTarget)}
                            icon={Flag}
                        />
                        <UiStatCard
                            label="Monthly Allocation"
                            value={formatCurrency(summary.totalMonthlyContribution)}
                            icon={CalendarCheck}
                        />
                    </div>
                )}

                {/* Available for Goals Card */}
                {available && (
                    <UiCard className="bg-gradient-to-br from-surface-card to-surface-base border-l-4 border-l-success">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center text-success">
                                    <Wallet className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-muted font-medium">Available for New Goals</p>
                                    <p className={clsx("text-2xl font-bold font-heading", available.available >= 0 ? "text-success" : "text-danger")}>
                                        {formatCurrency(available.available)}<span className="text-sm font-normal text-text-muted">/month</span>
                                    </p>
                                </div>
                            </div>
                            <div className="text-right text-sm text-text-muted space-y-1 bg-surface-base/50 p-3 rounded-lg border border-border/50">
                                <div className="flex justify-between gap-8"><span>Income:</span> <span className="font-mono text-text-primary">{formatCurrency(available.avgMonthlyIncome)}</span></div>
                                <div className="flex justify-between gap-8"><span>- Fixed:</span> <span className="font-mono text-text-primary">{formatCurrency(available.recurringCharges)}</span></div>
                                <div className="flex justify-between gap-8"><span>- Goals:</span> <span className="font-mono text-text-primary">{formatCurrency(available.goalContributions)}</span></div>
                            </div>
                        </div>
                    </UiCard>
                )}

                {/* Goals Grid */}
                {goals.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                        <div className="w-16 h-16 bg-surface-active rounded-full flex items-center justify-center mx-auto mb-4 text-text-muted">
                            <Target size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-text-primary">No goals found</h3>
                        <p className="text-text-muted mb-4">
                            {filter === 'completed' ? "Complete your first goal to see it here!" : "Start by creating your first savings goal"}
                        </p>
                        <UiButton onClick={handleNewGoal} icon={<Plus size={16} />}>Create Goal</UiButton>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {goals.map((goal: any) => (
                            <GoalCard
                                key={goal.id}
                                goal={goal}
                                onContribute={handleOpenContribute}
                                onEdit={handleEditGoal}
                                onDelete={deleteGoal}
                            />
                        ))}
                    </div>
                )}

                {/* Create/Edit Goal Modal */}
                {/* @ts-ignore */}
                <Modal isOpen={isGoalModalOpen} onClose={() => setIsGoalModalOpen(false)} title={editingGoalId ? "Edit Goal" : "New Goal"}>
                    <form onSubmit={handleGoalSubmit} className="space-y-4">
                        <Input
                            label="Goal Name"
                            value={goalForm.name}
                            onInput={(e) => setGoalForm({ ...goalForm, name: (e.target as HTMLInputElement).value })}
                            required
                            placeholder="e.g. New Laptop"
                        />
                        <Input
                            label="Description (optional)"
                            value={goalForm.description}
                            onInput={(e) => setGoalForm({ ...goalForm, description: (e.target as HTMLInputElement).value })}
                            placeholder="MacBook Pro"
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Target Amount"
                                type="number"
                                value={goalForm.target_amount}
                                onInput={(e) => setGoalForm({ ...goalForm, target_amount: parseFloat((e.target as HTMLInputElement).value) })}
                                required
                                min="1"
                            />
                            <Input
                                label="Monthly Contribution"
                                type="number"
                                value={goalForm.monthly_contribution}
                                onInput={(e) => setGoalForm({ ...goalForm, monthly_contribution: parseFloat((e.target as HTMLInputElement).value) })}
                                min="0"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Target Date"
                                type="date"
                                value={goalForm.target_date}
                                onInput={(e) => setGoalForm({ ...goalForm, target_date: (e.target as HTMLInputElement).value })}
                            />
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Priority</label>
                                <select
                                    className="w-full bg-surface-base border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                    value={goalForm.priority}
                                    onChange={(e) => setGoalForm({ ...goalForm, priority: parseInt((e.target as HTMLSelectElement).value) })}
                                >
                                    <option value={1}>High</option>
                                    <option value={2}>Medium</option>
                                    <option value={3}>Low</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Icon</label>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(ICON_MAP).map(([key, IconComponent]) => (
                                    <button
                                        type="button"
                                        key={key}
                                        onClick={() => setGoalForm({ ...goalForm, icon: key })}
                                        className={clsx(
                                            "w-10 h-10 rounded-lg flex items-center justify-center border transition-all",
                                            goalForm.icon === key
                                                ? "border-brand-primary text-brand-primary bg-brand-primary/10"
                                                : "border-border text-text-muted hover:text-text-primary hover:border-brand-primary/50"
                                        )}
                                    >
                                        <IconComponent size={20} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <UiButton type="submit">{editingGoalId ? 'Update Goal' : 'Create Goal'}</UiButton>
                        </div>
                    </form>
                </Modal>

                {/* Contribute Modal */}
                {/* @ts-ignore */}
                <Modal isOpen={isContributeModalOpen} onClose={() => setIsContributeModalOpen(false)} title="Contribute to Goal">
                    <form onSubmit={handleContributeSubmit} className="space-y-4">
                        <div className="p-3 bg-surface-active/50 rounded-lg mb-4">
                            <p className="text-sm text-text-muted">Contributing to:</p>
                            <p className="font-bold text-text-primary">{contributeGoalName}</p>
                        </div>

                        <Input
                            label="Amount"
                            type="number"
                            value={contributeForm.amount}
                            onInput={(e) => setContributeForm({ ...contributeForm, amount: parseFloat((e.target as HTMLInputElement).value) })}
                            required
                            min="0.01"
                            step="0.01"
                            autoFocus
                        />

                        <Input
                            label="Source (optional)"
                            value={contributeForm.source}
                            onInput={(e) => setContributeForm({ ...contributeForm, source: (e.target as HTMLInputElement).value })}
                            placeholder="e.g. Savings, Bonus"
                        />

                        <Input
                            label="Notes (optional)"
                            value={contributeForm.notes}
                            onInput={(e) => setContributeForm({ ...contributeForm, notes: (e.target as HTMLInputElement).value })}
                            placeholder="Any notes..."
                        />

                        <div className="flex justify-end pt-4">
                            <UiButton type="submit">Add Contribution</UiButton>
                        </div>
                    </form>
                </Modal>
            </div>
        </ViewLayout>
    );
};
