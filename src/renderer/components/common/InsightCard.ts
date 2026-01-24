/**
 * InsightCard Component - Tailwind version
 * For AI insights and important messages
 */

interface InsightCardProps {
  title: string;
  message: string;
  icon?: string;
  id?: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
}

export const InsightCard = ({
  title,
  message,
  icon = 'lightbulb',
  id = '',
  variant = 'primary',
}: InsightCardProps): string => {
  const variants: Record<string, string> = {
    primary: 'card border-border shadow-sm bg-card',
    success: 'card border-success/30 shadow-sm bg-success/5',
    warning: 'card border-warning/30 shadow-sm bg-warning/5',
    danger: 'card border-danger/30 shadow-sm bg-danger/5',
  };

  const iconColors: Record<string, string> = {
    primary: 'text-brand-primary',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  };

  const variantClass = variants[variant] || variants.primary;
  const iconColor = iconColors[variant] || iconColors.primary;

  return `
    <div class="${variantClass} flex items-start gap-3 p-4 rounded-lg" ${id ? `id="${id}"` : ''}>
        <div class="w-10 h-10 rounded-xl bg-brand-primary/20 flex items-center justify-center shrink-0">
            <i data-lucide="${icon}" class="w-5 h-5 ${iconColor}"></i>
        </div>
        <div class="flex-1 min-w-0 pt-0.5">
            <h3 class="text-sm font-bold text-text-main mb-0.5 leading-none">${title}</h3>
            <p class="text-sm text-text-muted leading-snug">${message}</p>
        </div>
    </div>
`;
};
