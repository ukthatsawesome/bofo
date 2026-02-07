import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Plus } from 'lucide-preact';
import { UiButton } from '@/components/ui/UiButton';
import { Input } from '@/components/ui/Input';
import { financeStore } from '@/core/financeStore';
import { PlannedItem } from '@/features/sandbox/hooks/useSandbox';
import { formatCurrency } from '@/utils/format';

interface AddPlannedItemFormProps {
    onAdd: (item: Omit<PlannedItem, 'id' | 'is_active'>) => void;
}

export const AddPlannedItemForm = ({ onAdd }: AddPlannedItemFormProps) => {
    const [item, setItem] = useState<Omit<PlannedItem, 'id' | 'is_active'>>({
        description: '',
        type: 'expense',
        amount: 0,
        category: '',
        account_id: financeStore.accounts.value[0]?.id || 1,
        start_date: new Date().toISOString().split('T')[0],
        frequency: 'once'
    });

    const handleSubmit = (e: Event) => {
        e.preventDefault();
        onAdd(item);
        setItem({
            ...item,
            description: '',
            amount: 0,
            start_date: new Date().toISOString().split('T')[0]
        });
    };

    const categories = financeStore.categories.value.filter((c: any) => c.type === item.type);

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input
                label="Description"
                value={item.description}
                onInput={(e) => setItem({ ...item, description: (e.target as HTMLInputElement).value })}
                placeholder="e.g. Europe Trip, New Car..."
                required
            />

            <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Type</label>
                <div className="flex bg-surface-base border border-border rounded-lg p-1">
                    {(['expense', 'income'] as const).map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setItem({ ...item, type: t })}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all capitalize ${item.type === t ? 'bg-surface-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'
                                }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            <Input
                label="Amount"
                type="number"
                value={item.amount}
                onInput={(e) => setItem({ ...item, amount: parseFloat((e.target as HTMLInputElement).value) })}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
            />

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Category</label>
                    <select
                        value={item.category}
                        onChange={(e) => setItem({ ...item, category: (e.target as HTMLSelectElement).value })}
                        className="w-full bg-surface-base border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:ring-2 focus:ring-brand-primary outline-none"
                    >
                        <option value="">Select Category</option>
                        {categories.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Account</label>
                    <select
                        value={item.account_id}
                        onChange={(e) => setItem({ ...item, account_id: parseInt((e.target as HTMLSelectElement).value) })}
                        className="w-full bg-surface-base border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:ring-2 focus:ring-brand-primary outline-none"
                    >
                        {financeStore.activeAccounts.value.map((a: any) => (
                            <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance, a.currency)})</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Input
                    label="Date"
                    type="date"
                    value={item.start_date}
                    onInput={(e) => setItem({ ...item, start_date: (e.target as HTMLInputElement).value })}
                    required
                />
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Frequency</label>
                    <select
                        value={item.frequency}
                        onChange={(e) => setItem({ ...item, frequency: (e.target as HTMLSelectElement).value as any })}
                        className="w-full bg-surface-base border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:ring-2 focus:ring-brand-primary outline-none"
                    >
                        <option value="once">One-time</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                    </select>
                </div>
            </div>

            <UiButton type="submit" variant="primary" className="w-full" icon={<Plus size={18} />}>
                Add to Plan
            </UiButton>
        </form>
    );
};
