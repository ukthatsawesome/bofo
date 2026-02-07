import { useState, useEffect, useMemo } from 'preact/hooks';
import { financeStore } from '@/core/financeStore';

export interface PlannedItem {
    id: string;
    description: string;
    type: 'expense' | 'income';
    amount: number;
    category: string;
    account_id: number;
    start_date: string;
    frequency: 'once' | 'weekly' | 'monthly' | 'yearly';
    is_active: boolean;
}

export function useSandbox() {
    const { transactions, accounts } = financeStore;
    const [plannedItems, setPlannedItems] = useState<PlannedItem[]>([]);
    const [range, setRange] = useState(12);
    const [isLoading, setIsLoading] = useState(false);
    const [baselineForecast, setBaselineForecast] = useState<any>(null);
    const [scenarioForecast, setScenarioForecast] = useState<any>(null);
    const [aiInsight, setAiInsight] = useState<{ title: string, message: string, icon: string } | null>(null);
    const [isLoadingInsight, setIsLoadingInsight] = useState(false);

    const updateProjections = async () => {
        setIsLoading(true);
        try {
            // Calculate baseline
            const base = await (window as any).api.calculateForecast({
                transactions: transactions.value,
                accounts: accounts.value,
                months: range
            });
            setBaselineForecast(base);

            // Calculate scenario
            const scenarioTransactions = [...transactions.value, ...plannedItems];
            const scen = await (window as any).api.calculateForecast({
                transactions: scenarioTransactions,
                accounts: accounts.value,
                months: range
            });
            setScenarioForecast(scen);

            // Trigger AI insight if there are items
            if (plannedItems.length > 0) {
                fetchInsight(base, scen);
            } else {
                setAiInsight(null);
            }
        } catch (error) {
            console.error("Failed to update projections:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchInsight = async (base: any, scen: any) => {
        setIsLoadingInsight(true);
        try {
            const summaryData = {
                baselineEnd: base.summary.endBalance,
                scenarioEnd: scen.summary.endBalance,
                impact: scen.summary.endBalance - base.summary.endBalance,
                range,
                items: plannedItems.map(i => `${i.description} (${i.type}, ${i.amount}, ${i.frequency})`)
            };

            const prompt = `Analyze this financial plan and give practical advice in 2-3 sentences:
            Projected without plan: ${summaryData.baselineEnd} in ${range} months
            Projected with plan: ${summaryData.scenarioEnd}
            Net impact: ${summaryData.impact}
            Items: ${summaryData.items.join(', ')}
            Be direct, practical, and give specific advice.`;

            const res = await (window as any).api.getAIInsight(prompt);
            setAiInsight({
                title: 'AI Financial Analysis',
                message: res,
                icon: 'brain'
            });
        } catch (error) {
            console.error("Failed to fetch AI insight:", error);
        } finally {
            setIsLoadingInsight(false);
        }
    };

    useEffect(() => {
        updateProjections();
    }, [range, plannedItems, transactions.value, accounts.value]);

    const addItem = (item: Omit<PlannedItem, 'id' | 'is_active'>) => {
        const newItem: PlannedItem = {
            ...item,
            id: 'plan-' + Date.now(),
            is_active: true
        };
        setPlannedItems(prev => [...prev, newItem]);
    };

    const removeItem = (id: string) => {
        setPlannedItems(prev => prev.filter(i => i.id !== id));
    };

    const clearAll = () => {
        setPlannedItems([]);
    };

    const applyTemplate = (templateName: string) => {
        const templates: Record<string, Omit<PlannedItem, 'id' | 'is_active'>> = {
            car: {
                description: 'Car Purchase',
                type: 'expense',
                amount: 20000,
                category: 'Transportation',
                account_id: accounts.value[0]?.id || 1,
                start_date: new Date().toISOString().split('T')[0],
                frequency: 'once'
            },
            vacation: {
                description: 'Vacation Trip',
                type: 'expense',
                amount: 3000,
                category: 'Travel',
                account_id: accounts.value[0]?.id || 1,
                start_date: new Date().toISOString().split('T')[0],
                frequency: 'once'
            },
            emergency: {
                description: 'Emergency Expense',
                type: 'expense',
                amount: 5000,
                category: 'Healthcare',
                account_id: accounts.value[0]?.id || 1,
                start_date: new Date().toISOString().split('T')[0],
                frequency: 'once'
            },
            raise: {
                description: 'Salary Increase',
                type: 'income',
                amount: 500,
                category: 'Salary',
                account_id: accounts.value[0]?.id || 1,
                start_date: new Date().toISOString().split('T')[0],
                frequency: 'monthly'
            }
        };

        const template = templates[templateName];
        if (template) {
            addItem(template);
        }
    };

    const stats = useMemo(() => {
        if (!baselineForecast || !scenarioForecast) return null;

        const baseEnd = baselineForecast.summary.endBalance;
        const scenEnd = scenarioForecast.summary.endBalance;
        const impact = scenEnd - baseEnd;

        return {
            baseEnd,
            scenEnd,
            impact,
            impactPercent: impact !== 0 ? (impact / Math.abs(baseEnd || 1)) * 100 : 0
        };
    }, [baselineForecast, scenarioForecast]);

    return {
        plannedItems,
        range,
        setRange,
        isLoading,
        stats,
        baselineTimeline: baselineForecast?.timeline || [],
        scenarioTimeline: scenarioForecast?.timeline || [],
        aiInsight,
        isLoadingInsight,
        addItem,
        removeItem,
        clearAll,
        applyTemplate
    };
}
