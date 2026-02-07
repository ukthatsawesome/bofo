import { h } from 'preact';
import { useState } from 'preact/hooks';
import { DollarSign, Tag, FileText, ArrowRight, Wallet, Calendar } from 'lucide-preact';
import { financeStore } from '@/core/financeStore';
import { UiCard } from '@/components/ui/UiCard';
import { Input } from '@/components/ui/Input';
import { UiSelect } from '@/components/ui/UiSelect';
import { UiButton } from '@/components/ui/UiButton';

// ==================== CONSTANTS ====================

const TRANSACTION_TYPES = ['expense', 'income', 'transfer'] as const;
const DEFAULT_CURRENCY = 'USD';

// ==================== COMPONENT ====================

interface QuickTransactionWidgetProps {
    className?: string;
}

export const QuickTransactionWidget = ({ className }: QuickTransactionWidgetProps) => {
    const [isLoading, setIsLoading] = useState(false);

    // Initialize date once to avoid re-calculation on every render
    const [formData, setFormData] = useState(() => ({
        amount: '',
        description: '',
        categoryId: '',
        accountId: '',
        date: new Date().toISOString().split('T')[0],
        type: 'expense' as typeof TRANSACTION_TYPES[number]
    }));

    // Memoize derived data to prevent unnecessary recalculations if the store triggers re-renders
    const categories = financeStore.categories.value.map(c => ({ label: c.name, value: c.id }));
    const accounts = financeStore.accounts.value.map(a => ({ label: a.name, value: a.id }));

    // Generic handler to reduce repetitive code for input changes
    const handleInputChange = <K extends keyof typeof formData>(field: K) =>
        (e: Event) => {
            const target = e.target as HTMLInputElement | HTMLSelectElement;
            setFormData(prev => ({ ...prev, [field]: target.value }));
        };

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        // Basic validation
        if (!formData.amount || !formData.categoryId || !formData.accountId) return;

        try {
            setIsLoading(true);

            await financeStore.addTransaction({
                amount: parseFloat(formData.amount),
                description: formData.description,
                category_id: parseInt(formData.categoryId, 10),
                account_id: parseInt(formData.accountId, 10),
                start_date: formData.date,
                type: formData.type,
                currency: DEFAULT_CURRENCY,
                is_active: 1
            });

            // Reset only editable fields, preserve type and date if useful, 
            // or reset all as per original behavior.
            // Original logic reset amount and description.
            setFormData(prev => ({ ...prev, amount: '', description: '' }));
        } catch (error) {
            console.error("Failed to add transaction:", error);
            // Ideally show a toast here
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <UiCard title="Quick Transaction" icon={<DollarSign size={20} />} className={className}>
            <form onSubmit={handleSubmit} className="space-y-3">
                {/* Type Toggles */}
                <div className="flex bg-surface-base p-1 rounded-xl">
                    {TRANSACTION_TYPES.map(type => (
                        <button
                            type="button"
                            key={type}
                            onClick={() => setFormData(prev => ({ ...prev, type }))}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${formData.type === type
                                ? 'bg-surface-card shadow-sm text-brand-primary'
                                : 'text-text-muted hover:text-text-primary'
                                }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Input
                        label="Amount"
                        icon={DollarSign}
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={formData.amount}
                        onInput={handleInputChange('amount')}
                        required
                    />
                    <Input
                        label="Date"
                        icon={Calendar}
                        type="date"
                        value={formData.date}
                        onInput={handleInputChange('date')}
                        required
                    />
                </div>

                <Input
                    label="Description"
                    icon={FileText}
                    placeholder="What is this for?"
                    value={formData.description}
                    onInput={handleInputChange('description')}
                />

                <div className="grid grid-cols-2 gap-3">
                    <UiSelect
                        label="Category"
                        icon={Tag}
                        options={categories}
                        placeholder="Select Category"
                        value={formData.categoryId}
                        onChange={handleInputChange('categoryId')}
                        required
                    />
                    <UiSelect
                        label="Account"
                        icon={Wallet}
                        options={accounts}
                        placeholder="Select Account"
                        value={formData.accountId}
                        onChange={handleInputChange('accountId')}
                        required
                    />
                </div>

                <UiButton
                    type="submit"
                    variant="primary"
                    className="w-full mt-4"
                    disabled={isLoading}
                    isLoading={isLoading}
                    icon={<ArrowRight size={16} />}
                >
                    Add Transaction
                </UiButton>
            </form>
        </UiCard>
    );
};