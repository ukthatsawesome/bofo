
import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { UiButton } from '@/components/ui/UiButton';
import { UiSelect } from '@/components/ui/UiSelect';
import { RecurringCharge } from '@/../shared/types';
import { Tag, Calendar, DollarSign, FileText } from 'lucide-preact';

interface RecurringChargeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<RecurringCharge>) => Promise<void>;
    charge: RecurringCharge | null;
}

export const RecurringChargeModal = ({ isOpen, onClose, onSave, charge }: RecurringChargeModalProps) => {
    const [formData, setFormData] = useState<Partial<RecurringCharge>>({
        name: '',
        category: 'Subscriptions',
        amount: 0,
        frequency: 'monthly',
        due_day: 1,
        notes: '',
        is_active: true
    });

    useEffect(() => {
        if (charge) {
            setFormData(charge);
        } else {
            setFormData({
                name: '',
                category: 'Subscriptions',
                amount: 0,
                frequency: 'monthly',
                due_day: 1,
                notes: '',
                is_active: true
            });
        }
    }, [charge, isOpen]);

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        await onSave(formData);
    };

    const categoryOptions = [
        { label: 'Rent', value: 'Rent' },
        { label: 'Utilities', value: 'Utilities' },
        { label: 'Subscriptions', value: 'Subscriptions' },
        { label: 'Insurance', value: 'Insurance' },
        { label: 'Loan', value: 'Loan' },
        { label: 'Other', value: 'Other' }
    ];

    const frequencyOptions = [
        { label: 'Weekly', value: 'weekly' },
        { label: 'Monthly', value: 'monthly' },
        { label: 'Yearly', value: 'yearly' }
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={charge ? "Edit Recurring Charge" : "Add Recurring Charge"}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Name"
                    value={formData.name}
                    onInput={(e) => setFormData({ ...formData, name: (e.target as HTMLInputElement).value })}
                    placeholder="e.g. Netflix, Rent"
                    required
                />

                <div className="grid grid-cols-2 gap-4">
                    <UiSelect
                        label="Category"
                        icon={Tag}
                        options={categoryOptions}
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: (e.target as HTMLSelectElement).value })}
                    />
                    <Input
                        label="Amount"
                        type="number"
                        icon={DollarSign}
                        value={formData.amount}
                        onInput={(e) => setFormData({ ...formData, amount: parseFloat((e.target as HTMLInputElement).value) })}
                        step="0.01"
                        min="0"
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <UiSelect
                        label="Frequency"
                        icon={Calendar}
                        options={frequencyOptions}
                        value={formData.frequency}
                        onChange={(e) => setFormData({ ...formData, frequency: (e.target as HTMLSelectElement).value as any })}
                    />
                    <Input
                        label="Due Day"
                        type="number"
                        icon={Calendar}
                        value={formData.due_day || 1}
                        onInput={(e) => setFormData({ ...formData, due_day: parseInt((e.target as HTMLInputElement).value) })}
                        min="1"
                        max="31"
                    />
                </div>

                <Input
                    label="Notes"
                    icon={FileText}
                    value={formData.notes || ''}
                    onInput={(e) => setFormData({ ...formData, notes: (e.target as HTMLInputElement).value })}
                    placeholder="Optional notes"
                />

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <UiButton type="button" onClick={onClose} variant="ghost">Cancel</UiButton>
                    <UiButton type="submit" variant="primary">Save Charge</UiButton>
                </div>
            </form>
        </Modal>
    );
};
