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
    AppSettings
} from '../../shared/types';
import { notify } from './lib/notify';
import { api } from './lib/api';
import type { AIInsight } from './lib/ai';
import { aiInsightCache, FallbackGenerator } from './lib/ai';

// --- State Signals (Atomic & Reactive) ---

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

// Dashboard Specific State (Persisted to avoid flicker)
export const dashboardChartData = signal<DashboardData | null>(null);
export const insight = signal<AIInsight | null>(null);
export const summaryStats = signal<SummaryStats>({
    netWorth: 0,
    totalBalance: 0,
    monthIncome: 0,
    monthExpense: 0,
    savingsRate: 0
});

// --- Loading States ---
export const isLoading = signal<boolean>(false);
export const loadingMessage = signal<string>('Loading...');

// --- Versioning for Dependent Computations ---
export const dataVersion = signal<number>(0);
const incrementVersion = () => dataVersion.value = dataVersion.peek() + 1;

// --- Computed Signal (Derived State) ---
// Automatically updates when accounts.value changes. No setter needed.

export const netWorth = computed(() => {
    const base = settings.value?.currency_base || 'USD';
    const rates = exchangeRates.value || [];
    const rateMap = new Map<string, number>();

    // Build rate map for fast lookup
    rates.forEach(r => {
        rateMap.set(`${r.from_currency}-${r.to_currency}`, r.rate);
        if (r.rate !== 0) rateMap.set(`${r.to_currency}-${r.from_currency}`, 1 / r.rate);
    });

    return accounts.value.reduce((total, acc) => {
        const isLiability = !['bank', 'wallet', 'investment'].includes((acc.type || '').toLowerCase());
        const balance = acc.balance || 0;
        const currency = acc.currency || 'USD';

        // Convert to base currency
        let converted = balance;
        if (currency !== base) {
            const rateKey = `${currency}-${base}`;
            const rate = rateMap.get(rateKey) || 1;
            converted = balance * rate;
        }

        return total + (isLiability ? -Math.abs(converted) : converted);
    }, 0);
});

export const activeAccounts = computed(() =>
    accounts.value.filter(a => a.status !== 'archived')
);

// --- Automated Versioning ---
// Monitor key signals and increment version automatically to prevent stale forecasts
effect(() => {
    // Access signals to subscribe
    transactions.value;
    accounts.value;
    recurringCharges.value;

    // We use a non-tracking read of dataVersion to increment it without creating a loop 
    // (though increment itself is a write, so it's fine). 
    // However, signal effects run immediately. We want to avoid the initial run bumping version?
    // Actually, initial run is fine (0->1).
    incrementVersion();
});

// --- Actions (Mutations) ---
// These will eventually be replaced by the Service Layer / Hooks
// But as a first step, we provide a way to ingest data from the old system without loops

export const actions = {
    setTransactions: (data: Transaction[]) => { transactions.value = data; },
    setAccounts: (data: Account[]) => { accounts.value = data; },
    setCategories: (data: Category[]) => { categories.value = data; },
    setBillTypes: (data: BillType[]) => {
        billTypes.value = data;
        return data;
    },
    setBillReadings: (data: BillReading[]) => { billReadings.value = data; },
    setRecurringCharges: (data: RecurringCharge[]) => { recurringCharges.value = data; },

    // Unified loader - Split into stages for performance
    loadEssentialData: async () => {
        isLoading.value = true;
        try {
            // Stage 1: Critical for UI shell and initial view
            // Using Promise.allSettled to allow partial success
            const results = await Promise.allSettled([
                api.getSettings(),
                api.getCategories(),
                api.getBillTypes(),
                api.getAccounts(),
                api.getTransactionsPaginated({ limit: 50, offset: 0 }),
                api.getSummaryStats(),
                api.getExchangeRates()
            ]);

            const [
                settingsResult,
                catsResult,
                billsResult,
                accsResult,
                txPageResult,
                statsResult,
                ratesResult
            ] = results;

            // Helper to handle results
            const handleResult = <T>(result: PromiseSettledResult<T>, onSuccess: (data: T) => void, errorMsg: string) => {
                if (result.status === 'fulfilled') {
                    onSuccess(result.value);
                } else {
                    console.error(`${errorMsg}:`, result.reason);
                    notify.error(errorMsg, (result.reason as Error)?.message || 'Unknown error');
                }
            };

            handleResult(settingsResult, (data) => settings.value = data || {}, "Failed to load settings");
            handleResult(catsResult, (data) => categories.value = data || [], "Failed to load categories");
            handleResult(billsResult, (data) => billTypes.value = data || [], "Failed to load bill types");
            handleResult(accsResult, (data) => accounts.value = data || [], "Failed to load accounts");
            handleResult(ratesResult, (data) => exchangeRates.value = data || [], "Failed to load exchange rates");

            handleResult(txPageResult, (page) => {
                if (page && 'data' in page) {
                    transactions.value = page.data;
                    totalTransactions.value = page.total;
                } else {
                    transactions.value = [];
                    totalTransactions.value = 0;
                }
            }, "Failed to load transactions");

            handleResult(statsResult, (data) => {
                if (data) summaryStats.value = data;
            }, "Failed to load summary stats");

        } catch (e) {
            console.error("Critical failure in loadEssentialData", e);
            notify.error("Critical Data Load Failure", (e as Error).message);
        } finally {
            isLoading.value = false;
        }
    },

    loadSecondaryData: async () => {
        try {
            // Stage 2: Heavy lifting - Charts, Budgets, Goals, History logic
            const [recurring, fetchedBudgets, fetchedGoals, chart] = await Promise.all([
                api.getRecurringCharges(),
                api.getBudgets(),
                api.getGoals(),
                api.getDashboardData(6)
            ]);

            recurringCharges.value = recurring || [];
            budgets.value = fetchedBudgets || [];
            goals.value = fetchedGoals || [];
            if (chart) dashboardChartData.value = chart;

            // Load Insight (Non-blocking)
            actions.loadInsight();

        } catch (e) {
            console.error("Failed to load secondary data", e);
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
                (data) => FallbackGenerator.generateDashboardInsight({
                    balance: data.totalBalance,
                    monthIncome: data.monthIncome,
                    monthExpense: data.monthExpense,
                    savingsRate: data.savingsRate,
                }),
                { fallbackTitle: 'Financial Insight', aiTitle: 'AI Insight' }
            );
            if (result) insight.value = result;
        } catch (e) {
            console.warn("Failed to load insight", e);
        }
    },

    // Legacy support (optional, can be removed if AppRoot uses new methods)
    loadAll: async () => {
        await actions.loadEssentialData();
        await actions.loadSecondaryData();
    },

    // --- Optimistic Mutations ---

    /** Background refresh of stats and charts after a mutation */
    _refreshDerivedData: () => {
        api.getSummaryStats().then(s => { if (s) summaryStats.value = s; }).catch(() => { });
        api.getDashboardData(6).then(d => { if (d) dashboardChartData.value = d; }).catch(() => { });
        // Refresh accounts to reflect balance changes
        api.getAccounts().then(a => { if (a) accounts.value = a; }).catch(() => { });
    },

    addTransaction: async (data: TransactionPayload) => {
        const tempId = -Date.now();
        const now = new Date().toISOString();

        // Construct optimistic transaction that satisfies the full Transaction interface
        // We cast as Transaction because some fields like 'exchange_rate' might be missing from payload but required in DB type (defaulting on server)
        // Ideally we should fill all defaults here.
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
            // Defaults for required fields if not present in payload
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
            status: 'pending'
        } as unknown as Transaction;

        // Optimistic Update: List
        const previous = transactions.value;
        transactions.value = [optimisticTx, ...previous]; // Prepend
        totalTransactions.value++;

        // Optimistic Update: Accounts
        const previousAccounts = accounts.value;
        const newAccounts = previousAccounts.map(acc => {
            if (acc.id === data.account_id) {
                // Formatting handled by display, we just do raw math here
                const amt = Number(data.amount);
                let change = 0;
                if (data.type === 'expense') change = -amt;
                if (data.type === 'income') change = amt;
                if (data.type === 'transfer') change = -amt;
                return { ...acc, balance: acc.balance + change };
            }
            if (data.type === 'transfer' && data.to_account_id && acc.id === data.to_account_id) {
                // Assuming same currency for optimistic update
                return { ...acc, balance: acc.balance + Number(data.amount) };
            }
            return acc;
        });
        accounts.value = newAccounts;

        try {
            const realTx = await api.addTransaction(data);
            // Replace temp with real
            transactions.value = transactions.value.map(t => t.id === tempId ? realTx : t);
            actions._refreshDerivedData();
        } catch (e) {
            console.error("Add failed", e);
            transactions.value = previous; // Rollback
            accounts.value = previousAccounts; // Rollback accounts
            totalTransactions.value--;
            notify.error("Failed to add transaction", (e as Error).message || "Unknown error");
        }
    },

    updateTransaction: async (id: number, data: Partial<Transaction>) => {
        const previous = transactions.value;
        const index = previous.findIndex(t => t.id === id);
        if (index === -1) return;

        // Optimistic Update
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
            console.error("Update failed", e);
            transactions.value = previous; // Rollback
            notify.error("Failed to update transaction", (e as Error).message);
        }
    },

    deleteTransaction: async (id: number) => {
        const previous = transactions.value;
        // Optimistic Update
        transactions.value = previous.filter(t => t.id !== id);
        totalTransactions.value--;

        try {
            await api.deleteTransaction(id);
            actions._refreshDerivedData();
        } catch (e) {
            console.error("Delete failed", e);
            transactions.value = previous; // Rollback
            totalTransactions.value++;
            notify.error("Failed to delete transaction", (e as Error).message);
        }
    },

    // --- Budget Actions ---

    addBudget: async (data: Partial<Budget>) => {
        const tempId = -Date.now();
        const optimistic = { ...data, id: tempId, spent: 0, percent: 0, remaining: data.amount || 0, status: 'ok' } as any;
        const previous = budgets.value;
        budgets.value = [...previous, optimistic];

        try {
            await api.setBudget(data.category!, data.amount!, data.period!, data.start_date!, data.end_date!);
            // Reload to get real ID if needed, or we rely on loadAll eventual consistency
            // Ideally API returns the Created Budget
            actions.loadAll();
        } catch (e) {
            console.error("Add budget failed", e);
            budgets.value = previous;
            notify.error("Failed to add budget", (e as Error).message);
        }
    },

    updateBudget: async (id: number, data: Partial<Budget>) => {
        const previous = budgets.value;
        const index = previous.findIndex(b => b.id === id);
        if (index === -1) return;

        const updated = { ...previous[index], ...data };
        const newList = [...previous];
        newList[index] = updated;
        budgets.value = newList;

        try {
            if (data.category && data.amount && data.period && data.start_date && data.end_date) {
                await api.updateBudget(id, data.category, data.amount, data.period, data.start_date, data.end_date);
            } else {
                // Fallback or specific update logic if partials allowed by backend
                console.warn("Update budget requires all fields currently");
            }
        } catch (e) {
            console.error("Update budget failed", e);
            budgets.value = previous;
            notify.error("Failed to update budget", (e as Error).message);
        }
    },

    deleteBudget: async (id: number) => {
        const previous = budgets.value;
        budgets.value = previous.filter(b => b.id !== id);

        try {
            await api.deleteBudget(id);
        } catch (e) {
            console.error("Delete budget failed", e);
            budgets.value = previous;
            notify.error("Failed to delete budget", (e as Error).message);
        }
    },

    // --- Goal Actions ---

    addGoal: async (data: Partial<Goal>) => {
        const tempId = -Date.now();
        const optimistic = { ...data, id: tempId, current_amount: 0, status: 'active' } as Goal;
        const previous = goals.value;
        goals.value = [...previous, optimistic];

        try {
            await api.createGoal(data);
            actions.loadAll(); // Re-fetch to get real ID
        } catch (e) {
            console.error("Add goal failed", e);
            goals.value = previous;
            notify.error("Failed to add goal", (e as Error).message);
        }
    },

    updateGoal: async (id: number, data: Partial<Goal>) => {
        const previous = goals.value;
        const index = previous.findIndex(g => g.id === id);
        if (index === -1) return;

        const updated = { ...previous[index], ...data };
        const newList = [...previous];
        newList[index] = updated;
        goals.value = newList;

        try {
            await api.updateGoal(id, data);
        } catch (e) {
            console.error("Update goal failed", e);
            goals.value = previous;
            notify.error("Failed to update goal", (e as Error).message);
        }
    },

    deleteGoal: async (id: number) => {
        const previous = goals.value;
        goals.value = previous.filter(g => g.id !== id);

        try {
            await api.deleteGoal(id);
        } catch (e) {
            console.error("Delete goal failed", e);
            goals.value = previous;
            notify.error("Failed to delete goal", (e as Error).message);
        }
    },

    contributeToGoal: async (id: number, amount: number, source?: string, notes?: string) => {
        const previous = goals.value;
        const index = previous.findIndex(g => g.id === id);
        if (index === -1) return;

        const goal = previous[index];
        const newAmount = (goal.current_amount || 0) + amount;
        const updated = { ...goal, current_amount: newAmount };

        // Update list
        const newList = [...previous];
        newList[index] = updated;
        goals.value = newList;

        try {
            await api.contributeToGoal(id, amount, source || null, notes || null);
        } catch (e) {
            console.error("Contribute failed", e);
            goals.value = previous;
            notify.error("Failed to contribute to goal", (e as Error).message);
        }
    }
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
    ...actions
};
