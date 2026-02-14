import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { financeStore } from '@/core/financeStore';
import { api } from '@/core/lib/api';
import { deepEqual } from '@/utils/deepEqual';

// ==================== CONSTANTS ====================

const DEBOUNCE_MS_PRESET = 200; // Fast response for UI toggles
const DEBOUNCE_MS_CUSTOM = 800; // Slower response for date typing
const DEFAULT_LOW_BALANCE_THRESHOLD = 500;

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

interface ForecastPayload {
    transactions: any[];
    accounts: any[];
    recurringCharges: any[];
    months: number;
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

    // --- State ---
    const [range, setRange] = useState<number | 'custom'>(6);
    const [viewMode, setViewMode] = useState<'chart' | 'calendar'>('chart');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [forecastData, setForecastData] = useState<ForecastData | null>(null);

    const [customRange, setCustomRange] = useState({
        start: getOffsetDate(-3),
        end: getOffsetDate(6)
    });

    const [calendarDate, setCalendarDate] = useState({
        month: new Date().getMonth(),
        year: new Date().getFullYear()
    });

    // --- Refs ---
    const abortControllerRef = useRef<AbortController | null>(null);
    const lastInputsRef = useRef<any>(null); // Stores the lightweight signature for comparison
    const lastFetchInputs = useRef<ForecastPayload | null>(null); // Stores the full payload for refresh

    // --- Logic ---

    const getMonthCount = (): number => {
        if (range === 'custom') {
            const diff = getMonthDifference(customRange.start, customRange.end);
            return Math.max(1, diff);
        }
        return typeof range === 'number' ? range : 12;
    };

    const fetchForecast = async (payload: ForecastPayload) => {
        setIsLoading(true);
        setError(null);

        // Abort previous request if running
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Create new controller for this request
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            if (!api?.calculateForecast) {
                throw new Error("Forecast API not available");
            }

            const apiCall = api.calculateForecast(payload);

            // Create a promise that rejects on abort
            const abortPromise = new Promise((_, reject) => {
                if (controller.signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
                controller.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
            });

            // Race the API call against the abort signal
            const data = await Promise.race([apiCall, abortPromise]) as ForecastData;

            // Only update state if this request wasn't aborted
            if (!controller.signal.aborted) {
                setForecastData(data);
            }
        } catch (err: any) {
            // Only handle errors if this wasn't an intentional abort
            if (err.name !== 'AbortError' && !controller.signal.aborted) {
                console.error("Failed to calculate forecast:", err);
                setError(err.message || "Failed to calculate forecast");
            }
        } finally {
            // Only clear loading state if this is still the active controller
            if (abortControllerRef.current === controller) {
                setIsLoading(false);
            }
        }
    };

    // --- Reactive Effects ---

    useEffect(() => {
        // 1. Validation: Prevent fetch if date range is invalid
        if (range === 'custom') {
            const start = new Date(customRange.start);
            const end = new Date(customRange.end);
            if (start.getTime() > end.getTime()) return;
        }

        // 2. Construct the full payload for the API
        const currentPayload: ForecastPayload = {
            transactions: transactions.value,
            accounts: accounts.value,
            recurringCharges: recurringCharges.value,
            months: getMonthCount(),
        };

        // 3. Construct a lightweight signature for deep equality comparison
        // We use dataVersion to skip deep checking arrays, relying on the store to update the version
        const dependencySignature = {
            dataVersion: financeStore.dataVersion.value,
            months: getMonthCount(),
            customBounds: range === 'custom' ? { ...customRange } : null,
            rangeMode: range
        };

        // 4. Check if inputs have actually changed
        if (lastInputsRef.current && deepEqual(dependencySignature, lastInputsRef.current)) {
            return;
        }

        // 5. Determine debounce duration
        const debounceMs = range === 'custom' ? DEBOUNCE_MS_CUSTOM : DEBOUNCE_MS_PRESET;

        const timer = setTimeout(() => {
            lastInputsRef.current = dependencySignature;
            lastFetchInputs.current = currentPayload;
            fetchForecast(currentPayload);
        }, debounceMs);

        return () => clearTimeout(timer);

    }, [
        financeStore.dataVersion.value,
        range,
        customRange.start,
        customRange.end
    ]);

    // --- Derived State ---

    const filteredTimeline = useMemo(() => {
        if (!forecastData) return [];
        if (range !== 'custom') return forecastData.timeline;

        return forecastData.timeline.filter(item =>
            item.date >= customRange.start && item.date <= customRange.end
        );
    }, [forecastData, range, customRange]);

    const lowBalanceThreshold = useMemo(() => {
        if (!forecastData?.summary) return DEFAULT_LOW_BALANCE_THRESHOLD;

        const months = getMonthCount();
        if (months <= 0) return DEFAULT_LOW_BALANCE_THRESHOLD;

        const monthlyBurn = forecastData.summary.totalExpense / months;
        // 10% of monthly burn, rounded to nearest 10
        const threshold = Math.round((monthlyBurn * 0.1) / 10) * 10;
        return threshold || DEFAULT_LOW_BALANCE_THRESHOLD;
    }, [forecastData, range, customRange]);

    // --- Handlers ---

    const changeMonth = (offset: number) => {
        setCalendarDate(prev => {
            const date = new Date(prev.year, prev.month + offset);
            return { month: date.getMonth(), year: date.getFullYear() };
        });
    };

    return {
        range,
        setRange,
        viewMode,
        setViewMode,
        isLoading,
        error,
        summary: forecastData?.summary || null,
        timeline: filteredTimeline,
        insights: forecastData?.insights || [],
        customRange,
        setCustomRange,
        calendarDate,
        nextMonth: () => changeMonth(1),
        prevMonth: () => changeMonth(-1),
        refresh: () => {
            if (lastFetchInputs.current) {
                fetchForecast(lastFetchInputs.current);
            }
        },
        recurringCharges: recurringCharges.value,
        lowBalanceThreshold
    };
}