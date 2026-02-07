import { useState, useEffect, useCallback } from 'preact/hooks';
import { billReadings, billTypes, isLoading, actions } from '@/core/financeStore';
import { formatCurrency } from '@/utils/format';

// This hook bridges the Global Signal Store with local view requirements

export const useBills = () => {
    // Local loading state for specific actions if needed
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Fetch Initial Data
    const refreshData = useCallback(async () => {
        setIsRefreshing(true);
        isLoading.value = true;
        try {
            // Using the global window.api for now (Service Layer to come next)
            const [types, readings] = await Promise.all([
                (window as any).api.getBillTypes(),
                (window as any).api.getBillReadings({ year: new Date().getFullYear(), month: 0 })
            ]);

            actions.setBillTypes(types || []);
            actions.setBillReadings(readings || []);

        } catch (error) {
            console.error("Failed to load bills:", error);
        } finally {
            isLoading.value = false;
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    const deleteReading = async (id: number) => {
        if (!confirm('Are you sure?')) return;
        try {
            await (window as any).api.deleteBillReading(id);
            await refreshData();
        } catch (err) {
            console.error(err);
        }
    };

    // Derived Stats (Calculated on the fly from Signal value)
    const enrichedReadings = billReadings.value.map(reading => {
        const type = billTypes.value.find(t => t.id === reading.bill_type_id);
        return {
            ...reading,
            amount: reading.total_cost, // Aliasing for UI consistency if desired, or just use total_cost
            bill_name: type?.name || 'Unknown Bill',
            icon: type?.icon,
            color: type?.color
        };
    });

    const stats = {
        totalCost: billReadings.value.reduce((sum, r) => sum + r.total_cost, 0),
        count: billReadings.value.length,
        avgCost: billReadings.value.length > 0
            ? billReadings.value.reduce((sum, r) => sum + r.total_cost, 0) / billReadings.value.length
            : 0
    };

    const addReading = async (data: any) => {
        try {
            await (window as any).api.addBillReading(data);
            await refreshData();
        } catch (err) {
            console.error('Failed to add reading:', err);
        }
    };

    const updateReading = async (id: number, data: any) => {
        try {
            await (window as any).api.updateBillReading(id, data);
            await refreshData();
        } catch (err) {
            console.error('Failed to update reading:', err);
        }
    };

    return {
        readings: enrichedReadings,
        billTypes: billTypes.value,
        isLoading: isLoading.value,
        isRefreshing,
        stats,
        refreshData,
        deleteReading,
        addReading,
        updateReading
    };
};
