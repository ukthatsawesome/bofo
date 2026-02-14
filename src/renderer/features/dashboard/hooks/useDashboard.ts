import { useState, useEffect } from 'preact/hooks';
import { financeStore } from '@/core/financeStore';
import { aiInsightCache } from '@/core/lib/ai';
import { FallbackGenerator } from '@/core/lib/ai';
import { api } from '@/core/lib/api';
import type { AIInsight } from '@/core/lib/ai';

export function useDashboard() {
    // Trigger load if needed (e.g. first app launch)
    useEffect(() => {
        if (!financeStore.dashboardChartData.value) {
            financeStore.loadAll();
        }
    }, []);

    // Return signals directly — components access .value in JSX for reactivity
    return {
        summaryStats: financeStore.summaryStats,
        chartData: financeStore.dashboardChartData,
        accounts: financeStore.accounts,
        transactions: financeStore.transactions,
        categories: financeStore.categories,
        insight: financeStore.insight,
        isLoading: financeStore.isLoading
    };
}
