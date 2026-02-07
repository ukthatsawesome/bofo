import { h } from 'preact';
import { Trash2, ClipboardList } from 'lucide-preact';
import { formatCurrency } from '@/utils/format';
import { PlannedItem } from '@/features/sandbox/hooks/useSandbox';
import { clsx } from 'clsx';
import { financeStore } from '@/core/financeStore';

interface PlannedItemsTableProps {
    items: PlannedItem[];
    onRemove: (id: string) => void;
}

export const PlannedItemsTable = ({ items, onRemove }: PlannedItemsTableProps) => {
    if (items.length === 0) {
        return (
            <div className="p-12 text-center border-2 border-dashed border-border rounded-xl">
                <div className="w-16 h-16 bg-surface-active rounded-full flex items-center justify-center mx-auto mb-4 text-text-muted">
                    <ClipboardList size={32} />
                </div>
                <h3 className="text-lg font-bold text-text-primary">No planned items</h3>
                <p className="text-text-muted">Add expenses or income to see how they affect your finances.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left bg-surface-card overflow-hidden">
                <thead className="bg-surface-base/50 text-xs font-bold uppercase text-text-muted border-b border-border">
                    <tr>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Account</th>
                        <th className="px-4 py-3">Frequency</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {items.map((item: any) => {
                        const account = financeStore.accounts.value.find((a: any) => a.id === item.account_id);
                        const isIncome = item.type === 'income';

                        return (
                            <tr key={item.id} className="hover:bg-surface-hover transition-colors">
                                <td className="px-4 py-3">
                                    <div className="font-bold text-text-primary">{item.description}</div>
                                </td>
                                <td className="px-4 py-3 text-sm text-text-muted">{item.category}</td>
                                <td className="px-4 py-3 text-sm text-text-muted">{account?.name || 'Unknown'}</td>
                                <td className="px-4 py-3">
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface-active text-text-muted capitalize">
                                        {item.frequency === 'once' ? 'One-time' : item.frequency}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-text-muted">{item.start_date}</td>
                                <td className={clsx(
                                    "px-4 py-3 text-right font-bold text-sm",
                                    isIncome ? "text-success" : "text-danger"
                                )}>
                                    {isIncome ? '+' : '-'}{formatCurrency(item.amount)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button
                                        onClick={() => onRemove(item.id)}
                                        className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                                        title="Remove item"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
