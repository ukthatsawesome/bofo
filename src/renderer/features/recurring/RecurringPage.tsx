import { h } from 'preact';
import {
    Plus, Repeat, Pause, Play, Edit3, Trash2,
    ArrowUpDown, ArrowUp, ArrowDown, Receipt, Info
} from 'lucide-preact';
import { useRecurring } from '@/features/recurring/hooks/useRecurring';
import { UiStatCard } from '@/components/ui/UiStatCard';
import { UiCard } from '@/components/ui/UiCard';
import { UiButton } from '@/components/ui/UiButton';
import { formatCurrency, formatNumber, getCurrencyCode } from '@/utils/format';
import { RecurringChargeModal } from './components/RecurringChargeModal';
import { IconButton } from '@/components/ui/IconButton';
import { clsx } from 'clsx';
import { RecurringCharge } from '../../../shared/types';
import { ViewLayout } from '@/components/layout/ViewLayout';

export const RecurringPage = () => {
    const {
        charges,
        monthlyTotal,
        isLoading,
        isModalOpen,
        editingCharge,
        sortConfig,
        handleSort,
        openModal,
        closeModal,
        saveCharge,
        deleteCharge,
        toggleStatus
    } = useRecurring();

    const SortIcon = ({ field }: { field: keyof RecurringCharge }) => {
        if (sortConfig.field !== field) return <ArrowUpDown size={14} className="opacity-30" />;
        return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
    };

    const HeaderActions = (
        <UiButton
            variant="primary"
            icon={<Plus size={18} />}
            onClick={() => openModal()}
        >
            Add Charge
        </UiButton>
    );

    return (
        <ViewLayout
            title="Recurring Charges"
            subtitle="Manage fixed monthly expenses, subscriptions, and regular bills"
            actions={HeaderActions}
        >
            <div className="space-y-6">

                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <UiStatCard
                            label="Monthly Recurring Burden"
                            value={formatNumber(monthlyTotal)}
                            icon={Receipt}
                            color="danger"
                            currency={getCurrencyCode()}
                        />
                    </div>
                    <UiCard className="flex flex-col justify-center">
                        <div className="flex justify-between items-center">
                            <div className="space-y-1">
                                <span className="text-lg font-bold text-text-primary">{charges.length} Total</span>
                                <p className="text-text-muted text-sm">{charges.filter(c => c.is_active).length} Active Subscriptions</p>
                            </div>
                            <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-primary">
                                <Repeat size={24} />
                            </div>
                        </div>
                    </UiCard>
                </div>

                {/* Table Card */}
                <UiCard className="p-0 overflow-hidden">
                    <div className="p-4 border-b border-border bg-surface-base/10">
                        <h3 className="font-bold text-lg text-text-primary flex items-center gap-2">
                            <Repeat size={20} className="text-brand-primary" /> Active Subscriptions & Bills
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left bg-surface-card capitalize">
                            <thead className="bg-surface-base/50 text-xs font-bold uppercase text-text-muted border-b border-border">
                                <tr>
                                    <th
                                        className="px-6 py-4 cursor-pointer hover:text-text-primary transition-colors"
                                        onClick={() => handleSort('name')}
                                    >
                                        <div className="flex items-center gap-2">Name <SortIcon field="name" /></div>
                                    </th>
                                    <th
                                        className="px-6 py-4 cursor-pointer hover:text-text-primary transition-colors"
                                        onClick={() => handleSort('category')}
                                    >
                                        <div className="flex items-center gap-2">Category <SortIcon field="category" /></div>
                                    </th>
                                    <th
                                        className="px-6 py-4 cursor-pointer hover:text-text-primary transition-colors"
                                        onClick={() => handleSort('frequency')}
                                    >
                                        <div className="flex items-center gap-2">Frequency <SortIcon field="frequency" /></div>
                                    </th>
                                    <th
                                        className="px-6 py-4 cursor-pointer hover:text-text-primary transition-colors text-right"
                                        onClick={() => handleSort('amount')}
                                    >
                                        <div className="flex items-center justify-end gap-2">Amount <SortIcon field="amount" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-text-muted animate-pulse">
                                            Loading recurring charges...
                                        </td>
                                    </tr>
                                ) : charges.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-text-muted opacity-50">
                                            No recurring charges found.
                                        </td>
                                    </tr>
                                ) : (
                                    charges.map((charge) => (
                                        <tr key={charge.id} className={clsx(
                                            "hover:bg-surface-hover transition-colors",
                                            !charge.is_active && "opacity-50 grayscale-[0.5]"
                                        )}>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-text-primary">{charge.name}</div>
                                                {charge.notes && <div className="text-[10px] text-text-muted normal-case mt-0.5">{charge.notes}</div>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-active text-text-muted border border-border">
                                                    {charge.category}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-text-muted">
                                                {charge.frequency} (Day {charge.due_day || 1})
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="font-bold text-danger text-sm">
                                                    {formatCurrency(charge.amount)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center">
                                                    <span className={clsx(
                                                        "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                                        charge.is_active
                                                            ? "bg-success/10 text-success border-success/20"
                                                            : "bg-warning/10 text-warning border-warning/20"
                                                    )}>
                                                        {charge.is_active ? 'Active' : 'Paused'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <IconButton
                                                        icon={charge.is_active ? Pause : Play}
                                                        variant="primary"
                                                        tooltip={charge.is_active ? "Pause" : "Resume"}
                                                        onClick={() => toggleStatus(charge)}
                                                    />
                                                    <IconButton icon={Edit3} variant="ghost" tooltip="Edit" onClick={() => openModal(charge)} />
                                                    <IconButton icon={Trash2} variant="danger" tooltip="Delete" onClick={() => deleteCharge(charge.id)} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </UiCard>

                <div className="flex items-start gap-3 p-4 bg-brand-primary/5 rounded-xl border border-brand-primary/10">
                    <Info size={18} className="text-brand-primary shrink-0 mt-0.5" />
                    <div className="text-xs text-text-muted leading-relaxed">
                        Recurring charges are used by the <strong>Forecast</strong> system to project your future timeline.
                        Adding Netflix, Rent, and Subscriptions here allows for accurate cash flow predictions.
                    </div>
                </div>

                <RecurringChargeModal
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    onSave={saveCharge}
                    charge={editingCharge}
                />
            </div>
        </ViewLayout>
    );
};
