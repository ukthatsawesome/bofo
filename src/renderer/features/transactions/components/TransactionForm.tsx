import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { UiButton } from '@/components/ui/UiButton';
import { Input } from '@/components/ui/Input';
import { UiSelect } from '@/components/ui/UiSelect';
import { financeStore } from '@/core/financeStore';
import { Transaction } from '../../../../shared/types';
import { Calendar, DollarSign, FileText, Tag, Wallet } from 'lucide-preact';
import { ToggleButtonGroup } from '@/components/ui/ToggleButtonGroup';

interface TransactionFormProps {
    initialData?: Partial<Transaction>;
    onSubmit: (data: any) => Promise<void>;
    onCancel: () => void;
}

export const TransactionForm = ({ initialData, onSubmit, onCancel }: TransactionFormProps) => {
    const isEdit = !!initialData?.id;
    const [isLoading, setIsLoading] = useState(false);
    const [type, setType] = useState<'income' | 'expense' | 'transfer'>(
        (initialData?.type as any) || 'expense'
    );

    const [formData, setFormData] = useState({
        amount: initialData?.amount?.toString() || '',
        description: initialData?.description || '',
        date: initialData?.start_date || new Date().toISOString().split('T')[0],
        category_id: initialData?.category_id || '', // Prefer ID
        category_name: initialData?.category_name || initialData?.category || '', // Fallback
        account_id: initialData?.account_id || '',
        to_account_id: initialData?.to_account_id || '',
    });

    const accounts = financeStore.activeAccounts.value.map((a: { name: string; id: number }) => ({ label: a.name, value: a.id }));
    const categories = financeStore.categories.value
        .filter((c: { type: string; name: string; id: number }) => c.type === type)
        .map((c: { name: string; id: number }) => ({ label: c.name, value: c.id }));

    // Handle string-based category logic from legacy if category_id is missing
    // In new system, we should strictly use IDs, but for migration safety:
    useEffect(() => {
        if (initialData?.category && !initialData.category_id) {
            const found = financeStore.categories.value.find((c: { name: string; type: string; id: number }) => c.name === initialData.category && c.type === type);
            if (found) setFormData(prev => ({ ...prev, category_id: found.id }));
        }
    }, [initialData, type]);

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onSubmit({
                ...formData,
                amount: parseFloat(formData.amount),
                account_id: Number(formData.account_id),
                to_account_id: type === 'transfer' ? Number(formData.to_account_id) : undefined,
                category_id: type !== 'transfer' ? Number(formData.category_id) : undefined,
                type
            });
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type Toggles */}
            <ToggleButtonGroup
                options={[
                    { value: 'expense', label: 'Expense' },
                    { value: 'income', label: 'Income' },
                    { value: 'transfer', label: 'Transfer' }
                ]}
                value={type}
                onChange={(v) => setType(v as typeof type)}
                className="mb-6 [&>button]:flex-1"
            />

            <div className="grid grid-cols-2 gap-4">
                <Input
                    label="Amount"
                    icon={DollarSign}
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onInput={(e) => setFormData({ ...formData, amount: (e.target as HTMLInputElement).value })}
                />
                <Input
                    label="Date"
                    icon={Calendar}
                    type="date"
                    required
                    value={formData.date}
                    onInput={(e) => setFormData({ ...formData, date: (e.target as HTMLInputElement).value })}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <UiSelect
                    label="Account"
                    icon={Wallet}
                    options={accounts}
                    value={formData.account_id}
                    onChange={(e) => setFormData({ ...formData, account_id: (e.target as HTMLSelectElement).value })}
                    required
                />

                {type === 'transfer' ? (
                    <UiSelect
                        label="To Account"
                        icon={Wallet}
                        options={accounts.filter(a => a.value != formData.account_id)}
                        value={formData.to_account_id}
                        onChange={(e) => setFormData({ ...formData, to_account_id: (e.target as HTMLSelectElement).value })}
                        required
                    />
                ) : (
                    <UiSelect
                        label="Category"
                        icon={Tag}
                        options={categories}
                        value={formData.category_id}
                        onChange={(e) => setFormData({ ...formData, category_id: (e.target as HTMLSelectElement).value })}
                        required
                    />
                )}
            </div>

            <Input
                label="Description"
                icon={FileText}
                placeholder="Description"
                value={formData.description}
                onInput={(e) => setFormData({ ...formData, description: (e.target as HTMLInputElement).value })}
            />

            <div className="flex gap-3 pt-4 border-t border-border mt-6">
                <UiButton type="button" variant="ghost" className="flex-1" onClick={onCancel}>
                    Cancel
                </UiButton>
                <UiButton type="submit" variant="primary" className="flex-1" isLoading={isLoading}>
                    {isEdit ? 'Save Changes' : 'Add Transaction'}
                </UiButton>
            </div>
        </form>
    );
};
