
import { JSX } from 'preact';

interface StatusBadgeProps {
    status: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'active' | 'archived';
    children: preact.ComponentChildren;
    className?: string;
    variant?: 'pill' | 'soft'; // Pill is full rounded, soft is rounded-lg
}

export const StatusBadge = ({
    status,
    children,
    className = '',
    variant = 'pill'
}: StatusBadgeProps) => {

    const styles = {
        success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20',
        active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20',

        warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20',

        danger: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200/50 dark:border-rose-500/20',
        archived: 'bg-surface-active text-text-muted border border-border',

        info: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20',

        neutral: 'bg-surface-active text-text-secondary border border-border'
    };

    const shapes = {
        pill: 'rounded-full px-3 py-1',
        soft: 'rounded-lg px-2.5 py-1'
    };

    // Default mapping for unknown status
    const finalStyle = styles[status] || styles.neutral;

    return (
        <span className={`inline-flex items-center text-xs font-medium tracking-wide ${shapes[variant]} ${finalStyle} ${className}`}>
            {children}
        </span>
    );
};
