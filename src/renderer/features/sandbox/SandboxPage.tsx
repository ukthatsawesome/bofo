import { h } from 'preact';
import {
  Zap,
  Car,
  Plane,
  HeartPulse,
  TrendingUp,
  LineChart,
  ListChecks,
  Trash2,
  Layout,
  Cpu,
  Info,
  ChevronDown,
} from 'lucide-preact';
import { useSandbox } from '@/features/sandbox/hooks/useSandbox';
import { UiCard } from '@/components/ui/UiCard';
import { UiStatCard } from '@/components/ui/UiStatCard';
import { UiButton } from '@/components/ui/UiButton';
import { formatCurrency, formatNumber, getCurrencyCode } from '@/utils/format';
import { SandboxChart } from './components/SandboxChart';
import { PlannedItemsTable } from './components/PlannedItemsTable';
import { AddPlannedItemForm } from './components/AddPlannedItemForm';
import { clsx } from 'clsx';
import { financeStore } from '@/core/financeStore';
import { ViewLayout } from '@/components/layout/ViewLayout';

export const SandboxPage = () => {
  const {
    plannedItems,
    range,
    setRange,
    isLoading,
    stats,
    baselineTimeline,
    scenarioTimeline,
    aiInsight,
    isLoadingInsight,
    addItem,
    removeItem,
    clearAll,
    applyTemplate,
  } = useSandbox();

  const currentBalance = financeStore.activeAccounts.value.reduce(
    (sum, a) => sum + (['bank', 'wallet'].includes(a.type) ? a.balance : 0),
    0
  );

  const RangeSelector = (
    <div className="relative group">
      <select
        value={range.toString()}
        onChange={(e) => setRange(parseInt((e.target as HTMLSelectElement).value))}
        className="appearance-none bg-surface-card border border-border rounded-lg pl-3 pr-8 py-2 text-xs font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all cursor-pointer shadow-sm"
      >
        <option value="6">6 Months</option>
        <option value="12">12 Months</option>
        <option value="18">18 Months</option>
        <option value="24">24 Months</option>
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
      />
    </div>
  );

  return (
    <ViewLayout
      title="Financial Sandbox"
      subtitle='Experiment with "what-if" scenarios to understand the impact of financial decisions'
      actions={RangeSelector}
    >
      <div className="space-y-6">
        {/* Quick Templates */}
        <UiCard className="border-dashed" variant="flat">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-warning fill-warning" />
            <h3 className="font-bold text-sm text-text-primary">Quick Scenarios</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <TemplateButton
              icon={Car}
              title="Buy Car"
              value="$20,000"
              onClick={() => applyTemplate('car')}
            />
            <TemplateButton
              icon={Plane}
              title="Vacation"
              value="$3,000"
              onClick={() => applyTemplate('vacation')}
            />
            <TemplateButton
              icon={HeartPulse}
              title="Emergency"
              value="$5,000"
              onClick={() => applyTemplate('emergency')}
            />
            <TemplateButton
              icon={TrendingUp}
              title="Salary Raise"
              value="+$500/mo"
              onClick={() => applyTemplate('raise')}
            />
          </div>
        </UiCard>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <UiStatCard
              label="Current Balance"
              value={formatNumber(currentBalance)}
              icon={Layout}
              currency={getCurrencyCode()}
            />
            <UiStatCard
              label="Without Plan"
              value={formatNumber(stats.baseEnd)}
              icon={LineChart}
              currency={getCurrencyCode()}
            />
            <UiStatCard
              label="With Plan"
              value={formatNumber(stats.scenEnd)}
              icon={TrendingUp}
              trend={stats.impact !== 0 ? (stats.impact >= 0 ? 'up' : 'down') : undefined}
              trendValue={stats.impact !== 0 ? formatNumber(Math.abs(stats.impact)) : undefined}
              currency={getCurrencyCode()}
            />
            <UiStatCard
              label="Net Impact"
              value={formatNumber(stats.impact)}
              icon={Cpu}
              color={stats.impact >= 0 ? 'success' : 'danger'}
              currency={getCurrencyCode()}
            />
          </div>
        )}

        {/* AI Insight */}
        {aiInsight && (
          <UiCard className="border-l-4 border-l-brand-primary bg-brand-primary/5">
            <div className="flex gap-4">
              <div className="p-2 bg-brand-primary/10 rounded-xl text-brand-primary h-fit">
                <Cpu size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-text-primary">{aiInsight.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{aiInsight.message}</p>
              </div>
            </div>
          </UiCard>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {/* Projection Chart */}
            <UiCard>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-text-primary flex items-center gap-2">
                  <LineChart size={20} className="text-brand-primary" /> Financial Projection
                </h3>
              </div>
              {isLoading ? (
                <div className="h-[400px] flex items-center justify-center bg-surface-base/30 rounded-xl animate-pulse text-text-muted">
                  Calculating scenario...
                </div>
              ) : (
                <SandboxChart baseline={baselineTimeline} scenario={scenarioTimeline} />
              )}
            </UiCard>

            {/* Planned Items Table */}
            <UiCard className="p-0 overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between bg-surface-base/10">
                <h3 className="font-bold text-lg text-text-primary flex items-center gap-2">
                  <ListChecks size={20} className="text-brand-primary" /> Planned Items
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    {plannedItems.length} Items
                  </span>
                  {plannedItems.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="text-xs font-bold text-danger hover:underline flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Clear All
                    </button>
                  )}
                </div>
              </div>
              <div className="p-4">
                <PlannedItemsTable items={plannedItems} onRemove={removeItem} />
              </div>
            </UiCard>
          </div>

          <div className="lg:col-span-4 space-y-6">
            {/* Add Item Form */}
            <UiCard>
              <h3 className="font-bold text-lg text-text-primary flex items-center gap-2 mb-6">
                <span className="text-brand-primary">+</span> Add Planned Item
              </h3>
              <AddPlannedItemForm onAdd={addItem} />
            </UiCard>

            <div className="p-4 bg-surface-card rounded-xl border border-border">
              <div className="flex items-center gap-2 text-text-primary mb-2">
                <Info size={16} className="text-brand-primary" />
                <h4 className="font-bold text-sm">How it works</h4>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Planned items are temporary and only exist in this sandbox. They help you visualize
                how a potential large purchase or life change will impact your net worth over time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ViewLayout>
  );
};

const TemplateButton = ({ icon: Icon, title, value, onClick }: any) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center justify-center p-4 bg-surface-card border border-border rounded-xl hover:border-brand-primary hover:shadow-md transition-all group"
  >
    <div className="p-3 bg-surface-base rounded-full text-text-muted group-hover:text-brand-primary group-hover:bg-brand-primary/10 transition-colors mb-3">
      <Icon size={24} />
    </div>
    <span className="text-sm font-bold text-text-primary">{title}</span>
    <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">
      {value}
    </span>
  </button>
);
