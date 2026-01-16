import { UIUtils } from '../../core/dom';

/**
 * ProgressBar Component - Tailwind version
 * Usage: ProgressBar({ label: 'Food', value: '$500', percent: 75 })
 */

interface ProgressBarProps {
  label: string;
  value: string;
  percent: number;
  color?: string;
  showPercent?: boolean;
  size?: 'sm' | 'default' | 'lg';
}

export const ProgressBar = ({
  label,
  value,
  percent,
  color = '',
  showPercent = true,
  size = 'default',
}: ProgressBarProps): string => {
  // Determine color based on percent if not provided
  const getAutoColor = (pct: number): string => {
    if (pct > 100) return 'bg-danger';
    if (pct > 85) return 'bg-warning';
    return 'bg-success';
  };

  const barColor = color || getAutoColor(percent);
  const clampedPercent = Math.min(percent, 100);

  // Size variants
  const sizes: Record<string, string> = {
    sm: 'h-1.5',
    default: 'h-2',
    lg: 'h-3',
  };

  const heightClass = sizes[size] || sizes.default;

  return `
    <div class="mb-3">
        <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-medium text-text-main">${UIUtils.escapeHTML(label)}</span>
            <span class="text-sm text-text-muted">
                ${UIUtils.escapeHTML(value)}
                ${showPercent ? `<span class="opacity-60 font-normal ml-1">(${percent.toFixed(0)}%)</span>` : ''}
            </span>
        </div>
        <div class="w-full ${heightClass} bg-surface-input rounded-full overflow-hidden">
            <div 
                class="h-full ${barColor} rounded-full transition-all duration-500 ease-out"
                style="width: ${clampedPercent}%"
            ></div>
        </div>
    </div>
`;
};
