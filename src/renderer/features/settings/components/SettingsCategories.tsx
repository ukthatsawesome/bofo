import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import { financeStore } from '@/core/financeStore';
import { UiButton } from '@/components/ui/UiButton';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { UiSelect } from '@/components/ui/UiSelect';
import { Plus, Edit2, Trash2, Archive, ArchiveRestore } from 'lucide-preact';
import { IconButton } from '@/components/ui/IconButton';
import { Category } from '../../../../shared/types';
import { clsx } from 'clsx';
import { SectionTitle, Caption } from '@/components/ui/Typography';
import { useSortedData } from '@/hooks/useSortedData';
import { notify } from '@/core/lib/notify';

export const SettingsCategories = () => {
    const categories = financeStore.categories.value;
    const isLoading = financeStore.isLoading.value;

    const { sortedData, sortColumn, sortDirection, handleSort } = useSortedData({
        data: categories,
        initialSortColumn: 'name'
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Partial<Category> | undefined>(undefined);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: 'expense',
    });

    const handleEdit = (cat: Category) => {
        setEditingCategory(cat);
        setFormData({
            name: cat.name,
            type: cat.type
        });
        setIsModalOpen(true);
    };

    const handleNew = () => {
        setEditingCategory(undefined);
        setFormData({ name: '', type: 'expense' });
        setIsModalOpen(true);
    };

    const handleSave = async (e: Event) => {
        e.preventDefault();
        try {
            if (editingCategory?.id) {
                await (window as any).api.updateCategory({ ...formData, id: editingCategory.id });
                notify.success('Category Updated', 'Category has been saved');
            } else {
                await (window as any).api.addCategory(formData);
                notify.success('Category Created', 'New category has been added');
            }
            await financeStore.loadAll();
            setIsModalOpen(false);
        } catch (error: any) {
            console.error(error);
            notify.error('Save Failed', error.message || 'Failed to save category');
        }
    };

    const handleDelete = async (id: number) => {
        const confirmed = await notify.confirm('Delete Category', 'Are you sure you want to delete this category?', 'warning');
        if (!confirmed) return;

        try {
            await (window as any).api.deleteCategory(id);
            await financeStore.loadAll();
            notify.success('Category Deleted', 'Category has been removed');
        } catch (error: any) {
            notify.error('Delete Failed', error.message);
        }
    };

    const handleArchive = async (id: number, isArchived: boolean) => {
        if (isArchived) {
            await (window as any).api.unarchiveCategory(id);
        } else {
            await (window as any).api.archiveCategory(id);
        }
        await financeStore.loadAll();
    };

    const columns: Column<Category>[] = [
        {
            header: 'Name',
            accessor: 'name',
            sortable: true,
            className: 'font-medium text-text-primary'
        },
        {
            header: 'Type',
            accessor: (c) => (
                <span className={clsx(
                    "px-2 py-0.5 rounded text-xs font-semibold capitalize",
                    c.type === 'income' ? "bg-success/10 text-success" :
                        c.type === 'expense' ? "bg-surface-active text-text-muted" :
                            "bg-info/10 text-info"
                )}>
                    {c.type}
                </span>
            ),
            sortable: true,
            sortKey: 'type'
        },
        {
            header: 'Actions',
            accessor: (c) => (
                <div className="flex gap-1 justify-end">
                    <IconButton icon={Edit2} variant="primary" tooltip="Edit" onClick={() => handleEdit(c)} />
                    <IconButton
                        icon={c.status === 'archived' ? ArchiveRestore : Archive}
                        variant="ghost"
                        tooltip={c.status === 'archived' ? 'Restore' : 'Archive'}
                        onClick={() => handleArchive(c.id, c.status === 'archived')}
                    />
                    <IconButton icon={Trash2} variant="danger" tooltip="Delete" onClick={() => handleDelete(c.id)} />
                </div>
            ),
            className: 'text-right'
        }
    ];

    const types = [
        { label: 'Expense', value: 'expense' },
        { label: 'Income', value: 'income' },
        { label: 'Transfer', value: 'transfer' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <SectionTitle>Categories</SectionTitle>
                    <Caption className="mt-1">Organize your transaction types</Caption>
                </div>
                <UiButton icon={<Plus size={18} />} onClick={handleNew}>Add Category</UiButton>
            </div>

            <DataTable
                data={sortedData}
                columns={columns}
                keyField="id"
                isLoading={isLoading}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
            />

            {/* @ts-ignore */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCategory ? "Edit Category" : "New Category"}>
                <form onSubmit={handleSave} className="space-y-4">
                    <Input
                        label="Category Name"
                        value={formData.name}
                        onInput={(e) => setFormData({ ...formData, name: (e.target as HTMLInputElement).value })}
                        required
                    />

                    <UiSelect
                        label="Type"
                        options={types}
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: (e.target as HTMLSelectElement).value })}
                    />

                    <div className="flex justify-end pt-4">
                        <UiButton type="submit">Save Category</UiButton>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
