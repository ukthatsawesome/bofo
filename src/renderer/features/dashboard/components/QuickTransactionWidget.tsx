import { h } from 'preact';
import { useState } from 'preact/hooks';
import { DollarSign } from 'lucide-preact';
import { financeStore } from '@/core/financeStore';
import { UiCard } from '@/components/ui/UiCard';
import { TransactionForm } from '@/features/transactions/components/TransactionForm';

interface QuickTransactionWidgetProps {
  className?: string;
}

export const QuickTransactionWidget = ({ className }: QuickTransactionWidgetProps) => {
  const [formKey, setFormKey] = useState(0);

  const handleSubmit = async (data: any) => {
    await financeStore.addTransaction({
      ...data,
      is_active: 1,
    });

    setFormKey((prev) => prev + 1);
  };

  return (
    <UiCard title="Quick Transaction" icon={<DollarSign size={20} />} className={className}>
      <TransactionForm
        key={formKey}
        onSubmit={handleSubmit}
        // No onCancel prop provided, so the button will be hidden
      />
    </UiCard>
  );
};
