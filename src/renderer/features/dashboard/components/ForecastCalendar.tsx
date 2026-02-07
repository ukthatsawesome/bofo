import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-preact';
import { formatCurrency } from '@/utils/formatters';

interface CalendarDay {
    date: string;
    dayOfMonth: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    projectedBalance: number;
    events: CalendarEvent[];
    isLowBalance: boolean;
}

interface CalendarEvent {
    type: 'bill' | 'recurring' | 'income';
    name: string;
    amount: number;
}

interface ForecastCalendarProps {
    month: number; // 0-indexed
    year: number;
    timeline: { date: string; balance: number }[];
    recurringCharges: { name: string; due_day: number; amount: number; category: string }[];
    lowBalanceThreshold: number;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    isLoading?: boolean;
}

export const ForecastCalendar = ({
    month,
    year,
    timeline,
    recurringCharges,
    lowBalanceThreshold,
    onPrevMonth,
    onNextMonth,
    isLoading = false
}: ForecastCalendarProps) => {

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const days = useMemo(() => {
        if (isLoading) return []; // Skip calculation during loading
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const today = new Date().toISOString().split('T')[0];

        // Create balance lookup map
        const balanceMap = new Map<string, number>();
        for (const day of timeline) {
            balanceMap.set(day.date, day.balance);
        }

        // Get last known balance for fill-forward
        let lastBalance = 0;
        if (timeline.length > 0) {
            lastBalance = timeline[timeline.length - 1]?.balance || 0;
        }

        const calendarDays: CalendarDay[] = [];

        // Add empty cells for days before first day of month
        for (let i = 0; i < firstDay; i++) {
            calendarDays.push({
                date: '',
                dayOfMonth: 0,
                isCurrentMonth: false,
                isToday: false,
                projectedBalance: 0,
                events: [],
                isLowBalance: false,
            });
        }

        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const balance = balanceMap.get(dateStr) ?? lastBalance;

            const events: CalendarEvent[] = [];

            // Add recurring charges due on this day
            for (const rc of recurringCharges) {
                if (rc.due_day === day) {
                    events.push({
                        type: 'recurring',
                        name: rc.name,
                        amount: rc.amount,
                    });
                }
            }

            calendarDays.push({
                date: dateStr,
                dayOfMonth: day,
                isCurrentMonth: true,
                isToday: dateStr === today,
                projectedBalance: balance,
                events,
                isLowBalance: balance < lowBalanceThreshold && balance > 0,
            });
        }

        return calendarDays;
    }, [month, year, timeline, recurringCharges, lowBalanceThreshold, isLoading]);

    // Loading Skeleton
    if (isLoading) {
        return (
            <div className="bg-surface-card rounded-xl border border-border overflow-hidden animate-pulse">
                {/* Nav Skeleton */}
                <div className="p-4 flex items-center justify-between border-b border-border bg-surface-base/30">
                    <div className="w-8 h-8 bg-surface-hover rounded-lg"></div>
                    <div className="w-32 h-6 bg-surface-hover rounded"></div>
                    <div className="w-8 h-8 bg-surface-hover rounded-lg"></div>
                </div>

                {/* Summary Skeleton */}
                <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4 border-b border-border bg-surface-base/10">
                    <div className="flex flex-col gap-2">
                        <div className="w-24 h-3 bg-surface-hover rounded"></div>
                        <div className="w-20 h-5 bg-surface-hover rounded"></div>
                    </div>
                </div>

                {/* Grid Skeleton */}
                <div className="p-2">
                    <div className="grid grid-cols-7 gap-px mb-2">
                        {Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} className="h-4 bg-surface-hover/50 rounded mx-2"></div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {Array.from({ length: 35 }).map((_, i) => (
                            <div key={i} className="min-h-[100px] bg-surface-base border border-border rounded-xl"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const lowBalanceDays = days.filter(d => d.isLowBalance).length;
    const totalRecurring = recurringCharges.reduce((sum, r) => sum + r.amount, 0);

    return (
        <div className="bg-surface-card rounded-xl border border-border overflow-hidden">
            {/* Nav */}
            <div className="p-4 flex items-center justify-between border-b border-border bg-surface-base/30">
                <button onClick={onPrevMonth} className="p-2 hover:bg-surface-active rounded-lg transition-colors">
                    <ChevronLeft size={20} />
                </button>
                <h3 className="text-lg font-bold text-text-primary">{monthNames[month]} {year}</h3>
                <button onClick={onNextMonth} className="p-2 hover:bg-surface-active rounded-lg transition-colors">
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Summary */}
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4 border-b border-border bg-surface-base/10">
                <div className="flex flex-col">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Estimated Subscriptions</span>
                    <span className="text-lg font-bold text-text-primary">{formatCurrency(totalRecurring)}</span>
                </div>
                {lowBalanceDays > 0 && (
                    <div className="flex flex-col">
                        <span className="text-xs font-semibold text-danger uppercase tracking-wider">Low Balance Prediction</span>
                        <span className="text-lg font-bold text-danger flex items-center gap-2">
                            {lowBalanceDays} Days <AlertTriangle size={18} />
                        </span>
                    </div>
                )}
            </div>

            {/* Grid */}
            <div className="p-2">
                <div className="grid grid-cols-7 gap-px mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="text-center py-2 text-xs font-bold text-text-muted uppercase">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {days.map((day, idx) => (
                        <div
                            key={idx}
                            className={clsx(
                                "min-h-[100px] p-2 rounded-xl transition-all border",
                                !day.isCurrentMonth ? "bg-transparent border-transparent" : "bg-surface-base border-border hover:border-brand-primary/50 cursor-default",
                                day.isToday && "ring-2 ring-brand-primary border-brand-primary",
                                day.isLowBalance && "bg-danger/5 border-danger/20"
                            )}
                        >
                            {day.isCurrentMonth && (
                                <>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={clsx("text-sm font-bold", day.isToday ? "text-brand-primary" : "text-text-primary")}>
                                            {day.dayOfMonth}
                                        </span>
                                        {day.isLowBalance && <AlertTriangle size={14} className="text-danger" />}
                                    </div>
                                    <div className={clsx("text-xs font-medium mb-2", day.projectedBalance < 0 ? "text-danger" : "text-text-muted")}>
                                        {formatCurrency(day.projectedBalance)}
                                    </div>
                                    <div className="space-y-1">
                                        {day.events.slice(0, 2).map((e, eIdx) => (
                                            <div
                                                key={eIdx}
                                                className={clsx(
                                                    "text-[10px] px-1.5 py-0.5 rounded truncate",
                                                    e.type === 'recurring' ? "bg-brand-primary/10 text-brand-primary" : "bg-success/10 text-success"
                                                )}
                                                title={`${e.name}: ${formatCurrency(e.amount)}`}
                                            >
                                                {e.name}
                                            </div>
                                        ))}
                                        {day.events.length > 2 && (
                                            <div className="text-[10px] text-text-muted pl-1">
                                                +{day.events.length - 2} more
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="p-4 border-t border-border flex flex-wrap gap-4 text-xs text-text-muted">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-brand-primary"></div> Subscription
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-danger"></div> Low Balance
                </div>
            </div>
        </div>
    );
};
