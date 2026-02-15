
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { UiStatCard } from '@/components/ui/UiStatCard';
import { DataTable, Column } from '@/components/ui/DataTable';
import { financeStore } from '@/core/financeStore';
import { UiButton } from '@/components/ui/UiButton';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { TransactionForm } from './components/TransactionForm';
import { Plus, Filter, Wallet, TrendingUp, TrendingDown, ArrowRightLeft, Target } from 'lucide-preact';
import { formatCurrency, formatNumber, getCurrencyCode } from '@/utils/format';
import { Transaction } from '../../../shared/types';
import { clsx } from 'clsx';
import { ViewLayout } from '@/components/layout/ViewLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { UiCard } from '@/components/ui/UiCard';

export const TransactionsPage = () => {
    const {
        transactions,
        stats,
        isLoading,
        page,
        setPage,
        totalPages,
        totalCount,
        filterType,
        setFilterType,
        filterMonth,
        setFilterMonth,
        deleteTransaction,
        refresh
    } = useTransactions();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<Partial<Transaction> | undefined>(undefined);

    const handleEdit = (tx: Transaction) => {
        setEditingTx(tx);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingTx(undefined);
        setIsModalOpen(true);
    };

    const handleSave = async (data: any) => {
        try {
            if (editingTx?.id) {
                await financeStore.updateTransaction(editingTx.id, data);
            } else {
                await financeStore.addTransaction(data);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to save transaction:", error);
            // Optional: keep modal open or show error within modal
        }
    };

    const columns: Column<Transaction>[] = [
        {
            header: 'Date',
            accessor: 'start_date',
            className: 'w-32 font-mono text-xs text-text-muted'
        },
        {
            header: 'Description',
            accessor: (t) => (
                <div>
                    <div className="font-medium text-text-primary">{t.description || 'No Description'}</div>
                    <div className="text-xs text-text-muted">{t.account_name}</div>
                </div>
            )
        },
        {
            header: 'Category',
            accessor: (t) => {
                const mapType = (type: string) => {
                    if (type === 'income') return 'success';
                    if (type === 'expense') return 'neutral'; // or 'default'
                    if (type === 'transfer') return 'info';
                    return 'neutral';
                };

                return (
                    <StatusBadge status={mapType(t.type) as any} variant="soft">
                        {t.category_name}
                    </StatusBadge>
                );
            }
        },
        {
            header: 'Amount',
            accessor: (t) => {
                const sign = t.type === 'expense' ? '-' : t.type === 'income' ? '+' : '';
                return (
                    <span className={clsx(
                        "font-mono font-medium",
                        t.type === 'income' ? "text-success" :
                            t.type === 'expense' ? "text-text-primary" : "text-info"
                    )}>
                        {sign}{formatCurrency(t.amount, t.currency)}
                    </span>
                );
            }
        },
        {
            header: 'Action',
            accessor: (t) => (
                <div className="flex gap-2 justify-end">
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(t); }} className="text-text-muted hover:text-brand-primary text-xs font-medium transition-colors">Edit</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteTransaction(t.id); }} className="text-text-muted hover:text-danger text-xs font-medium transition-colors">Delete</button>
                </div>
            ),
            className: 'text-right'
        }
    ];

    const Actions = (
        <div className="flex gap-3">
            <Input
                type="month"
                className="w-40 bg-white/50 backdrop-blur-sm"
                value={filterMonth}
                onInput={(e) => setFilterMonth((e.target as HTMLInputElement).value)}
            />
            <UiButton variant="primary" icon={<Plus size={18} />} onClick={handleAdd} className="whitespace-nowrap">Add Transaction</UiButton>
        </div>
    );

    return (
        <ViewLayout
            title="Transactions"
            actions={Actions}
            isLoading={isLoading && transactions.length === 0}
            className="h-full"
        >
            <div className="space-y-6">
                {/* Stats Grid - Bento Style */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <UiStatCard
                        label="Income"
                        value={formatNumber(stats.income)}
                        icon={TrendingUp}
                        color="success"
                        currency={getCurrencyCode()}
                    />
                    <UiStatCard
                        label="Expenses"
                        value={formatNumber(stats.expense)}
                        icon={TrendingDown}
                        color="danger"
                        currency={getCurrencyCode()}
                    />
                    <UiStatCard
                        label="Net Flow"
                        value={formatNumber(stats.netFlow)}
                        icon={Target}
                        color={stats.netFlow >= 0 ? "success" : "danger"}
                        currency={getCurrencyCode()}
                    />
                    <UiStatCard
                        label="Savings Rate"
                        value={`${stats.savingsRate.toFixed(1)}%`}
                        icon={Wallet}
                        color="info"
                    // Percentage doesn't need currency
                    />
                </div>

                {/* Main Table Card */}
                <UiCard variant="flat" className="overflow-hidden p-0 border-0 bg-transparent">
                    {/* Toolbar */}
                    <div className="pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex bg-surface-active p-1 rounded-xl">
                            {['all', 'income', 'expense', 'transfer'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setFilterType(type)}
                                    className={clsx(
                                        "px-4 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all",
                                        filterType === type
                                            ? "bg-surface-card shadow-sm text-text-primary"
                                            : "text-text-muted hover:text-text-primary"
                                    )}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                        <div className="text-xs text-text-muted font-medium">
                            Showing {transactions.length} of {totalCount}
                        </div>
                    </div>

                    <div className="bg-surface-card rounded-2xl border border-border shadow-sm overflow-hidden">
                        <DataTable
                            data={transactions}
                            columns={columns}
                            keyField="id"
                            isLoading={isLoading}
                            onRowClick={handleEdit}
                            emptyMessage="No transactions found matching your filters."
                        />

                        {/* Pagination */}
                        <div className="px-5 py-4 border-t border-border flex items-center justify-between bg-surface-base/50">
                            <UiButton
                                variant="secondary"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage(page - 1)}
                            >
                                Previous
                            </UiButton>
                            <span className="text-text-muted text-sm font-medium">Page {page} of {totalPages || 1}</span>
                            <UiButton
                                variant="secondary"
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => setPage(page + 1)}
                            >
                                Next
                            </UiButton>
                        </div>
                    </div>
                </UiCard>

                {/* @ts-ignore */}
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTx ? "Edit Transaction" : "New Transaction"}>
                    <TransactionForm
                        initialData={editingTx}
                        onSubmit={handleSave}
                        onCancel={() => setIsModalOpen(false)}
                    />
                </Modal>
            </div>
        </ViewLayout>
    );
};
