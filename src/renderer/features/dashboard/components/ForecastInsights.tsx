import { h } from 'preact';
import { clsx } from 'clsx';
import { Cpu, CheckCircle, AlertTriangle, XCircle, Info, LucideIcon } from 'lucide-preact';
import { UiCard } from '@/components/ui/UiCard';

export type InsightType = 'success' | 'warning' | 'danger' | 'info';

interface ForecastInsight {
  type: InsightType;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ForecastInsightsProps {
  insights: ForecastInsight[];
}

const INSIGHT_CONFIG: Record<
  InsightType,
  { icon: LucideIcon; iconColor: string; wrapperClass: string }
> = {
  success: {
    icon: CheckCircle,
    iconColor: 'text-success',
    wrapperClass: 'bg-success/5 border-success/20',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-warning',
    wrapperClass: 'bg-warning/5 border-warning/20',
  },
  danger: {
    icon: XCircle,
    iconColor: 'text-danger',
    wrapperClass: 'bg-danger/5 border-danger/20',
  },
  info: {
    icon: Info,
    iconColor: 'text-brand-primary',
    wrapperClass: 'bg-brand-primary/5 border-brand-primary/20',
  },
};

export const ForecastInsights = ({ insights }: ForecastInsightsProps) => {
  if (insights.length === 0) {
    return (
      <UiCard className="border-l-4 border-l-success bg-success/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-success/10 rounded-full text-success shrink-0">
            <CheckCircle size={24} />
          </div>
          <div>
            <h3 className="font-bold text-text-primary">All Systems Nominal</h3>
            <p className="text-sm text-text-muted">
              No forecast alerts for this period. You're on track!
            </p>
          </div>
        </div>
      </UiCard>
    );
  }

  return (
    <UiCard className="border-l-4 border-l-brand-primary">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary">
          <Cpu size={20} />
        </div>
        <h3 className="font-bold text-text-primary">Forecast Intelligence</h3>
      </div>

      <div className="space-y-3">
        {insights.map((insight, idx) => {
          const { icon: Icon, iconColor, wrapperClass } = INSIGHT_CONFIG[insight.type];

          return (
            <div
              key={`${insight.type}-${insight.title}-${insight.message.substring(0, 20)}`}
              className={clsx(
                'flex gap-3 p-3 rounded-xl border transition-all hover:shadow-sm animate-slide-up',
                wrapperClass
              )}
              style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'both' }}
            >
              <div className={clsx('shrink-0 mt-0.5', iconColor)}>
                <Icon size={18} />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm text-text-primary mb-0.5">{insight.title}</h4>
                <p
                  className="text-xs text-text-muted leading-relaxed line-clamp-3"
                  title={insight.message}
                >
                  {insight.message}
                </p>
                {insight.action && (
                  <button
                    onClick={insight.action.onClick}
                    className="mt-2 text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1"
                  >
                    {insight.action.label} &rarr;
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </UiCard>
  );
};
