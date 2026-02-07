import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { financeStore } from '@/core/financeStore';
import { deepEqual } from '@/utils/deepEqual';

// ==================== TYPES ====================

interface ForecastSummary {
    totalIncome: number;
    totalExpense: number;
    netSavings: number;
    runway: number;
}

interface ForecastTimelineItem {
    date: string;
    income: number;
    expense: number;
    balance: number;
}

interface ForecastInsight {
    type: 'success' | 'warning' | 'danger' | 'info';
    title: string;
    message: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface ForecastData {
    summary: ForecastSummary;
    timeline: ForecastTimelineItem[];
    insights: ForecastInsight[];
}

// ==================== UTILITIES ====================

/**
 * Helper to get a date string offset by months from today
 */
const getOffsetDate = (monthsOffset: number): string => {
    const date = new Date();
    date.setMonth(date.getMonth() + monthsOffset);
    return date.toISOString().split('T')[0];
};

/**
 * Calculates the number of months between two date strings
 */
const getMonthDifference = (startStr: string, endStr: string): number => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
};

// ==================== HOOK ====================

export function useForecast() {
    const { transactions, accounts, recurringCharges } = financeStore;

    // State
    const [range, setRange] = useState<number | 'custom'>(6);
    const [viewMode, setViewMode] = useState<'chart' | 'calendar'>('chart');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [forecastData, setForecastData] = useState<ForecastData | null>(null);

    // Race condition handling
    const activeRequest = useRef<number>(0);

    const [customRange, setCustomRange] = useState({
        start: getOffsetDate(-3), // 3 months ago
        end: getOffsetDate(6)     // 6 months ahead
    });

    const [calendarDate, setCalendarDate] = useState({
        month: new Date().getMonth(),
        year: new Date().getFullYear()
    });

    // ==================== LOGIC ====================

    // ==================== LOGIC ====================

    const getMonthCount = (): number => {
        if (range === 'custom') {
            const diff = getMonthDifference(customRange.start, customRange.end);
            return Math.max(1, diff);
        }
        return typeof range === 'number' ? range : 12;
    };

    // Keep track of the active controller to abort previous requests
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchForecast = async (inputData: any) => {
        setIsLoading(true);
        setError(null);

        // Abort previous request if running
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Create new controller
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            // Safety check for API
            if (!window.api?.calculateForecast) {
                throw new Error("Forecast API not available");
            }

            // Wrap the API call to support cancellation via racing
            const apiCall = window.api.calculateForecast({
                transactions: inputData.transactions,
                accounts: inputData.accounts,
                recurringCharges: inputData.recurringCharges,
                months: inputData.months
            });

            // Race against the abort signal
            // We use a new Promise that rejects if/when the signal aborts
            const abortPromise = new Promise((_, reject) => {
                if (controller.signal.aborted) return reject(new Error('Aborted'));
                controller.signal.addEventListener('abort', () => reject(new Error('Aborted')));
            });

            const data = await Promise.race([apiCall, abortPromise]);

            if (!controller.signal.aborted) {
                setForecastData(data as any); // Cast because Promise.race type inference might be mixed
                setIsLoading(false);
            }
        } catch (err: any) {
            // Ignore abort errors
            if (err.message !== 'Aborted' && !controller.signal.aborted) {
                console.error("Failed to calculate forecast:", err);
                setError(err.message || "Failed to calculate forecast");
                setIsLoading(false);
            }
        }
    };

    // ==================== REACTIVE HELPERS ====================

    // Store the last processed inputs to prevent redundant fetches
    const lastInputsRef = useRef<any>(null);

    useEffect(() => {
        // Prevent fetch if date range is invalid
        if (range === 'custom') {
            const start = new Date(customRange.start);
            const end = new Date(customRange.end);
            if (start.getTime() > end.getTime()) return;
        }

        // Gather current inputs
        // explicit typing helps typescript check properties
        const currentInputs = {
            transactions: transactions.value,
            accounts: accounts.value,
            recurringCharges: recurringCharges.value,
            months: getMonthCount(),
            // We include range/customRange context for the signature effectively by including 'months' 
            // but also need to ensure we re-run if dates change even if month count is same (e.g. sliding window)
            // So we add the raw bounds if custom
            customBounds: range === 'custom' ? { ...customRange } : null
        };

        // Deep Equality Check
        // If inputs haven't changed meaningfully, skip
        if (lastInputsRef.current && deepEqual(currentInputs, lastInputsRef.current)) {
            return;
        }

        // Logic for Debounce Time
        // If switching presets (range is number), instant (0ms or small buffer)
        // If Custom Range (typing dates), use 800ms
        // If data changes (transactions update), usage 800ms to avoid flicker during bulk updates? 
        // Or maybe 300ms. Let's stick to User Request: "Debounce text inputs, trigger immediate for preset"
        // If the SOURCE of change is just the Range preset, go fast.

        let debounceMs = 500; // Default for data changes

        // Refine debounce based on what likely changed
        // We can't easily know WHAT changed without comparing, but we can check range type
        if (range !== 'custom') {
            // If we are in preset mode, we generally want fast updates
            // But if transactions update rapidly, we still want some debounce.
            // However, "Click interaction... feels laggy" -> implied 800ms is too long for UI toggle.
            debounceMs = 200;
        } else {
            debounceMs = 800; // Typing dates
        }

        const timer = setTimeout(() => {
            lastInputsRef.current = currentInputs; // Commit usage
            fetchForecast(currentInputs);
        }, debounceMs);

        return () => clearTimeout(timer);

    }, [
        // Dependencies that trigger the check
        transactions.value,
        accounts.value,
        recurringCharges.value,
        range,
        customRange
    ]);

    // ==================== DERIVED STATE ====================

    const filteredTimeline = useMemo(() => {
        if (!forecastData) return [];

        // If not custom range, return full timeline
        if (range !== 'custom') return forecastData.timeline;

        // Filter for custom range
        return forecastData.timeline.filter(item =>
            item.date >= customRange.start && item.date <= customRange.end
        );
    }, [forecastData, range, customRange]);

    const lowBalanceThreshold = useMemo(() => {
        if (!forecastData?.summary) return 500;

        const months = getMonthCount();
        if (months <= 0) return 500;

        const monthlyBurn = forecastData.summary.totalExpense / months;
        // 10% of monthly burn, rounded to nearest 10
        const threshold = Math.round((monthlyBurn * 0.1) / 10) * 10;

        return threshold || 500;
    }, [forecastData, range, customRange]);

    // ==================== HANDLERS ====================

    // ==================== HANDLERS ====================

    const changeMonth = (offset: number) => {
        setCalendarDate(prev => {
            const date = new Date(prev.year, prev.month + offset);
            return {
                month: date.getMonth(),
                year: date.getFullYear()
            };
        });
    };

    return {
        range,
        setRange,
        viewMode,
        setViewMode,
        isLoading,
        error, // <--- New return
        summary: forecastData?.summary || null,
        timeline: filteredTimeline,
        insights: forecastData?.insights || [],
        customRange,
        setCustomRange,
        calendarDate,
        nextMonth: () => changeMonth(1),
        prevMonth: () => changeMonth(-1),
        refresh: fetchForecast,
        recurringCharges: recurringCharges.value,
        lowBalanceThreshold
    };
}