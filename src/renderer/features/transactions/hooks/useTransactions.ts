import { useState, useMemo, useEffect } from 'preact/hooks';
import { financeStore } from '@/core/financeStore';
import { Transaction } from '../../../../shared/types';

export const useTransactions = () => {
    // Local View State
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filterType, setFilterType] = useState<string>('all');
    const [filterMonth, setFilterMonth] = useState<string>(''); // YYYY-MM
    const [sortField, setSortField] = useState<keyof Transaction>('start_date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Access Global Store
    const allTransactions = financeStore.transactions.value || [];
    const totalTransactions = financeStore.totalTransactions.value || 0;
    const isLoading = financeStore.isLoading.value;

    // Derived: Initial Load
    useEffect(() => {
        if (allTransactions.length === 0 && !isLoading) {
            financeStore.loadAll();
        }
    }, []);

    // Derived: Filtering
    const filteredTransactions = useMemo(() => {
        if (!Array.isArray(allTransactions)) return [];
        return allTransactions.filter(t => {
            // Type Filter
            if (filterType !== 'all' && t.type !== filterType) return false;

            // Month Filter
            if (filterMonth) {
                // Assuming start_date is YYYY-MM-DD
                if (!t.start_date.startsWith(filterMonth)) return false;
            }

            return true;
        });
    }, [allTransactions, filterType, filterMonth]);

    // Derived: Sorting
    const sortedTransactions = useMemo(() => {
        return [...filteredTransactions].sort((a, b) => {
            const valA = a[sortField];
            const valB = b[sortField];

            if (valA === valB) return 0;

            const comparison = valA! > valB! ? 1 : -1;
            return sortOrder === 'asc' ? comparison : -comparison;
        });
    }, [filteredTransactions, sortField, sortOrder]);

    // Derived: Pagination (Local within the 100 items returned)
    const paginatedTransactions = useMemo(() => {
        const start = (page - 1) * pageSize;
        return sortedTransactions.slice(start, start + pageSize);
    }, [sortedTransactions, page, pageSize]);

    const totalPages = Math.ceil((filterType === 'all' && !filterMonth ? totalTransactions : filteredTransactions.length) / pageSize);

    // Derived: Stats (Calculated from filtered view)
    const stats = useMemo(() => {
        const initial = { income: 0, expense: 0, transfers: 0, count: 0 };
        return filteredTransactions.reduce((acc, t) => {
            acc.count++;
            if (t.type === 'income') acc.income += t.amount;
            else if (t.type === 'expense') acc.expense += t.amount;
            else if (t.type === 'transfer') acc.transfers += t.amount;
            return acc;
        }, initial);
    }, [filteredTransactions]);

    const netFlow = stats.income - stats.expense;
    const savingsRate = stats.income > 0 ? ((netFlow / stats.income) * 100) : 0;

    // Actions
    const deleteTransaction = async (id: number) => {
        if (!confirm('Are you sure you want to delete this transaction?')) return;
        financeStore.deleteTransaction(id);
    };

    return {
        // Data
        transactions: paginatedTransactions,
        allTransactions: sortedTransactions, // For export or charts if needed
        stats: { ...stats, netFlow, savingsRate },
        isLoading,

        // Pagination
        page,
        setPage,
        pageSize,
        setPageSize,
        totalPages,
        totalCount: filterType === 'all' && !filterMonth ? totalTransactions : filteredTransactions.length,

        // Filters
        filterType,
        setFilterType,
        filterMonth,
        setFilterMonth,

        // Sorting
        sortField,
        setSortField,
        sortOrder,
        setSortOrder,

        // Selection
        selectedIds,
        setSelectedIds,

        // Actions
        deleteTransaction,
        refresh: financeStore.loadAll
    };
};
