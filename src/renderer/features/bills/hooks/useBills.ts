import { useState, useEffect, useCallback } from 'preact/hooks';
import { billReadings, billTypes, isLoading, actions } from '@/core/financeStore';
import { api } from '@/core/lib/api';
import { formatCurrency } from '@/utils/format';
import { notify } from '@/core/lib/notify';

export const useBills = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    isLoading.value = true;
    try {
      const [types, readings] = await Promise.all([
        api.getBillTypes(),
        api.getBillReadings({ year: new Date().getFullYear(), month: 0 }),
      ]);

      actions.setBillTypes(types || []);
      actions.setBillReadings(readings || []);
    } catch (error) {
      console.error('Failed to load bills:', error);
    } finally {
      isLoading.value = false;
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const deleteReading = async (id: number) => {
    const confirmed = await notify.confirm(
      'Delete Reading',
      'Are you sure you want to delete this bill reading?',
      'warning'
    );
    if (!confirmed) return;
    try {
      await api.deleteBillReading(id);
      await refreshData();
      notify.success('Reading Deleted', 'Bill reading has been removed');
    } catch (err: any) {
      console.error(err);
      notify.error('Delete Failed', err.message);
    }
  };

  const enrichedReadings = billReadings.value.map((reading) => {
    const type = billTypes.value.find((t) => t.id === reading.bill_type_id);
    return {
      ...reading,
      amount: reading.total_cost, // Aliasing for UI consistency if desired, or just use total_cost
      bill_name: type?.name || 'Unknown Bill',
      icon: type?.icon,
      color: type?.color,
    };
  });

  const stats = {
    totalCost: billReadings.value.reduce((sum, r) => sum + r.total_cost, 0),
    count: billReadings.value.length,
    avgCost:
      billReadings.value.length > 0
        ? billReadings.value.reduce((sum, r) => sum + r.total_cost, 0) / billReadings.value.length
        : 0,
  };

  const addReading = async (data: any) => {
    try {
      await api.addBillReading(data);
      await refreshData();
    } catch (err) {
      console.error('Failed to add reading:', err);
    }
  };

  const updateReading = async (id: number, data: any) => {
    try {
      await api.updateBillReading(id, data);
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
    updateReading,
  };
};
