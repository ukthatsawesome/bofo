import { signal, computed, effect } from '@preact/signals';
import type {
  Transaction,
  Account,
  Category,
  BillReading,
  BillType,
  Budget,
  ExchangeRate,
  Goal,
  RecurringCharge,
  TransactionPayload,
  DashboardData,
  SummaryStats,
  AppSettings,
} from '../../shared/types';
import { notify } from './lib/notify';
import { api } from './lib/api';
import type { AIInsight } from './lib/ai';
import { aiInsightCache, FallbackGenerator } from './lib/ai';
import { SETTING_KEYS } from '../../shared/settings/keys';

export const transactions = signal<Transaction[]>([]);
export const totalTransactions = signal<number>(0);
export const accounts = signal<Account[]>([]);
export const categories = signal<Category[]>([]);
export const settings = signal<AppSettings>({});
export const billTypes = signal<BillType[]>([]);
export const billReadings = signal<BillReading[]>([]);
export const exchangeRates = signal<ExchangeRate[]>([]);
export const budgets = signal<Budget[]>([]);
export const goals = signal<Goal[]>([]);
export const recurringCharges = signal<RecurringCharge[]>([]);

export const dashboardChartData = signal<DashboardData | null>(null);
export const insight = signal<AIInsight | null>(null);
export const summaryStats = signal<SummaryStats>({
  netWorth: 0,
  totalBalance: 0,
  monthIncome: 0,
  monthExpense: 0,
  savingsRate: 0,
});

export const isLoading = signal<boolean>(false);
export const loadingMessage = signal<string>('Loading...');

export const dataVersion = signal<number>(0);
const incrementVersion = () => (dataVersion.value = dataVersion.peek() + 1);

export const netWorth = computed(() => {
  const base = settings.value?.[SETTING_KEYS.CURRENCY.BASE] || 'USD';
  const rates = exchangeRates.value || [];
  const rateMap = new Map<string, number>();

  rates.forEach((r) => {
    rateMap.set(`${r.from_currency}-${r.to_currency}`, r.rate);
    if (r.rate !== 0) rateMap.set(`${r.to_currency}-${r.from_currency}`, 1 / r.rate);
  });

  return accounts.value.reduce((total, acc) => {
    const isLiability = !['bank', 'wallet', 'investment'].includes((acc.type || '').toLowerCase());
    const balance = acc.balance || 0;
    const currency = acc.currency || 'USD';

    let converted = balance;
    if (currency !== base) {
      const rateKey = `${currency}-${base}`;
      const rate = rateMap.get(rateKey) || 1;
      converted = balance * rate;
    }

    return total + (isLiability ? -Math.abs(converted) : converted);
  }, 0);
});

export const activeAccounts = computed(() => accounts.value.filter((a) => a.status !== 'archived'));

effect(() => {
  transactions.value;
  accounts.value;
  recurringCharges.value;

  incrementVersion();
});

export const actions = {
  setTransactions: (data: Transaction[]) => {
    transactions.value = data;
  },
  setAccounts: (data: Account[]) => {
    accounts.value = data;
  },
  setCategories: (data: Category[]) => {
    categories.value = data;
  },
  setBillTypes: (data: BillType[]) => {
    billTypes.value = data;
    return data;
  },
  setBillReadings: (data: BillReading[]) => {
    billReadings.value = data;
  },
  setRecurringCharges: (data: RecurringCharge[]) => {
    recurringCharges.value = data;
  },

  loadEssentialData: async () => {
    isLoading.value = true;
    try {
      const results = await Promise.allSettled([
        api.getSettings(),
        api.getCategories(),
        api.getBillTypes(),
        api.getAccounts(),
        api.getTransactionsPaginated({ limit: 50, offset: 0 }),
        api.getSummaryStats(),
        api.getExchangeRates(),
      ]);

      const [
        settingsResult,
        catsResult,
        billsResult,
        accsResult,
        txPageResult,
        statsResult,
        ratesResult,
      ] = results;

      const handleResult = <T>(
        result: PromiseSettledResult<T>,
        onSuccess: (data: T) => void,
        errorMsg: string
      ) => {
        if (result.status === 'fulfilled') {
          onSuccess(result.value);
        } else {
          console.error(`${errorMsg}:`, result.reason);
          notify.error(errorMsg, (result.reason as Error)?.message || 'Unknown error');
        }
      };

      handleResult(
        settingsResult,
        (data) => (settings.value = data || {}),
        'Failed to load settings'
      );
      handleResult(
        catsResult,
        (data) => (categories.value = data || []),
        'Failed to load categories'
      );
      handleResult(
        billsResult,
        (data) => (billTypes.value = data || []),
        'Failed to load bill types'
      );
      handleResult(accsResult, (data) => (accounts.value = data || []), 'Failed to load accounts');
      handleResult(
        ratesResult,
        (data) => (exchangeRates.value = data || []),
        'Failed to load exchange rates'
      );

      handleResult(
        txPageResult,
        (page) => {
          if (page && 'data' in page) {
            transactions.value = page.data;
            totalTransactions.value = page.total;
          } else {
            transactions.value = [];
            totalTransactions.value = 0;
          }
        },
        'Failed to load transactions'
      );

      handleResult(
        statsResult,
        (data) => {
          if (data) summaryStats.value = data;
        },
        'Failed to load summary stats'
      );
    } catch (e) {
      console.error('Critical failure in loadEssentialData', e);
      notify.error('Critical Data Load Failure', (e as Error).message);
    } finally {
      isLoading.value = false;
    }
  },

  loadSecondaryData: async () => {
    try {
      const [recurring, fetchedBudgets, fetchedGoals, chart] = await Promise.all([
        api.getRecurringCharges(),
        api.getBudgets(),
        api.getGoals(),
        api.getDashboardData(6),
      ]);

      recurringCharges.value = recurring || [];
      budgets.value = fetchedBudgets || [];
      goals.value = fetchedGoals || [];
      if (chart) dashboardChartData.value = chart;

      actions.loadInsight();
    } catch (e) {
      console.error('Failed to load secondary data', e);
    }
  },

  loadInsight: async () => {
    const stats = summaryStats.value;
    if (!stats) return;

    try {
      const result = await aiInsightCache.fetchInsight(
        'dashboard',
        stats,
        (data) => api.getAIInsight(data),
        (data) =>
          FallbackGenerator.generateDashboardInsight({
            balance: data.totalBalance,
            monthIncome: data.monthIncome,
            monthExpense: data.monthExpense,
            savingsRate: data.savingsRate,
          }),
        { fallbackTitle: 'Financial Insight', aiTitle: 'AI Insight' }
      );
      if (result) insight.value = result;
    } catch (e) {
      console.warn('Failed to load insight', e);
    }
  },

  loadAll: async () => {
    await actions.loadEssentialData();
    await actions.loadSecondaryData();
  },

  /** Background refresh of stats and charts after a mutation */
  _refreshDerivedData: () => {
    api
      .getSummaryStats()
      .then((s) => {
        if (s) summaryStats.value = s;
      })
      .catch(() => {});
    api
      .getDashboardData(6)
      .then((d) => {
        if (d) dashboardChartData.value = d;
      })
      .catch(() => {});

    api
      .getAccounts()
      .then((a) => {
        if (a) accounts.value = a;
      })
      .catch(() => {});
  },

  addTransaction: async (data: TransactionPayload) => {
    const tempId = -Date.now();
    const now = new Date().toISOString();

    const optimisticTx = {
      ...data,
      id: tempId,
      is_active: 1,
      amount: Number(data.amount), // Force number
      description: data.description || '',
      start_date: data.start_date || now,
      created_at: now,
      updated_at: now,
      deleted_at: null,

      account_id: data.account_id,
      to_account_id: data.to_account_id || null,
      category: data.category || (data.type === 'transfer' ? 'Transfer' : 'Uncategorized'),
      category_id: null,
      attachment: null,
      frequency: data.frequency || 'once',
      end_date: data.end_date || null,
      exchange_rate: data.exchange_rate || 1,
      to_amount: data.to_amount || null,
      base_currency: null,
      base_amount: null,
      tags: null,
      status: 'pending',
    } as unknown as Transaction;

    const previous = transactions.value;
    transactions.value = [optimisticTx, ...previous];
    totalTransactions.value++;

    const previousAccounts = accounts.value;
    const newAccounts = previousAccounts.map((acc) => {
      if (acc.id === data.account_id) {
        const amt = Number(data.amount);
        let change = 0;
        if (data.type === 'expense') change = -amt;
        if (data.type === 'income') change = amt;
        if (data.type === 'transfer') change = -amt;
        return { ...acc, balance: acc.balance + change };
      }
      if (data.type === 'transfer' && data.to_account_id && acc.id === data.to_account_id) {
        const sourceAcc = previousAccounts.find((a) => a.id === data.account_id);
        if (sourceAcc && sourceAcc.currency === acc.currency) {
          return { ...acc, balance: acc.balance + Number(data.amount) };
        }

        return acc;
      }
      return acc;
    });
    accounts.value = newAccounts;

    try {
      const realTx = await api.addTransaction(data);

      transactions.value = transactions.value.map((t) => (t.id === tempId ? realTx : t));
      actions._refreshDerivedData();
    } catch (e) {
      console.error('Add failed', e);
      transactions.value = previous;
      accounts.value = previousAccounts;
      totalTransactions.value--;
      notify.error('Failed to add transaction', (e as Error).message || 'Unknown error');
    }
  },

  updateTransaction: async (id: number, data: Partial<Transaction>) => {
    const previous = transactions.value;
    const index = previous.findIndex((t) => t.id === id);
    if (index === -1) return;

    const updated = { ...previous[index], ...data };
    const newList = [...previous];
    newList[index] = updated;
    transactions.value = newList;

    try {
      await api.updateTransaction(id, data);
      actions._refreshDerivedData();
      // No need to replace again unless API returns transformed data, which for update it usually sends back the record
      // But strict consistency check:
      // const confirmed = await api.getTransaction(id);
      // transactions.value = transactions.value.map(t => t.id === id ? confirmed : t);
    } catch (e) {
      console.error('Update failed', e);
      transactions.value = previous;
      notify.error('Failed to update transaction', (e as Error).message);
    }
  },

  deleteTransaction: async (id: number) => {
    const previous = transactions.value;

    transactions.value = previous.filter((t) => t.id !== id);
    totalTransactions.value--;

    try {
      await api.deleteTransaction(id);
      actions._refreshDerivedData();
    } catch (e) {
      console.error('Delete failed', e);
      transactions.value = previous;
      totalTransactions.value++;
      notify.error('Failed to delete transaction', (e as Error).message);
    }
  },

  addBudget: async (data: Partial<Budget>) => {
    const tempId = -Date.now();
    const optimistic = {
      ...data,
      id: tempId,
      spent: 0,
      percent: 0,
      remaining: data.amount || 0,
      status: 'ok',
    } as any;
    const previous = budgets.value;
    budgets.value = [...previous, optimistic];

    try {
      await api.setBudget(
        data.category!,
        data.amount!,
        data.period!,
        data.start_date!,
        data.end_date!
      );

      actions.loadAll();
    } catch (e) {
      console.error('Add budget failed', e);
      budgets.value = previous;
      notify.error('Failed to add budget', (e as Error).message);
    }
  },

  updateBudget: async (id: number, data: Partial<Budget>) => {
    const previous = budgets.value;
    const index = previous.findIndex((b) => b.id === id);
    if (index === -1) return;

    const updated = { ...previous[index], ...data };
    const newList = [...previous];
    newList[index] = updated;
    budgets.value = newList;

    try {
      if (data.category && data.amount && data.period && data.start_date && data.end_date) {
        await api.updateBudget(
          id,
          data.category,
          data.amount,
          data.period,
          data.start_date,
          data.end_date
        );
      } else {
        console.warn('Update budget requires all fields currently');
      }
    } catch (e) {
      console.error('Update budget failed', e);
      budgets.value = previous;
      notify.error('Failed to update budget', (e as Error).message);
    }
  },

  deleteBudget: async (id: number) => {
    const previous = budgets.value;
    budgets.value = previous.filter((b) => b.id !== id);

    try {
      await api.deleteBudget(id);
    } catch (e) {
      console.error('Delete budget failed', e);
      budgets.value = previous;
      notify.error('Failed to delete budget', (e as Error).message);
    }
  },

  addGoal: async (data: Partial<Goal>) => {
    const tempId = -Date.now();
    const optimistic = { ...data, id: tempId, current_amount: 0, status: 'active' } as Goal;
    const previous = goals.value;
    goals.value = [...previous, optimistic];

    try {
      await api.createGoal(data);
      actions.loadAll();
    } catch (e) {
      console.error('Add goal failed', e);
      goals.value = previous;
      notify.error('Failed to add goal', (e as Error).message);
    }
  },

  updateGoal: async (id: number, data: Partial<Goal>) => {
    const previous = goals.value;
    const index = previous.findIndex((g) => g.id === id);
    if (index === -1) return;

    const updated = { ...previous[index], ...data };
    const newList = [...previous];
    newList[index] = updated;
    goals.value = newList;

    try {
      await api.updateGoal(id, data);
    } catch (e) {
      console.error('Update goal failed', e);
      goals.value = previous;
      notify.error('Failed to update goal', (e as Error).message);
    }
  },

  deleteGoal: async (id: number) => {
    const previous = goals.value;
    goals.value = previous.filter((g) => g.id !== id);

    try {
      await api.deleteGoal(id);
    } catch (e) {
      console.error('Delete goal failed', e);
      goals.value = previous;
      notify.error('Failed to delete goal', (e as Error).message);
    }
  },

  contributeToGoal: async (id: number, amount: number, source?: string, notes?: string) => {
    const previous = goals.value;
    const index = previous.findIndex((g) => g.id === id);
    if (index === -1) return;

    const goal = previous[index];
    const newAmount = (goal.current_amount || 0) + amount;
    const updated = { ...goal, current_amount: newAmount };

    const newList = [...previous];
    newList[index] = updated;
    goals.value = newList;

    try {
      await api.contributeToGoal(id, amount, source || null, notes || null);
    } catch (e) {
      console.error('Contribute failed', e);
      goals.value = previous;
      notify.error('Failed to contribute to goal', (e as Error).message);
    }
  },

  fetchDashboardData: async (months: number) => {
    try {
      const data = await api.getDashboardData(months);
      if (data) dashboardChartData.value = data;
    } catch (e) {
      console.error('Failed to fetch dashboard data', e);
      notify.error('Failed to update chart', (e as Error).message);
    }
  },
};

export const financeStore = {
  transactions,
  totalTransactions,
  accounts,
  categories,
  billTypes,
  billReadings,
  budgets,
  goals,
  recurringCharges,
  isLoading,
  netWorth,
  activeAccounts,
  dashboardChartData,
  insight,
  summaryStats,
  dataVersion,
  settings,
  ...actions,
};
