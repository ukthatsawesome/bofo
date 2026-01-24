/**
 * StatusBadge Component - Tailwind version
 */

interface StatusBadgeProps {
  label: string;
  variant?: 'active' | 'inactive' | 'warning' | 'danger' | 'info';
  id?: string;
}

export const StatusBadge = ({ label, variant = 'active', id = '' }: StatusBadgeProps): string => {
  const variants: Record<string, string> = {
    active: 'bg-success/15 text-success',
    inactive: 'bg-surface-input text-text-muted',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-danger/15 text-danger',
    info: 'bg-info/15 text-info',
  };

  const variantClass = variants[variant] || variants.active;

  return `
    <span 
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${variantClass}"
        ${id ? `id="${id}"` : ''}
    >
        <span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
        ${label}
    </span>
`;
};
