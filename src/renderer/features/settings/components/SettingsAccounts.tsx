import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import { financeStore } from '@/core/financeStore';
import { UiButton } from '@/components/ui/UiButton';
import { UiCard } from '@/components/ui/UiCard';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { UiSelect } from '@/components/ui/UiSelect';
import { Plus, Edit2, Trash2, Archive, ArchiveRestore, Wallet } from 'lucide-preact';
import { IconButton } from '@/components/ui/IconButton';
import { formatCurrency } from '@/utils/format';
import { Account } from '../../../../shared/types';
import { clsx } from 'clsx';

export const SettingsAccounts = () => {
    const accounts = financeStore.accounts.value;
    const isLoading = financeStore.isLoading.value;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Partial<Account> | undefined>(undefined);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: 'bank',
        initial_balance: '0',
        currency: 'USD'
    });

    const handleEdit = (acc: Account) => {
        setEditingAccount(acc);
        setFormData({
            name: acc.name,
            type: acc.type,
            initial_balance: acc.initial_balance.toString(),
            currency: acc.currency
        });
        setIsModalOpen(true);
    };

    const handleNew = () => {
        setEditingAccount(undefined);
        setFormData({ name: '', type: 'bank', initial_balance: '0', currency: 'USD' });
        setIsModalOpen(true);
    };

    const handleSave = async (e: Event) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                initial_balance: parseFloat(formData.initial_balance),
                balance: parseFloat(formData.initial_balance) // Initial balance is current balance on creation usually, or backend handles it
            };

            if (editingAccount?.id) {
                await (window as any).api.updateAccount({ ...payload, id: editingAccount.id });
                // We keep balance separate in update if backend supports it, but here we update initial
            } else {
                await (window as any).api.addAccount(payload);
            }
            await financeStore.loadAll();
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            alert('Failed to save account');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure? This will unlink transactions.')) return;
        await (window as any).api.deleteAccount(id);
        await financeStore.loadAll();
    };

    const handleArchive = async (id: number, isArchived: boolean) => {
        if (isArchived) {
            await (window as any).api.unarchiveAccount(id);
        } else {
            await (window as any).api.archiveAccount(id);
        }
        await financeStore.loadAll();
    };

    const columns: Column<Account>[] = [
        {
            header: 'Name',
            accessor: (a) => (
                <div className="font-medium text-text-primary">{a.name}</div>
            )
        },
        {
            header: 'Type',
            accessor: (a) => <span className="capitalize">{a.type.replace('_', ' ')}</span>
        },
        {
            header: 'Currency',
            accessor: 'currency',
            className: 'text-xs text-text-muted'
        },
        {
            header: 'Balance',
            accessor: (a) => (
                <span className={a.balance < 0 ? 'text-danger' : 'text-success'}>
                    {formatCurrency(a.balance, a.currency)}
                </span>
            )
        },
        {
            header: 'Status',
            accessor: (a) => (
                <span className={clsx(
                    "px-2 py-0.5 rounded text-xs",
                    a.status === 'archived' ? "bg-surface-active text-text-muted" : "bg-success/10 text-success"
                )}>
                    {a.status === 'archived' ? 'Archived' : 'Active'}
                </span>
            )
        },
        {
            header: 'Actions',
            accessor: (a) => (
                <div className="flex gap-1 justify-end">
                    <IconButton icon={Edit2} variant="primary" tooltip="Edit" onClick={() => handleEdit(a)} />
                    <IconButton
                        icon={a.status === 'archived' ? ArchiveRestore : Archive}
                        variant="ghost"
                        tooltip={a.status === 'archived' ? 'Restore' : 'Archive'}
                        onClick={() => handleArchive(a.id, a.status === 'archived')}
                    />
                    <IconButton icon={Trash2} variant="danger" tooltip="Delete" onClick={() => handleDelete(a.id)} />
                </div>
            ),
            className: 'text-right'
        }
    ];

    const accountTypes = [
        { label: 'Bank Account', value: 'bank' },
        { label: 'Wallet', value: 'wallet' },
        { label: 'Credit Card', value: 'credit_card' },
        { label: 'Loan', value: 'loan' },
        { label: 'Investment', value: 'investment' },
    ];

    return (
        <div className="space-y-6">
            <UiCard
                title={undefined} // Title handled by page header, or we can use it here if we want a sub-card
                className="overflow-hidden"
                actions={
                    <UiButton icon={<Plus size={18} />} onClick={handleNew} variant="primary" size="sm">
                        Add Account
                    </UiButton>
                }
            >
                <DataTable
                    data={accounts}
                    columns={columns}
                    keyField="id"
                    isLoading={isLoading}
                    emptyMessage="No accounts connected. Add one to get started!"
                />
            </UiCard>

            {/* @ts-ignore */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAccount ? "Edit Account" : "New Account"}>
                <form onSubmit={handleSave} className="space-y-4">
                    <Input
                        label="Account Name"
                        value={formData.name}
                        onInput={(e) => setFormData({ ...formData, name: (e.target as HTMLInputElement).value })}
                        required
                    />

                    <UiSelect
                        label="Type"
                        options={accountTypes}
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: (e.target as HTMLSelectElement).value })}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Initial Balance"
                            type="number"
                            step="0.01"
                            value={formData.initial_balance}
                            onInput={(e) => setFormData({ ...formData, initial_balance: (e.target as HTMLInputElement).value })}
                            required
                        />
                        <Input
                            label="Currency"
                            value={formData.currency}
                            onInput={(e) => setFormData({ ...formData, currency: (e.target as HTMLInputElement).value })}
                            required
                            placeholder="USD"
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <UiButton type="submit">Save Account</UiButton>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
