import { useState, useEffect, useMemo } from 'preact/hooks';
import { financeStore } from '@/core/financeStore';
import { Goal } from '../../../../shared/types';
import { notify } from '@/core/lib/notify';

interface GoalsSummary {
  activeGoals: number;
  totalSaved: number;
  totalProgress: number;
  totalTarget: number;
  totalMonthlyContribution: number;
}

interface AvailableForGoals {
  available: number;
  avgMonthlyIncome: number;
  recurringCharges: number;
  goalContributions: number;
}

export function useGoals() {
  const goals = financeStore.goals.value;

  const [isLoading, setIsLoading] = useState(false);

  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');
  const [summary, setSummary] = useState<GoalsSummary | null>(null);
  const [available, setAvailable] = useState<AvailableForGoals | null>(null);

  const loadSummary = async () => {
    try {
      const [fetchedSummary, fetchedAvailable] = await Promise.all([
        (window as any).api.getGoalsSummary(),
        (window as any).api.getAvailableForGoals(),
      ]);
      setSummary(fetchedSummary);
      setAvailable(fetchedAvailable);
    } catch (error) {
      console.error('Failed to load goals summary:', error);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [goals]);

  const filteredGoals = useMemo(() => {
    if (filter === 'all') return goals;
    return goals.filter((g) => g.status === filter);
  }, [goals, filter]);

  const createGoal = async (data: any) => {
    financeStore.addGoal(data);
  };

  const updateGoal = async (id: number, data: any) => {
    financeStore.updateGoal(id, data);
  };

  const deleteGoal = async (id: number) => {
    const confirmed = await notify.confirm(
      'Delete Goal',
      'Are you sure you want to delete this goal?',
      'warning'
    );
    if (!confirmed) return;
    await financeStore.deleteGoal(id);
    notify.success('Goal Deleted', 'Goal has been removed');
  };

  const contribute = async (goalId: number, amount: number, source?: string, notes?: string) => {
    financeStore.contributeToGoal(goalId, amount, source, notes);
  };

  return {
    goals: filteredGoals,
    allGoals: goals, // For lookup if needed
    summary,
    available,
    isLoading,
    filter,
    setFilter,
    refresh: loadSummary,
    createGoal,
    updateGoal,
    deleteGoal,
    contribute,
  };
}
