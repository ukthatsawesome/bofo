import { useState, useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { financeStore } from '@/core/financeStore';

interface DashboardData {
    summaryStats: {
        totalBalance: number;
        netWorth: number;
        monthIncome: number;
        monthExpense: number;
        savingsRate: number;
    };
    chartData: any;
    accounts: any[];
    insight: any;
    isLoading: boolean;
}

export function useDashboard() {
    // Return reactive signals directly
    // This ensures that even if component unmounts/remounts, we bind to the persistent store state immediately

    // Trigger load if needed (e.g. first app launch)
    useEffect(() => {
        // Only load if we don't have chart data, or maybe just trigger a background refresh
        // For now, let's trust loadAll() from app initialization, or trigger it if empty
        if (!financeStore.dashboardChartData.value) {
            financeStore.loadAll();
        }
    }, []);

    return {
        summaryStats: financeStore.summaryStats.value,
        chartData: financeStore.dashboardChartData.value,
        accounts: financeStore.accounts.value,
        transactions: financeStore.transactions.value,
        categories: financeStore.categories.value,
        insight: null,
        isLoading: financeStore.isLoading.value
    };
}
