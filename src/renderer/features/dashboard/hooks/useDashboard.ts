import { useState, useEffect } from 'preact/hooks';
import { financeStore } from '@/core/financeStore';
import { aiInsightCache } from '@/core/lib/ai';
import { FallbackGenerator } from '@/core/lib/ai';
import { api } from '@/core/lib/api';
import type { AIInsight } from '@/core/lib/ai';

export function useDashboard() {
  const [range, setRange] = useState<number>(6);

  useEffect(() => {
    financeStore.loadAll();
  }, []);

  useEffect(() => {
    financeStore.fetchDashboardData(range);
  }, [range]);

  return {
    summaryStats: financeStore.summaryStats,
    chartData: financeStore.dashboardChartData,
    accounts: financeStore.accounts,
    transactions: financeStore.transactions,
    categories: financeStore.categories,
    insight: financeStore.insight,
    isLoading: financeStore.isLoading,
    range,
    setRange,
  };
}
