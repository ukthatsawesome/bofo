import { signal, computed } from '@preact/signals';
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
    TransactionPayload
} from '../../shared/types';

// --- State Signals (Atomic & Reactive) ---

export const transactions = signal<Transaction[]>([]);
export const totalTransactions = signal<number>(0);
export const accounts = signal<Account[]>([]);
export const categories = signal<Category[]>([]);
export const settings = signal<Record<string, any>>({});
export const billTypes = signal<BillType[]>([]);
export const billReadings = signal<BillReading[]>([]);
export const exchangeRates = signal<ExchangeRate[]>([]);
export const budgets = signal<Budget[]>([]);
export const goals = signal<Goal[]>([]);
export const recurringCharges = signal<RecurringCharge[]>([]);

// Dashboard Specific State (Persisted to avoid flicker)
export const dashboardChartData = signal<any>(null);
export const summaryStats = signal<any>({
    totalBalance: 0,
    netWorth: 0,
    monthIncome: 0,
    monthExpense: 0,
    savingsRate: 0
});

// --- Loading States ---
export const isLoading = signal<boolean>(false);
export const loadingMessage = signal<string>('Loading...');

// --- Computed Signal (Derived State) ---
// Automatically updates when accounts.value changes. No setter needed.

export const netWorth = computed(() => {
    return accounts.value.reduce((total, acc) => {
        const isLiability = ['credit_card', 'loan'].includes(acc.type);
        return total + (isLiability ? -acc.balance : acc.balance);
    }, 0);
});

export const activeAccounts = computed(() =>
    accounts.value.filter(a => a.status !== 'archived')
);

// --- Actions (Mutations) ---
// These will eventually be replaced by the Service Layer / Hooks
// But as a first step, we provide a way to ingest data from the old system without loops

export const actions = {
    setTransactions: (data: Transaction[]) => transactions.value = data,
    setAccounts: (data: Account[]) => accounts.value = data,
    setCategories: (data: Category[]) => categories.value = data,
    setBillTypes: (data: BillType[]) => {
        billTypes.value = data;
        return data;
    },
    setBillReadings: (data: BillReading[]) => { billReadings.value = data; },

    // Unified loader - Split into stages for performance
    loadEssentialData: async () => {
        isLoading.value = true;
        try {
            // Stage 1: Critical for UI shell and initial view
            const [settingsData, cats, bills, accs, txPage, stats] = await Promise.all([
                window.api.getSettings(),
                window.api.getCategories(),
                window.api.getBillTypes(),
                window.api.getAccounts(),
                window.api.getTransactionsPaginated({ limit: 50, offset: 0 }),
                window.api.getSummaryStats()
            ]);

            settings.value = settingsData || {};
            categories.value = cats || [];
            billTypes.value = bills || [];
            accounts.value = accs || [];

            // Initial Transactions (First page only)
            if (txPage && 'data' in txPage) {
                transactions.value = txPage.data;
                totalTransactions.value = txPage.total;
            } else {
                transactions.value = [];
                totalTransactions.value = 0;
            }

            if (stats) summaryStats.value = stats;

        } catch (e) {
            console.error("Failed to load essential data", e);
        } finally {
            isLoading.value = false;
        }
    },

    loadSecondaryData: async () => {
        try {
            // Stage 2: Heavy lifting - Charts, Budgets, Goals, History logic
            const [recurring, fetchedBudgets, fetchedGoals, chart] = await Promise.all([
                window.api.getRecurringCharges(),
                window.api.getBudgets(),
                window.api.getGoals(),
                window.api.getDashboardData(6)
            ]);

            recurringCharges.value = recurring || [];
            budgets.value = fetchedBudgets || [];
            goals.value = fetchedGoals || [];
            if (chart) dashboardChartData.value = chart;

        } catch (e) {
            console.error("Failed to load secondary data", e);
        }
    },

    // Legacy support (optional, can be removed if AppRoot uses new methods)
    loadAll: async () => {
        await actions.loadEssentialData();
        await actions.loadSecondaryData();
    },

    // --- Optimistic Mutations ---

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
            created_at: now,
            updated_at: now,
            deleted_at: null,
            // Defaults for required fields if not present in payload
            account_id: data.account_id,
            to_account_id: data.to_account_id || null,
            category: data.category || 'Uncategorized',
            category_id: null, // Will be resolved by server if category string provided, or we might knwo it
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

        // Optimistic Update
        const previous = transactions.value;
        transactions.value = [optimisticTx, ...previous]; // Prepend
        totalTransactions.value++;

        try {
            const realTx = await window.api.addTransaction(data);
            // Replace temp with real
            transactions.value = transactions.value.map(t => t.id === tempId ? realTx : t);
        } catch (e) {
            console.error("Add failed", e);
            transactions.value = previous; // Rollback
            totalTransactions.value--;
            // TODO: Toast error could go here
        }
    },

    updateTransaction: async (id: number, data: any) => {
        const previous = transactions.value;
        const index = previous.findIndex(t => t.id === id);
        if (index === -1) return;

        // Optimistic Update
        const updated = { ...previous[index], ...data };
        const newList = [...previous];
        newList[index] = updated;
        transactions.value = newList;

        try {
            await window.api.updateTransaction(id, data);
            // No need to replace again unless API returns transformed data, which for update it usually sends back the record
            // But strict consistency check:
            // const confirmed = await window.api.getTransaction(id);
            // transactions.value = transactions.value.map(t => t.id === id ? confirmed : t);
        } catch (e) {
            console.error("Update failed", e);
            transactions.value = previous; // Rollback
        }
    },

    deleteTransaction: async (id: number) => {
        const previous = transactions.value;
        // Optimistic Update
        transactions.value = previous.filter(t => t.id !== id);
        totalTransactions.value--;

        try {
            await window.api.deleteTransaction(id);
        } catch (e) {
            console.error("Delete failed", e);
            transactions.value = previous; // Rollback
            totalTransactions.value++;
        }
    },

    // --- Budget Actions ---

    addBudget: async (data: any) => {
        const tempId = -Date.now();
        const optimistic = { ...data, id: tempId, spent: 0, percent: 0, remaining: data.amount, status: 'ok' };
        const previous = budgets.value;
        budgets.value = [...previous, optimistic];

        try {
            await window.api.setBudget(data.category, data.amount, data.period, data.start_date, data.end_date);
            // Reload to get real ID if needed, or we rely on loadAll eventual consistency
            // Ideally API returns the Created Budget
            actions.loadAll();
        } catch (e) {
            console.error("Add budget failed", e);
            budgets.value = previous;
        }
    },

    updateBudget: async (id: number, data: any) => {
        const previous = budgets.value;
        const index = previous.findIndex(b => b.id === id);
        if (index === -1) return;

        const updated = { ...previous[index], ...data };
        const newList = [...previous];
        newList[index] = updated;
        budgets.value = newList;

        try {
            await window.api.updateBudget(id, data.category, data.amount, data.period, data.start_date, data.end_date);
        } catch (e) {
            console.error("Update budget failed", e);
            budgets.value = previous;
        }
    },

    deleteBudget: async (id: number) => {
        const previous = budgets.value;
        budgets.value = previous.filter(b => b.id !== id);

        try {
            await window.api.deleteBudget(id);
        } catch (e) {
            console.error("Delete budget failed", e);
            budgets.value = previous;
        }
    },

    // --- Goal Actions ---

    addGoal: async (data: any) => {
        const tempId = -Date.now();
        const optimistic = { ...data, id: tempId, current_amount: 0, status: 'active' };
        const previous = goals.value;
        goals.value = [...previous, optimistic];

        try {
            await window.api.createGoal(data);
            actions.loadAll(); // Re-fetch to get real ID
        } catch (e) {
            console.error("Add goal failed", e);
            goals.value = previous;
        }
    },

    updateGoal: async (id: number, data: any) => {
        const previous = goals.value;
        const index = previous.findIndex(g => g.id === id);
        if (index === -1) return;

        const updated = { ...previous[index], ...data };
        const newList = [...previous];
        newList[index] = updated;
        goals.value = newList;

        try {
            await window.api.updateGoal(id, data);
        } catch (e) {
            console.error("Update goal failed", e);
            goals.value = previous;
        }
    },

    deleteGoal: async (id: number) => {
        const previous = goals.value;
        goals.value = previous.filter(g => g.id !== id);

        try {
            await window.api.deleteGoal(id);
        } catch (e) {
            console.error("Delete goal failed", e);
            goals.value = previous;
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
            await window.api.contributeToGoal(id, amount, source || null, notes || null);
        } catch (e) {
            console.error("Contribute failed", e);
            goals.value = previous;
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
    summaryStats,
    ...actions
};
