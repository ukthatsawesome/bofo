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
    primary: 'insight-card-tw', // from tailwind-input.css
    success: 'bg-gradient-to-br from-success/10 to-success/5 border border-success/20',
    warning: 'bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/20',
    danger: 'bg-gradient-to-br from-danger/10 to-danger/5 border border-danger/20',
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
    <div class="${variantClass} flex items-start gap-4 p-5 rounded-lg" ${id ? `id="${id}"` : ''}>
        <div class="w-12 h-12 rounded-xl bg-brand-primary/20 flex items-center justify-center shrink-0">
            <i data-lucide="${icon}" class="w-6 h-6 ${iconColor}"></i>
        </div>
        <div class="flex-1 min-w-0">
            <h3 class="text-sm font-bold text-text-main mb-1">${title}</h3>
            <p class="text-sm text-text-muted leading-relaxed">${message}</p>
        </div>
    </div>
`;
};
