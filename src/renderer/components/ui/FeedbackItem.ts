/**
 * FeedbackItem Component - Tailwind version
 * For displaying forecast insights and feedback messages
 */

interface FeedbackItemProps {
  type?: 'info' | 'success' | 'warning' | 'danger';
  icon?: string;
  title: string;
  message: string;
}

export const FeedbackItem = ({
  type = 'info',
  icon = 'info',
  title,
  message,
}: FeedbackItemProps): string => {
  const types: Record<string, string> = {
    info: 'border-info/30 bg-info/5',
    success: 'border-success/30 bg-success/5',
    warning: 'border-warning/30 bg-warning/5',
    danger: 'border-danger/30 bg-danger/5',
  };

  const iconColors: Record<string, string> = {
    info: 'text-info bg-info/20',
    success: 'text-success bg-success/20',
    warning: 'text-warning bg-warning/20',
    danger: 'text-danger bg-danger/20',
  };

  const typeClass = types[type] || types.info;
  const iconClass = iconColors[type] || iconColors.info;

  return `
    <div class="flex items-start gap-3 p-4 rounded-xl border ${typeClass}">
        <div class="w-9 h-9 rounded-lg ${iconClass} flex items-center justify-center shrink-0">
            <i data-lucide="${icon}" class="w-5 h-5"></i>
        </div>
        <div class="flex-1 min-w-0">
            <h4 class="text-sm font-bold text-text-main mb-0.5">${title}</h4>
            <p class="text-sm text-text-muted leading-relaxed">${message}</p>
        </div>
    </div>
`;
};
