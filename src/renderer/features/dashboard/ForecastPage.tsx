import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import { clsx } from 'clsx';
import {
  LineChart,
  Calendar,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Clock,
  Info,
  ChevronDown,
  AlertTriangle,
} from 'lucide-preact';
import { useForecast } from '@/features/dashboard/hooks/useForecast';
import { UiCard } from '@/components/ui/UiCard';
import { UiStatCard } from '@/components/ui/UiStatCard';
import { ForecastChart } from './components/ForecastChart';
import { ForecastCalendar } from './components/ForecastCalendar';
import { ForecastInsights } from './components/ForecastInsights';
import { Input } from '@/components/ui/Input';
import { formatCurrency, formatNumber, getCurrencyCode } from '@/utils/format';
import { RecurringCharge } from '../../../shared/types';
import { ViewLayout } from '@/components/layout/ViewLayout';

interface StatConfig {
  label: string;
  value: string | number;
  icon: any;
  color?: 'success' | 'danger';
  currency?: string;
}

const RANGE_OPTIONS = [
  { value: '3', label: '3 Months' },
  { value: '6', label: '6 Months' },
  { value: '12', label: '1 Year' },
  { value: '24', label: '2 Years' },
  { value: 'custom', label: 'Custom Range' },
];

const VIEW_OPTIONS = [
  { id: 'chart' as const, icon: LineChart, label: 'Chart' },
  { id: 'calendar' as const, icon: Calendar, label: 'Calendar' },
];

const FORECAST_INFO_TEXT =
  'Projections are calculated by analyzing your recurring transactions, bills, and average spending patterns over the last 12 months. The "Runway" indicates how long your current balances will last at your average burn rate.';

export const ForecastPage = () => {
  const {
    range,
    setRange,
    viewMode,
    setViewMode,
    isLoading,
    error, // <--- Destructure error
    summary,
    timeline,
    insights,
    customRange,
    setCustomRange,
    calendarDate,
    nextMonth,
    prevMonth,
    recurringCharges,
    lowBalanceThreshold,
  } = useForecast();

  const handleRangeChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    setRange(value === 'custom' ? 'custom' : parseInt(value, 10));
  };

  const handleDateChange = (field: 'start' | 'end') => (e: Event) => {
    const newValue = (e.target as HTMLInputElement).value;
    setCustomRange((prev) => ({ ...prev, [field]: newValue }));
  };

  const currentRangeLabel = useMemo(() => {
    return RANGE_OPTIONS.find((opt) => opt.value === String(range))?.label || 'Projection';
  }, [range]);

  const isInvalidRange = useMemo(() => {
    return range === 'custom' && customRange.start > customRange.end;
  }, [range, customRange]);

  const recurringChargesData = useMemo(
    () =>
      recurringCharges.map((rc: RecurringCharge) => ({
        name: rc.name,
        due_day: rc.due_day || 1,
        amount: rc.amount,
        category: rc.category,
      })),
    [recurringCharges]
  );

  const statsData = useMemo((): StatConfig[] => {
    if (!summary) return [];

    return [
      {
        label: 'Projected Income',
        value: formatNumber(summary.totalIncome),
        icon: TrendingUp,
        color: 'success',
        currency: getCurrencyCode(),
      },
      {
        label: 'Projected Expense',
        value: formatNumber(summary.totalExpense),
        icon: TrendingDown,
        color: 'danger',
        currency: getCurrencyCode(),
      },
      {
        label: 'Projected Savings',
        value: formatNumber(summary.netSavings),
        icon: PiggyBank,
        currency: getCurrencyCode(),
      },
      {
        label: 'Runway',
        value:
          summary.runway === undefined || summary.runway === null
            ? 'N/A'
            : summary.runway === Infinity
              ? 'Infinite'
              : `${summary.runway.toFixed(1)} Months`,
        icon: Clock,
      },
    ];
  }, [summary]);

  const renderViewToggle = () => (
    <div className="flex bg-surface-card border border-border rounded-lg p-1">
      {VIEW_OPTIONS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => setViewMode(id)}
          className={clsx(
            'flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
            viewMode === id
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>
  );

  const renderRangeSelector = () => (
    <div className="relative group">
      <select
        value={range.toString()}
        onChange={handleRangeChange}
        className="appearance-none bg-surface-card border border-border rounded-lg pl-3 pr-8 py-2 text-xs font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all cursor-pointer"
      >
        {RANGE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
      />
    </div>
  );

  const HeaderActions = (
    <div className="flex items-center gap-3">
      {renderViewToggle()}
      {viewMode === 'chart' && renderRangeSelector()}
    </div>
  );

  return (
    <ViewLayout
      title="Financial Forecast"
      subtitle="Analyze your future wealth based on historical patterns"
      actions={HeaderActions}
    >
      <div className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="bg-danger/10 text-danger border border-danger/20 p-3 rounded-lg flex items-center gap-2 text-sm font-medium animate-slide-up">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {/* Custom Range Inputs */}
        {range === 'custom' && viewMode === 'chart' && (
          <UiCard
            className={clsx(
              'bg-surface-base/50 border-dashed transition-colors duration-300',
              isInvalidRange && 'border-danger/30 bg-danger/5'
            )}
          >
            <div className="flex flex-wrap gap-4 items-end">
              <Input
                label="Start Date"
                type="date"
                className="max-w-[200px]"
                value={customRange.start}
                onInput={handleDateChange('start')}
                error={isInvalidRange ? ' ' : undefined}
              />
              <Input
                label="End Date"
                type="date"
                className="max-w-[200px]"
                value={customRange.end}
                onInput={handleDateChange('end')}
                error={isInvalidRange ? ' ' : undefined}
              />
              <div className="pb-3 flex-1 min-w-[200px]">
                {isInvalidRange ? (
                  <p className="text-xs text-danger font-medium flex items-center gap-1.5 animate-pulse">
                    <AlertTriangle size={14} />
                    Start date cannot be after end date
                  </p>
                ) : (
                  <p className="text-xs text-text-muted italic">
                    Projection is based on your historical transaction frequency and amounts.
                  </p>
                )}
              </div>
            </div>
          </UiCard>
        )}

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statsData.map((stat, idx) => (
              <UiStatCard
                key={idx}
                label={stat.label}
                value={stat.value}
                icon={stat.icon}
                color={stat.color}
                currency={stat.currency}
              />
            ))}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Chart or Calendar */}
          <div className="lg:col-span-8 space-y-6">
            {viewMode === 'chart' ? (
              <UiCard className="overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg text-text-primary flex items-center gap-2">
                    <LineChart size={20} className="text-brand-primary" /> Wealth Projection
                  </h3>
                  <div className="px-2 py-1 bg-brand-primary/10 text-brand-primary text-[10px] font-bold uppercase tracking-widest rounded">
                    {currentRangeLabel}
                  </div>
                </div>

                {isLoading ? (
                  <div className="h-[450px] flex items-center justify-center bg-surface-base/30 rounded-xl animate-pulse">
                    <div className="text-text-muted flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                      <span>Calculating projections...</span>
                    </div>
                  </div>
                ) : (
                  <ForecastChart data={timeline} />
                )}
              </UiCard>
            ) : (
              <ForecastCalendar
                month={calendarDate.month}
                year={calendarDate.year}
                timeline={timeline}
                recurringCharges={recurringChargesData}
                lowBalanceThreshold={lowBalanceThreshold}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
                isLoading={isLoading}
              />
            )}
          </div>

          {/* Right Column: Insights & Info */}
          <div className="lg:col-span-4 space-y-6">
            <ForecastInsights insights={insights} />

            <div className="p-4 bg-brand-primary/5 rounded-xl border border-brand-primary/10">
              <div className="flex items-center gap-2 text-brand-primary mb-2">
                <Info size={16} />
                <h4 className="font-bold text-sm">About Forecasting</h4>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">{FORECAST_INFO_TEXT}</p>
            </div>
          </div>
        </div>
      </div>
    </ViewLayout>
  );
};
