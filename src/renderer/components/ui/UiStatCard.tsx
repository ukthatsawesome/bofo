
import { h, FunctionalComponent } from 'preact';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import { UiCard } from './UiCard';

interface StatCardProps {
    label: string;
    value: string | number;
    icon: any; // Lucide or standard icon component
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string; // e.g., "+5%"
    color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
    className?: string;
    onClick?: () => void;
}

export const UiStatCard: FunctionalComponent<StatCardProps> = ({
    label,
    value,
    icon: Icon,
    trend,
    trendValue,
    color = 'primary',
    className,
    onClick
}) => {
    const colors = {
        primary: "text-indigo-600 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/10",
        success: "text-emerald-600 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/10",
        warning: "text-amber-600 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 dark:text-amber-400 border border-amber-100 dark:border-amber-500/10",
        danger: "text-rose-600 bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-800/20 dark:text-rose-400 border border-rose-100 dark:border-rose-500/10",
        info: "text-blue-600 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 dark:text-blue-400 border border-blue-100 dark:border-blue-500/10",
    };

    return (
        <UiCard
            className={twMerge("group flex items-start justify-between relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-default", className)}
            onClick={onClick}
            hoverEffect={!!onClick}
        >
            <div className="relative z-10">
                <p className="text-sm font-medium text-text-muted mb-2">{label}</p>
                <div className="text-3xl font-bold text-text-primary tracking-normal font-display">{value}</div>

                {trend && trendValue && (
                    <div className={twMerge("flex items-center gap-1.5 mt-3 text-sm font-bold bg-surface-active w-fit px-2 py-0.5 rounded-lg border border-border",
                        trend === 'up' ? "text-success" :
                            trend === 'down' ? "text-danger" :
                                "text-text-muted"
                    )}>
                        <span>{trend === 'up' ? '↗' : trend === 'down' ? '↘' : '•'}</span>
                        <span>{trendValue}</span>
                    </div>
                )}
            </div>

            <div className={twMerge("p-3.5 rounded-2xl flex items-center justify-center shadow-inner transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3", colors[color])}>
                {Icon && <Icon size={24} strokeWidth={2.5} />}
            </div>

            {/* Decoratiive Background Blur */}
            <div className={twMerge("absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
                color === 'primary' ? 'bg-indigo-500/10' :
                    color === 'success' ? 'bg-emerald-500/10' :
                        color === 'danger' ? 'bg-rose-500/10' : 'bg-slate-500/10'
            )} />
        </UiCard>
    );
};
