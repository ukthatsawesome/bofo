import { h } from 'preact';
import { useState } from 'preact/hooks';
import { financeStore } from '@/core/financeStore';
import { UiButton } from '@/components/ui/UiButton';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { UiSelect } from '@/components/ui/UiSelect';
import { Plus, Edit2, Trash2, Zap, Droplet, Flame, Wifi, Phone, FileText } from 'lucide-preact';
import { IconButton } from '@/components/ui/IconButton';
import { BillType } from '../../../../shared/types';
import { formatCurrency } from '@/utils/format';
import { clsx } from 'clsx';
import { useSignal } from '@preact/signals';
import { SectionTitle, Caption } from '@/components/ui/Typography';

// Icon mapping helper
const getIcon = (name: string | undefined | null) => {
    switch (name) {
        case 'zap': return Zap;
        case 'droplet': return Droplet;
        case 'flame': return Flame;
        case 'wifi': return Wifi;
        case 'phone': return Phone;
        default: return FileText;
    }
};

export const SettingsBillTypes = () => {
    const billTypes = financeStore.billTypes.value;
    const categories = financeStore.categories.value;
    const accounts = financeStore.accounts.value;
    const isLoading = financeStore.isLoading.value;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<BillType>>({
        name: '',
        unit_name: 'Units',
        cost_per_unit: 0,
        icon: 'file-text',
        category_name: '',
        account_id: undefined,
        auto_transaction: 0
    });

    const handleEdit = (bt: BillType) => {
        setEditingId(bt.id);
        setFormData({
            ...bt,
            // Ensure inputs are valid
            account_id: bt.account_id || undefined,
            category_name: bt.category_name || ''
        });
        setIsModalOpen(true);
    };

    const handleNew = () => {
        setEditingId(null);
        setFormData({
            name: '',
            unit_name: 'Units',
            cost_per_unit: 0,
            icon: 'file-text',
            category_name: '',
            account_id: undefined,
            auto_transaction: 0
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: Event) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name!,
                unit_name: formData.unit_name || 'Units',
                cost_per_unit: Number(formData.cost_per_unit),
                icon: formData.icon,
                category_name: formData.category_name || undefined,
                account_id: formData.account_id ? Number(formData.account_id) : undefined,
                auto_transaction: formData.auto_transaction ? 1 : 0
            };

            if (editingId) {
                await (window as any).api.updateBillType({ id: editingId, data: payload });
            } else {
                await (window as any).api.addBillType(payload);
            }
            await financeStore.loadAll();
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            alert('Failed to save bill type');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this bill type?')) return;
        await (window as any).api.deleteBillType(id);
        await financeStore.loadAll();
    };

    const columns: Column<BillType>[] = [
        {
            header: 'Name',
            accessor: (bt) => {
                const IconComp = getIcon(bt.icon);
                return (
                    <div className="flex items-center gap-2 font-medium text-text-primary">
                        <IconComp size={16} className={clsx("text-brand-primary")} />
                        {bt.name}
                    </div>
                );
            }
        },
        {
            header: 'Unit',
            accessor: 'unit_name',
            className: 'text-text-muted text-sm'
        },
        {
            header: 'Cost/Unit',
            accessor: (bt) => formatCurrency(bt.cost_per_unit, bt.currency)
        },
        {
            header: 'Category / Account',
            accessor: (bt) => {
                const acc = accounts.find(a => a.id === bt.account_id);
                return (
                    <div className="text-xs text-text-muted">
                        <div>{bt.category_name || '—'}</div>
                        {acc && <div>via {acc.name}</div>}
                    </div>
                );
            }
        },
        {
            header: 'Auto-Tx',
            accessor: (bt) => (
                <span className={clsx(
                    "px-2 py-0.5 rounded text-xs font-semibold",
                    bt.auto_transaction ? "bg-success/10 text-success" : "bg-surface-active text-text-muted"
                )}>
                    {bt.auto_transaction ? 'Enabled' : 'Disabled'}
                </span>
            )
        },
        {
            header: 'Actions',
            accessor: (bt) => (
                <div className="flex gap-1 justify-end">
                    <IconButton icon={Edit2} variant="primary" tooltip="Edit" onClick={() => handleEdit(bt)} />
                    <IconButton icon={Trash2} variant="danger" tooltip="Delete" onClick={() => handleDelete(bt.id)} />
                </div>
            ),
            className: 'text-right'
        }
    ];

    const iconOptions = [
        { label: '⚡ Electricity', value: 'zap' },
        { label: '💧 Water', value: 'droplet' },
        { label: '🔥 Gas', value: 'flame' },
        { label: '📶 Internet', value: 'wifi' },
        { label: '📱 Phone', value: 'phone' },
        { label: '📄 Other', value: 'file-text' },
    ];

    // Filter for expense categories only
    const categoryOptions = [
        { label: '— None —', value: '' },
        ...categories
            .filter(c => c.type === 'expense' && c.status !== 'archived')
            .map(c => ({ label: c.name, value: c.name }))
    ];

    const accountOptions = [
        { label: '— Default Account —', value: '' },
        ...accounts
            .filter(a => a.status === 'active')
            .map(a => ({ label: a.name, value: String(a.id) }))
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <SectionTitle>Bill Types</SectionTitle>
                    <Caption className="mt-1">Configure utility rates and defaults</Caption>
                </div>
                <UiButton icon={<Plus size={18} />} onClick={handleNew}>New Bill Type</UiButton>
            </div>

            <DataTable
                data={billTypes}
                columns={columns}
                keyField="id"
                isLoading={isLoading}
                emptyMessage="No bill types configured."
            />

            {/* @ts-ignore */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Bill Type" : "New Bill Type"}>
                <form onSubmit={handleSave} className="space-y-4">
                    <Input
                        label="Bill Name"
                        value={formData.name}
                        onInput={(e) => setFormData({ ...formData, name: (e.target as HTMLInputElement).value })}
                        required
                        placeholder="e.g. Electricity"
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Unit Name"
                            value={formData.unit_name}
                            onInput={(e) => setFormData({ ...formData, unit_name: (e.target as HTMLInputElement).value })}
                            required
                            placeholder="e.g. kWh"
                        />
                        <Input
                            label="Cost per Unit"
                            type="number"
                            step="0.0001"
                            value={formData.cost_per_unit}
                            onInput={(e) => setFormData({ ...formData, cost_per_unit: (e.target as HTMLInputElement).value ? Number((e.target as HTMLInputElement).value) : 0 })}
                        />
                    </div>

                    <UiSelect
                        label="Icon"
                        options={iconOptions}
                        value={formData.icon || 'file-text'}
                        onChange={(e) => setFormData({ ...formData, icon: (e.target as HTMLSelectElement).value })}
                    />

                    <UiSelect
                        label="Expense Category (for auto-tx)"
                        options={categoryOptions}
                        value={formData.category_name || ''}
                        onChange={(e) => setFormData({ ...formData, category_name: (e.target as HTMLSelectElement).value })}
                    />

                    <UiSelect
                        label="Default Account"
                        options={accountOptions}
                        value={formData.account_id ? String(formData.account_id) : ''}
                        onChange={(e) => setFormData({ ...formData, account_id: (e.target as HTMLSelectElement).value ? Number((e.target as HTMLSelectElement).value) : undefined })}
                    />

                    <div className="flex items-center gap-3 p-3 bg-surface-hover/50 rounded-lg border border-border/50">
                        <input
                            type="checkbox"
                            id="bt-auto"
                            className="w-4 h-4 rounded border-border"
                            checked={!!formData.auto_transaction}
                            onChange={(e) => setFormData({ ...formData, auto_transaction: (e.target as HTMLInputElement).checked ? 1 : 0 })}
                        />
                        <label htmlFor="bt-auto" className="text-sm font-medium cursor-pointer">
                            Auto-create transaction from readings
                        </label>
                    </div>

                    <div className="flex justify-end pt-4">
                        <UiButton type="submit">Save Bill Type</UiButton>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
