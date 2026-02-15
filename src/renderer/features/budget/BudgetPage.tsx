import { h } from 'preact';
import { useState } from 'preact/hooks';
import { useBudget } from '@/features/budget/hooks/useBudget';
import { UiCard } from '@/components/ui/UiCard';
import { UiButton } from '@/components/ui/UiButton';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { UiSelect } from '@/components/ui/UiSelect';
import { UiStatCard } from '@/components/ui/UiStatCard';
import { formatCurrency, formatNumber, getCurrencyCode } from '@/utils/format';
import { PiggyBank, ShoppingCart, AlertCircle, CheckCircle, Plus, Edit3, Trash2 } from 'lucide-preact';
import { clsx } from 'clsx';
import { BudgetCard } from './components/BudgetCard';
import { ViewLayout } from '@/components/layout/ViewLayout';
import { ToggleButtonGroup } from '@/components/ui/ToggleButtonGroup';
import { notify } from '@/core/lib/notify';

// Date Helpers
const formatDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const getEndOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

export const BudgetPage = () => {
    const {
        budgets,
        stats,
        filter,
        setFilter,
        viewMonth,
        setViewMonth,
        isLoading,
        deleteBudget,
        saveBudget,
        categories
    } = useBudget();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBudget, setEditingBudget] = useState<any>(null);

    // Form State
    const [formData, setFormData] = useState({
        category: '',
        amount: 0,
        period: 'monthly',
        start_date: formatDate(new Date()),
        end_date: formatDate(getEndOfMonth(new Date()))
    });

    const handleNew = () => {
        setEditingBudget(null);
        setFormData({
            category: '',
            amount: 0,
            period: 'monthly',
            start_date: formatDate(new Date()),
            end_date: formatDate(getEndOfMonth(new Date()))
        });
        setIsModalOpen(true);
    };

    const handleEdit = (b: any) => {
        setEditingBudget(b);
        setFormData({
            category: b.category,
            amount: b.amount,
            period: b.period,
            start_date: b.start_date,
            end_date: b.end_date
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        try {
            await saveBudget({
                id: editingBudget?.id,
                ...formData,
                period: formData.period as 'weekly' | 'monthly' | 'yearly'
            });
            setIsModalOpen(false);
        } catch (e: any) {
            notify.error('Save Failed', e.message || 'Unable to save budget');
        }
    };

    const handlePeriodChange = (period: string) => {
        setFormData(prev => {
            const start = new Date(prev.start_date);
            let end = new Date(prev.end_date);

            if (period === 'weekly') {
                end = new Date(start);
                end.setDate(start.getDate() + 6);
            }
            if (period === 'monthly') end = getEndOfMonth(start);
            if (period === 'yearly') end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate() - 1);

            return { ...prev, period, end_date: formatDate(end) };
        });
    };

    const HeaderActions = (
        <div className="flex gap-3">
            {filter === 'past' && (
                <input
                    type="month"
                    value={viewMonth}
                    onChange={(e) => setViewMonth((e.target as HTMLInputElement).value)}
                    className="bg-surface-base border border-border rounded-lg px-3 py-2 text-sm"
                />
            )}
            {/* <ToggleButtonGroup imported above> */}
            <ToggleButtonGroup
                options={[
                    { value: 'active', label: 'Active' },
                    { value: 'past', label: 'History' }
                ]}
                value={filter}
                onChange={(v) => setFilter(v as any)}
                variant="primary"
                className="bg-surface-card border border-border" // Match existing container style but use standard component
            />
            <UiButton icon={<Plus size={18} />} onClick={handleNew}>New Budget</UiButton>
        </div>
    );

    return (
        <ViewLayout
            title="Budget Management"
            subtitle="Set limits and track your spending"
            actions={HeaderActions}
        >
            <div className="space-y-6">

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <UiStatCard
                        label="Total Budgeted"
                        value={isLoading ? "..." : formatNumber(stats.totalBudgeted)}
                        icon={PiggyBank}
                        trend="neutral"
                        trendValue="Target"
                        currency={getCurrencyCode()}
                    />
                    <UiStatCard
                        label="Total Spent"
                        value={isLoading ? "..." : formatNumber(stats.totalSpent)}
                        icon={ShoppingCart}
                        trend="neutral"
                        trendValue="Actual"
                        currency={getCurrencyCode()}
                    />
                    <UiStatCard
                        label="Remaining"
                        value={isLoading ? "..." : formatNumber(Math.abs(stats.totalRemaining))}
                        icon={stats.isOverBudget ? AlertCircle : CheckCircle}
                        trend={stats.isOverBudget ? 'down' : 'up'}
                        trendValue={stats.isOverBudget ? 'Over Budget' : 'Under Budget'}
                        color={stats.isOverBudget ? 'danger' : 'success'}
                        currency={getCurrencyCode()}
                    />
                </div>

                {/* Budget List */}
                {/* Budget List */}
                {budgets.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                        <div className="w-16 h-16 bg-surface-active rounded-full flex items-center justify-center mx-auto mb-4 text-text-muted">
                            <PiggyBank size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-text-primary">No budgets found</h3>
                        <p className="text-text-muted mb-4">
                            Set a budget to track your spending limits.
                        </p>
                        <UiButton onClick={handleNew} icon={<Plus size={16} />}>Create Budget</UiButton>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {budgets.map((b: any) => (
                            <BudgetCard
                                key={b.id}
                                budget={b}
                                onEdit={handleEdit}
                                onDelete={deleteBudget}
                            />
                        ))}
                    </div>
                )}

                {/* @ts-ignore */}
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingBudget ? "Edit Budget" : "New Budget"}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <UiSelect
                            label="Category"
                            options={categories.filter((c: any) => c.type === 'expense').map((c: any) => ({ label: c.name, value: c.name }))}
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: (e.target as HTMLSelectElement).value })}
                            required
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Limit Amount"
                                type="number"
                                value={formData.amount}
                                onInput={(e) => setFormData({ ...formData, amount: Number((e.target as HTMLInputElement).value) })}
                                required
                            />
                            <UiSelect
                                label="Period"
                                options={[
                                    { label: 'Monthly', value: 'monthly' },
                                    { label: 'Weekly', value: 'weekly' },
                                    { label: 'Yearly', value: 'yearly' },
                                ]}
                                value={formData.period}
                                onChange={(e) => handlePeriodChange((e.target as HTMLSelectElement).value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Start Date"
                                type="date"
                                value={formData.start_date}
                                onInput={(e) => setFormData({ ...formData, start_date: (e.target as HTMLInputElement).value })}
                                required
                            />
                            <Input
                                label="End Date"
                                type="date"
                                value={formData.end_date}
                                onInput={(e) => setFormData({ ...formData, end_date: (e.target as HTMLInputElement).value })}
                                required
                            />
                        </div>

                        <div className="flex justify-end pt-4">
                            <UiButton type="submit">Save Budget</UiButton>
                        </div>
                    </form>
                </Modal>
            </div>
        </ViewLayout>
    );
};
