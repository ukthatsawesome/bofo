import { h } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { UiButton } from '@/components/ui/UiButton';
import { Input } from '@/components/ui/Input';
import { UiSelect } from '@/components/ui/UiSelect';
import { financeStore } from '@/core/financeStore';
import { Transaction } from '../../../../shared/types';
import { Calendar, DollarSign, FileText, Tag, Wallet, Check, Plus } from 'lucide-preact';
import { ToggleButtonGroup } from '@/components/ui/ToggleButtonGroup';
import { notify } from '@/core/lib/notify';

interface TransactionFormProps {
  initialData?: Partial<Transaction>;
  onSubmit: (data: any) => Promise<void>;
  onCancel?: () => void;
}

type TransactionType = 'income' | 'expense' | 'transfer';

interface FormState {
  amount: string;
  description: string;
  date: string;
  category_id: string;
  category_name: string;
  account_id: string;
  to_account_id: string;
}

export const TransactionForm = ({ initialData, onSubmit, onCancel }: TransactionFormProps) => {
  const isEdit = !!initialData?.id;
  const [isLoading, setIsLoading] = useState(false);
  const [type, setType] = useState<TransactionType>(
    (initialData?.type as TransactionType) || 'expense'
  );

  const accountOptions = useMemo(
    () =>
      financeStore.activeAccounts.value.map((a: { name: string; id: number }) => ({
        label: a.name,
        value: String(a.id),
      })),
    [financeStore.activeAccounts.value]
  );

  const categoryOptions = useMemo(
    () =>
      financeStore.categories.value
        .filter((c: { type: string }) => c.type === type)
        .map((c: { name: string; id: number }) => ({
          label: c.name,
          value: String(c.id),
        })),
    [financeStore.categories.value, type]
  );

  const [formData, setFormData] = useState<FormState>({
    amount: initialData?.amount?.toString() || '',
    description: initialData?.description || '',
    date: initialData?.start_date || new Date().toISOString().split('T')[0],
    category_id: initialData?.category_id ? String(initialData.category_id) : '',
    category_name: initialData?.category_name || initialData?.category || '',
    account_id: initialData?.account_id ? String(initialData.account_id) : '',
    to_account_id: initialData?.to_account_id ? String(initialData.to_account_id) : '',
  });

  useEffect(() => {
    if (initialData?.id) {
      setFormData({
        amount: initialData.amount?.toString() || '',
        description: initialData.description || '',
        date: initialData.start_date || new Date().toISOString().split('T')[0],
        category_id: initialData.category_id ? String(initialData.category_id) : '',
        category_name: initialData.category_name || initialData.category || '',
        account_id: initialData.account_id ? String(initialData.account_id) : '',
        to_account_id: initialData.to_account_id ? String(initialData.to_account_id) : '',
      });
      setType(initialData.type as TransactionType);
    }
  }, [initialData?.id]);

  const isInitialTypeSet = useState({ current: true })[0];
  useEffect(() => {
    if (isInitialTypeSet.current) {
      isInitialTypeSet.current = false;
      return;
    }
    setFormData((prev) => ({
      ...prev,
      category_id: '',
    }));
  }, [type]);

  const handleFieldChange = (field: keyof FormState) => (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    setFormData((prev) => ({ ...prev, [field]: target.value }));
  };

  const handleAccountChange = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    const newAccountId = target.value;

    setFormData((prev) => ({
      ...prev,
      account_id: newAccountId,
      to_account_id: prev.to_account_id === newAccountId ? '' : prev.to_account_id,
    }));
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      notify.error('Invalid Amount', 'Please enter a valid positive amount');
      return;
    }
    if (!formData.account_id) {
      notify.error('Account Required', 'Please select an account');
      return;
    }
    if (type === 'transfer') {
      if (!formData.to_account_id) {
        notify.error('Destination Required', 'Please select a destination account for transfer');
        return;
      }
      if (formData.account_id === formData.to_account_id) {
        notify.error('Invalid Transfer', 'Source and destination accounts cannot be the same');
        return;
      }
    } else {
      if (!formData.category_id) {
        notify.error('Category Required', 'Please select a category');
        return;
      }
    }

    setIsLoading(true);
    try {
      const payload: any = {
        type,
        amount: amt,
        description: formData.description,
        start_date: formData.date,
        account_id: Number(formData.account_id),
        to_account_id: type === 'transfer' ? Number(formData.to_account_id) : undefined,
        category_id: type !== 'transfer' ? Number(formData.category_id) : undefined,
        category:
          type !== 'transfer'
            ? categoryOptions.find((c) => c.value === formData.category_id)?.label ||
              formData.category_name ||
              'Uncategorized'
            : 'Transfer',
      };

      await onSubmit(payload);
    } catch (error) {
      console.error(error);
      notify.error('Save Failed', 'Failed to save transaction. Please try again.');
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
          { value: 'transfer', label: 'Transfer' },
        ]}
        value={type}
        onChange={(v) => setType(v as TransactionType)}
        variant="primary"
        className="mb-6 bg-surface-card border border-border [&>button]:flex-1"
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Amount"
          icon={DollarSign}
          type="number"
          step="0.01"
          required
          value={formData.amount}
          onChange={handleFieldChange('amount')}
        />
        <Input
          label="Date"
          icon={Calendar}
          type="date"
          required
          value={formData.date}
          onChange={handleFieldChange('date')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <UiSelect
          label="Account"
          icon={Wallet}
          options={accountOptions}
          value={formData.account_id}
          onChange={handleAccountChange}
          required
        />

        {type === 'transfer' ? (
          <UiSelect
            label="To Account"
            icon={Wallet}
            options={accountOptions.filter((a) => a.value !== formData.account_id)}
            value={formData.to_account_id}
            onChange={handleFieldChange('to_account_id')}
            required
          />
        ) : (
          <UiSelect
            label="Category"
            icon={Tag}
            options={categoryOptions}
            value={formData.category_id}
            onChange={handleFieldChange('category_id')}
            required
          />
        )}
      </div>

      <Input
        label="Description"
        icon={FileText}
        placeholder="Description"
        value={formData.description}
        onChange={handleFieldChange('description')}
      />

      <div className="flex gap-3 pt-4 border-t border-border mt-6">
        {onCancel && (
          <UiButton type="button" variant="ghost" className="flex-1" onClick={onCancel}>
            Cancel
          </UiButton>
        )}
        <UiButton
          type="submit"
          variant="primary"
          className={onCancel ? 'flex-1' : 'w-full'}
          isLoading={isLoading}
          icon={isEdit ? <Check size={18} /> : <Plus size={18} />}
        >
          {isEdit ? 'Save Changes' : 'Add Transaction'}
        </UiButton>
      </div>
    </form>
  );
};
