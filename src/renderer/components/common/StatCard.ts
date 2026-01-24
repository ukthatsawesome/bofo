/**
 * StatCard Component - Tailwind version
 * Usage: StatCard({ label: 'Balance', value: '$1,000', icon: 'wallet' })
 */

interface Trend {
  type: 'up' | 'down' | 'neutral';
  value: string;
}

interface StatCardProps {
  label: string;
  value: string;
  icon?: string;
  type?: string;
  trend?: Trend | null;
  className?: string;
  layout?: 'vertical' | 'horizontal';
  iconColor?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  rightContent?: string;
}

export const StatCard = ({
  label,
  value,
  icon,
  type = 'default',
  trend = null,
  className = '',
  layout = 'vertical',
  iconColor = 'primary',
  rightContent = '',
}: StatCardProps): string => {
  // Trend color classes
  const trendColors: Record<string, string> = {
    up: 'text-success',
    down: 'text-danger',
    neutral: 'text-text-muted',
  };

  const trendColor = trend ? trendColors[trend.type] || trendColors.neutral : '';

  // Icon background colors (matching icon-box classes generally, or custom)
  const iconBgClasses: Record<string, string> = {
    primary: 'bg-brand-primary/10 text-brand-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
    info: 'bg-info/10 text-info',
  };

  const iconClass = iconBgClasses[iconColor] || iconBgClasses.primary;

  if (layout === 'horizontal') {
    return `
      <div class="card p-5 relative ${className}">
          <div class="flex-row items-center justify-between">
              <div class="flex-row items-center gap-4">
                  ${icon
        ? `
                      <div class="w-12 h-12 rounded-xl flex items-center justify-center ${iconClass}">
                          <i data-lucide="${icon}" class="w-6 h-6"></i>
                      </div>
                  `
        : ''
      }
                  <div>
                      <p class="text-xs text-text-muted font-bold uppercase tracking-widest">${label}</p>
                      <h2 class="mt-1 ${className.includes('text-danger') ? 'text-danger' : ''}">${value}</h2>
                  </div>
              </div>
              ${rightContent || trend
        ? `
                  <div class="text-right">
                      ${rightContent}
                      ${trend
          ? `
                          <div class="flex items-center justify-end gap-1.5 mt-1 ${trendColor}">
                              <i data-lucide="${trend.type === 'up' ? 'trending-up' : 'trending-down'}" class="w-4 h-4"></i>
                              <span class="text-sm font-semibold">${trend.value}</span>
                          </div>
                      `
          : ''
        }
                  </div>
              `
        : ''
      }
          </div>
      </div>
    `;
  }

  return `
    <div class="card p-5 relative ${className}">
        <div class="flex items-center gap-3 mb-3">
            ${icon
      ? `
                <div class="w-10 h-10 rounded-xl flex items-center justify-center ${iconClass}">
                    <i data-lucide="${icon}" class="w-5 h-5"></i>
                </div>
            `
      : ''
    }
            <p class="text-xs font-bold uppercase tracking-wider text-text-muted opacity-80">
                ${label}
            </p>
        </div>
        <h2 class="text-2xl font-extrabold tracking-tight text-gradient leading-tight">
            ${value}
        </h2>
        ${trend
      ? `
            <div class="flex items-center gap-1.5 mt-2 ${trendColor}">
                <i data-lucide="${trend.type === 'up' ? 'trending-up' : 'trending-down'}" class="w-4 h-4"></i>
                <span class="text-sm font-semibold">${trend.value}</span>
            </div>
        `
      : ''
    }
    </div>
`;
};
