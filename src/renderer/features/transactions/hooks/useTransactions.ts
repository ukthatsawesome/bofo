import { useState, useMemo, useEffect } from 'preact/hooks';
import { financeStore } from '@/core/financeStore';
import { api } from '@/core/lib/api';
import { Transaction } from '../../../../shared/types';
import { notify } from '@/core/lib/notify';

export const useTransactions = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [sortField, setSortField] = useState<keyof Transaction>('start_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [stats, setStats] = useState({
    income: 0,
    expense: 0,
    transfers: 0,
    count: 0,
    netFlow: 0,
    savingsRate: 0,
  });

  const allTransactions = financeStore.transactions.value || [];
  const totalTransactions = financeStore.totalTransactions.value || 0;
  const isLoading = financeStore.isLoading.value;

  useEffect(() => {
    if (
      (!financeStore.transactions.value || financeStore.transactions.value.length === 0) &&
      !financeStore.isLoading.value
    ) {
      financeStore.loadAll();
    }
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const filters: any = {};
        if (filterType !== 'all') filters.type = filterType;
        if (filterMonth) {
          const [year, month] = filterMonth.split('-');
          const start = new Date(parseInt(year), parseInt(month) - 1, 1);
          const end = new Date(parseInt(year), parseInt(month), 0);
          filters.startDate = start.toISOString().split('T')[0];
          filters.endDate = end.toISOString().split('T')[0];
        }

        const data = await api.getTransactionStats(filters);

        const netFlow = data.income - data.expense;
        const savingsRate = data.income > 0 ? (netFlow / data.income) * 100 : 0;

        setStats({
          ...data,
          netFlow,
          savingsRate,
        });
      } catch (e) {
        console.error('Failed to fetch transaction stats', e);
      }
    };

    fetchStats();
  }, [filterType, filterMonth, totalTransactions]);

  const filteredTransactions = useMemo(() => {
    const txns = financeStore.transactions.value || [];
    if (!Array.isArray(txns)) return [];
    return txns.filter((t) => {
      if (filterType !== 'all' && t.type !== filterType) return false;

      if (filterMonth) {
        if (!t.start_date.startsWith(filterMonth)) return false;
      }

      return true;
    });
  }, [financeStore.transactions.value, filterType, filterMonth]);

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (valA === valB) return 0;

      const comparison = valA! > valB! ? 1 : -1;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredTransactions, sortField, sortOrder]);

  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedTransactions.slice(start, start + pageSize);
  }, [sortedTransactions, page, pageSize]);

  const totalPages = Math.ceil(
    (filterType === 'all' && !filterMonth
      ? financeStore.totalTransactions.value || 0
      : filteredTransactions.length) / pageSize
  );

  const deleteTransaction = async (id: number) => {
    const confirmed = await notify.confirm(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      'warning'
    );
    if (!confirmed) return;
    await financeStore.deleteTransaction(id);
    notify.success('Transaction Deleted', 'Transaction has been removed');
  };

  return {
    transactions: paginatedTransactions,
    allTransactions: sortedTransactions, // For export or charts if needed
    stats,
    isLoading: financeStore.isLoading.value,

    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    totalCount:
      filterType === 'all' && !filterMonth ? totalTransactions : filteredTransactions.length,

    filterType,
    setFilterType,
    filterMonth,
    setFilterMonth,

    sortField,
    setSortField,
    sortOrder,
    setSortOrder,

    selectedIds,
    setSelectedIds,

    deleteTransaction,
    refresh: financeStore.loadAll,
  };
};
