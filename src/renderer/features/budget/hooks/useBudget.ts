import { useState, useEffect, useMemo } from 'preact/hooks';
import { financeStore } from '@/core/financeStore';
import { Budget, CategorySpending } from '../../../../shared/types';
import { api } from '@/core/lib/api';
import { notify } from '@/core/lib/notify';

export function useBudget() {
  const budgets = financeStore.budgets.value;
  const isLoading = financeStore.isLoading.value;

  const [filter, setFilter] = useState<'active' | 'past'>('active');

  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [spendingData, setSpendingData] = useState<Record<string, number>>({});
  const [isLoadingSpending, setIsLoadingSpending] = useState(false);

  const filteredBudgets = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return budgets.filter((b) => {
      if (filter === 'active') {
        return b.start_date <= today && b.end_date >= today;
      } else {
        const [yStr, mStr] = viewMonth.split('-');
        const year = parseInt(yStr);
        const month = parseInt(mStr);

        const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        return b.start_date <= monthEnd && b.end_date >= monthStart;
      }
    });
  }, [budgets, filter, viewMonth]);

  useEffect(() => {
    const loadSpending = async () => {
      setIsLoadingSpending(true);
      try {
        let start, end;
        if (filter === 'active') {
          const now = new Date();
          start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        } else {
          const [yStr, mStr] = viewMonth.split('-');
          const year = parseInt(yStr);
          const month = parseInt(mStr);

          start = `${year}-${String(month).padStart(2, '0')}-01`;
          const lastDay = new Date(year, month, 0).getDate();
          end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        }

        const data: CategorySpending[] = await api.getCategorySpending(start, end);
        const map: Record<string, number> = {};
        data.forEach((item) => {
          map[item.category] = item.amount;
        });
        setSpendingData(map);
      } catch (err) {
        console.error('Failed to load spending', err);
      } finally {
        setIsLoadingSpending(false);
      }
    };

    if (budgets.length > 0) {
      loadSpending();
    }
  }, [filter, viewMonth, budgets]);

  const budgetsWithProgress = useMemo(() => {
    return filteredBudgets.map((b: Budget) => {
      const spent = spendingData[b.category] || 0;
      const percent = Math.min((spent / b.amount) * 100, 100);
      const remaining = b.amount - spent;
      const status = percent >= 100 ? 'over' : percent >= 80 ? 'warning' : 'ok';

      return {
        ...b,
        spent,
        percent,
        remaining,
        status,
      };
    });
  }, [filteredBudgets, spendingData]);

  const stats = useMemo(() => {
    const totalBudgeted = budgetsWithProgress.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgetsWithProgress.reduce((sum, b) => sum + b.spent, 0);
    return {
      totalBudgeted,
      totalSpent,
      totalRemaining: totalBudgeted - totalSpent,
      isOverBudget: totalSpent > totalBudgeted,
    };
  }, [budgetsWithProgress]);

  const refresh = async () => {
    await financeStore.loadAll();
  };

  const deleteBudget = async (id: number) => {
    const confirmed = await notify.confirm(
      'Delete Budget',
      'Are you sure you want to delete this budget?',
      'warning'
    );
    if (!confirmed) return;
    await financeStore.deleteBudget(id);
    notify.success('Budget Deleted', 'Budget has been removed');
  };

  const saveBudget = async (budget: Partial<Budget>) => {
    if (budget.id) {
      financeStore.updateBudget(budget.id, budget);
    } else {
      financeStore.addBudget(budget);
    }
  };

  return {
    budgets: budgetsWithProgress,
    stats,
    filter,
    setFilter,
    viewMonth,
    setViewMonth,
    isLoading: isLoading || isLoadingSpending,
    refresh,
    deleteBudget,
    saveBudget,
    categories: financeStore.categories.value,
  };
}
