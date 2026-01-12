/**
 * Badge Component - Tailwind version
 * Usage: Badge({ label: 'Active', variant: 'success' })
 */

interface BadgeProps {
    label: string;
    variant?: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'active' | 'inactive';
    className?: string;
    id?: string;
    dot?: boolean;
}

export const Badge = ({
    label,
    variant = 'default',
    className = '',
    id = '',
    dot = false
}: BadgeProps): string => {
    // Variant classes
    const variants: Record<string, string> = {
        default: 'bg-surface-input text-text-muted',
        success: 'badge-success',
        danger: 'badge-danger',
        warning: 'badge-warning',
        info: 'bg-info/15 text-info',
        active: 'bg-success/15 text-success',
        inactive: 'bg-surface-input text-text-muted'
    };

    const variantClass = variants[variant] || variants.default;

    return `
    <span class="badge ${variantClass} ${className}" ${id ? `id="${id}"` : ''}>
        ${dot ? '<span class="status-dot"></span>' : ''}
        ${label}
    </span>
`;
};
