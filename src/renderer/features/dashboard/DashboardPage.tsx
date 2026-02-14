
import { h } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { clsx } from 'clsx';
import { useDashboard } from '@/features/dashboard/hooks/useDashboard';
import { UiStatCard } from '@/components/ui/UiStatCard';
import { UiCard } from '@/components/ui/UiCard';
import { Landmark, Gem, Wallet, TrendingDown, TrendingUp, PieChart, Target, Plus } from 'lucide-preact';
import { formatCurrency } from '@/utils/format';
import { QuickTransactionWidget } from './components/QuickTransactionWidget';
import { AccountsOverview } from './components/AccountsOverview';
import { ViewLayout } from '@/components/layout/ViewLayout';
import { UiButton } from '@/components/ui/UiButton';
import { UiChart } from '@/components/ui/UiChart';
import { getCategoryChartConfig } from '@/components/charts/chartConfigs';
import { Modal } from '@/components/ui/Modal';
import { TransactionForm } from '@/features/transactions/components/TransactionForm';
import { financeStore } from '@/core/financeStore';

export const DashboardPage = () => {
    const { summaryStats, chartData, accounts, transactions, isLoading, insight } = useDashboard();
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

    const handleTransferSave = async (data: any) => {
        await financeStore.addTransaction({ ...data, type: 'transfer' });
        setIsTransferModalOpen(false);
    };

    const Actions = (
        <UiButton variant="primary" icon={<Plus size={18} />} onClick={() => setIsTransferModalOpen(true)}>New Transfer</UiButton>
    );

    // Memoize chart data to prevent unnecessary chart updates/animations
    const chartConfig = useMemo(() => {
        const cd = chartData.value;
        if (!cd) return { labels: [], datasets: [] };
        return {
            labels: cd.labels,
            datasets: [
                {
                    type: 'line' as const,
                    label: 'Net Worth',
                    data: cd.netWorth,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    type: 'bar' as const,
                    label: 'Income',
                    data: cd.income,
                    backgroundColor: '#10b981',
                    borderRadius: 4,
                    yAxisID: 'y1'
                },
                {
                    type: 'bar' as const,
                    label: 'Expenses',
                    data: cd.expenses,
                    backgroundColor: '#ef4444',
                    borderRadius: 4,
                    yAxisID: 'y1'
                }
            ]
        };
    }, [chartData.value]);

    // Compute Top Categories
    const categoryChartConfig = useMemo(() => {
        const txns = transactions.value;
        if (!txns || txns.length === 0) return null;

        const expenses = txns.filter(t => t.type === 'expense');
        const categoryMap = new Map<string, number>();

        expenses.forEach(t => {
            const catName = (t as any).category_name || t.category || 'Uncategorized';
            const current = categoryMap.get(catName) || 0;
            categoryMap.set(catName, current + Math.abs(t.amount));
        });

        const sortedCategories = Array.from(categoryMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        if (sortedCategories.length === 0) return null;

        const config = getCategoryChartConfig();
        config.data = {
            labels: sortedCategories.map(([name]) => name),
            datasets: [{
                data: sortedCategories.map(([, amount]) => amount) as any,
                backgroundColor: [
                    '#ef4444',
                    '#f97316',
                    '#f59e0b',
                    '#84cc16',
                    '#10b981',
                ],
                borderWidth: 1,
            }]
        };
        return config;
    }, [transactions.value]);

    // Compute Budget Status (Expenses vs Income Ratio)
    const budgetStatus = useMemo(() => {
        const stats = summaryStats.value;
        if (!stats) return { percent: 0, color: 'bg-slate-200', value: '0' };
        const { monthIncome, monthExpense } = stats;
        if (monthIncome === 0) return { percent: 0, color: 'bg-slate-200', value: '0' };

        const percent = Math.min((monthExpense / monthIncome) * 100, 100);

        let color = 'bg-success';
        if (percent > 80) color = 'bg-warning';
        if (percent > 95) color = 'bg-danger';

        return { percent, color, value: percent.toFixed(0) };
    }, [summaryStats.value]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <ViewLayout
            title={`${getGreeting()}, User`}
            // actions={Actions} // Removed as per user request to avoid duplication with Quick Widget
            isLoading={isLoading.value && !summaryStats.value}
        >
            <div className="space-y-6">

                {/* 1. Hero Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <UiStatCard
                        label="Total Balance"
                        value={formatCurrency(summaryStats.value?.totalBalance ?? 0)}
                        icon={Landmark}
                        color="primary"
                        trend="up"
                        trendValue="+2.5%"
                    />
                    <UiStatCard
                        label="Net Worth"
                        value={formatCurrency(summaryStats.value?.netWorth ?? 0)}
                        icon={Gem}
                        color="info"
                        trend="up"
                        trendValue="+1.2%"
                    />
                    <UiStatCard
                        label="Monthly Income"
                        value={formatCurrency(summaryStats.value?.monthIncome ?? 0)}
                        icon={Wallet}
                        color="success"
                    />
                    <UiStatCard
                        label="Monthly Expenses"
                        value={formatCurrency(summaryStats.value?.monthExpense ?? 0)}
                        icon={TrendingDown}
                        color="danger"
                        trend={(summaryStats.value?.savingsRate ?? 0) >= 0 ? "up" : "down"}
                        trendValue={`${(summaryStats.value?.savingsRate ?? 0).toFixed(1)}% Saved`}
                    />
                </div>

                {/* 2. Bento Grid Main Area */}
                <div className="space-y-8">

                    {/* Row 1: Net Worth Chart + Quick Transaction */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        {/* Main Chart Card */}
                        <UiCard
                            title="Net Worth & Cash Flow"
                            subtitle="Financial performance over time"
                            className="xl:col-span-2 h-[460px]"
                            variant="default"
                            icon={TrendingUp}
                        >
                            <div className="h-[340px] w-full">
                                {chartData.value && chartConfig.labels.length > 0 ? (
                                    <UiChart
                                        type="bar"
                                        height={340}
                                        data={chartConfig}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            scales: {
                                                x: {
                                                    grid: { display: false },
                                                    ticks: {
                                                        maxRotation: 0,
                                                        autoSkip: true,
                                                        maxTicksLimit: 6,
                                                    }
                                                },
                                                y: {
                                                    type: 'linear',
                                                    display: false,
                                                    position: 'left',
                                                },
                                                y1: {
                                                    type: 'linear',
                                                    display: true,
                                                    position: 'right',
                                                    beginAtZero: true,
                                                    suggestedMax: 1000,
                                                    grid: {
                                                        drawOnChartArea: true,
                                                        color: 'rgba(0, 0, 0, 0.05)',
                                                    },
                                                    border: { display: false },
                                                    ticks: {
                                                        callback: (value: any) => formatCurrency(Number(value), undefined, true),
                                                        maxTicksLimit: 6,
                                                    }
                                                },
                                            },
                                            plugins: {
                                                legend: {
                                                    position: 'bottom',
                                                    labels: {
                                                        padding: 20,
                                                        usePointStyle: true,
                                                    }
                                                },
                                                tooltip: {
                                                    callbacks: {
                                                        label: (context: any) => {
                                                            let label = context.dataset.label || '';
                                                            if (label) {
                                                                label += ': ';
                                                            }
                                                            if (context.parsed.y !== null) {
                                                                label += formatCurrency(context.parsed.y);
                                                            }
                                                            return label;
                                                        }
                                                    }
                                                }
                                            },
                                            layout: {
                                                padding: {
                                                    top: 10,
                                                    bottom: 10,
                                                    left: 10,
                                                    right: 10
                                                }
                                            }
                                        }}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-text-muted">Loading Chart Data...</div>
                                )}
                            </div>
                        </UiCard>

                        {/* Quick Transaction Widget */}
                        <div className="h-[460px]">
                            <QuickTransactionWidget className="h-full" />
                        </div>
                    </div>

                    {/* Row 2: Categories + Budget Status + My Accounts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        <UiCard title="Top Categories" icon={PieChart}>
                            <div className="h-48 flex items-center justify-center">
                                {categoryChartConfig ? (
                                    <div className="w-full h-full p-2">
                                        <UiChart
                                            type="doughnut"
                                            data={categoryChartConfig.data as any}
                                            options={categoryChartConfig.options as any}
                                        />
                                    </div>
                                ) : (
                                    <span className="text-text-muted text-sm">No expense data available</span>
                                )}
                            </div>
                        </UiCard>
                        <UiCard title="Budget Status" icon={Target}>
                            <div className="h-48 flex flex-col justify-center px-4 space-y-4">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <div className="text-2xl font-bold text-text-primary">{budgetStatus.value}%</div>
                                        <div className="text-xs text-text-muted">of Monthly Income Spent</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-semibold text-text-primary">{formatCurrency(summaryStats.value?.monthExpense ?? 0)}</div>
                                        <div className="text-xs text-text-muted">Total Expenses</div>
                                    </div>
                                </div>

                                <div className="w-full bg-surface-base rounded-full h-3 overflow-hidden">
                                    <div
                                        className={clsx("h-full rounded-full transition-all duration-500", budgetStatus.color)}
                                        style={{ width: `${budgetStatus.percent}%` }}
                                    ></div>
                                </div>

                                <div className="text-xs text-text-muted text-center pt-2">
                                    {100 - parseFloat(budgetStatus.value) > 0
                                        ? `${(100 - parseFloat(budgetStatus.value)).toFixed(0)}% remaining to save`
                                        : "Budget exceeded"}
                                </div>
                            </div>
                        </UiCard>
                        {/* My Accounts Widget */}
                        <UiCard title="My Accounts" variant="default" icon={Wallet}>
                            <div className="space-y-2">
                                {(accounts.value || []).slice(0, 4).map(acc => (
                                    <div key={acc.id} className="flex justify-between items-center p-3 bg-surface-hover rounded-xl border border-border/50 hover:border-brand-primary/30 transition-all cursor-pointer group">
                                        <div>
                                            <div className="font-semibold text-sm text-text-primary group-hover:text-brand-primary transition-colors">{acc.name}</div>
                                            <div className="text-xs text-text-muted capitalize">{acc.type.replace('_', ' ')}</div>
                                        </div>
                                        <div className={clsx("font-mono font-medium text-sm", acc.balance >= 0 ? "text-success" : "text-danger")}>{formatCurrency(acc.balance)}</div>
                                    </div>
                                ))}
                                {(accounts.value || []).length > 4 && (
                                    <UiButton variant="ghost" fullWidth className="mt-2">View All {accounts.value!.length} Accounts</UiButton>
                                )}
                            </div>
                        </UiCard>
                    </div>



                </div>

            </div>

            {/* Transfer Modal */}
            <Modal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} title="New Transfer">
                <TransactionForm
                    initialData={{ type: 'transfer' }}
                    onSubmit={handleTransferSave}
                    onCancel={() => setIsTransferModalOpen(false)}
                />
            </Modal>
        </ViewLayout>
    );
};
