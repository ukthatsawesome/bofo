import { useState, useMemo } from 'preact/hooks';
import { financeStore } from '@/core/financeStore';
import { RecurringCharge } from '../../../../shared/types';
import { notify } from '@/core/lib/notify';

export function useRecurring() {
    const { recurringCharges, isLoading } = financeStore;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCharge, setEditingCharge] = useState<RecurringCharge | null>(null);
    const [sortConfig, setSortConfig] = useState<{ field: keyof RecurringCharge, direction: 'asc' | 'desc' }>({
        field: 'name',
        direction: 'asc'
    });

    const monthlyTotal = useMemo(() => {
        return recurringCharges.value.reduce((total, charge) => {
            if (!charge.is_active) return total;

            if (charge.frequency === 'monthly') return total + charge.amount;
            if (charge.frequency === 'weekly') return total + (charge.amount * 4.33); // avg weeks in month
            if (charge.frequency === 'yearly') return total + (charge.amount / 12);
            return total;
        }, 0);
    }, [recurringCharges.value]);

    const sortedCharges = useMemo(() => {
        return [...recurringCharges.value].sort((a, b) => {
            let A = a[sortConfig.field];
            let B = b[sortConfig.field];

            if (typeof A === 'string') A = A.toLowerCase();
            if (typeof B === 'string') B = B.toLowerCase();

            if (A === null || A === undefined) return 1;
            if (B === null || B === undefined) return -1;

            if (A < B) return sortConfig.direction === 'asc' ? -1 : 1;
            if (A > B) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [recurringCharges.value, sortConfig]);

    const handleSort = (field: keyof RecurringCharge) => {
        setSortConfig(prev => ({
            field,
            direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const openModal = (charge: RecurringCharge | null = null) => {
        setEditingCharge(charge);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setEditingCharge(null);
        setIsModalOpen(false);
    };

    const saveCharge = async (data: Partial<RecurringCharge>) => {
        try {
            if (editingCharge) {
                await (window as any).api.updateRecurringCharge(editingCharge.id, data);
            } else {
                await (window as any).api.createRecurringCharge(data);
            }
            await financeStore.loadAll(); // Refresh store
            closeModal();
        } catch (error) {
            console.error("Failed to save recurring charge:", error);
            throw error;
        }
    };

    const deleteCharge = async (id: number) => {
        const confirmed = await notify.confirm('Delete Recurring Charge', 'Are you sure you want to delete this recurring charge?', 'warning');
        if (!confirmed) return;

        try {
            await (window as any).api.deleteRecurringCharge(id);
            await financeStore.loadAll();
            notify.success('Charge Deleted', 'Recurring charge has been removed');
        } catch (error: any) {
            console.error("Failed to delete recurring charge:", error);
            notify.error('Delete Failed', error.message);
        }
    };

    const toggleStatus = async (charge: RecurringCharge) => {
        try {
            await (window as any).api.updateRecurringCharge(charge.id, {
                is_active: !charge.is_active
            });
            await financeStore.loadAll();
        } catch (error) {
            console.error("Failed to toggle status:", error);
        }
    };

    return {
        charges: sortedCharges,
        monthlyTotal,
        isLoading: isLoading.value,
        isModalOpen,
        editingCharge,
        sortConfig,
        handleSort,
        openModal,
        closeModal,
        saveCharge,
        deleteCharge,
        toggleStatus
    };
}
