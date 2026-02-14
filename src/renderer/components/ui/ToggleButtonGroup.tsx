import { h } from 'preact';
import { clsx } from 'clsx';

interface ToggleOption<T extends string> {
    value: T;
    label: string;
}

interface ToggleButtonGroupProps<T extends string> {
    options: ToggleOption<T>[];
    value: T;
    onChange: (value: T) => void;
    size?: 'sm' | 'md';
    variant?: 'default' | 'primary' | 'outline';
    className?: string;
}

export function ToggleButtonGroup<T extends string>({
    options,
    value,
    onChange,
    size = 'md',
    variant = 'default',
    className
}: ToggleButtonGroupProps<T>) {
    const sizes = {
        sm: 'py-1 px-2.5 text-xs',
        md: 'py-1.5 px-3 text-sm'
    };

    const containerVariants = {
        default: 'bg-surface-base border border-transparent',
        primary: 'bg-surface-base border border-transparent',
        outline: 'bg-transparent border border-border'
    };

    const activeVariants = {
        default: 'bg-surface-card shadow-sm text-text-primary',
        primary: 'bg-brand-primary text-white shadow-sm',
        outline: 'bg-surface-active text-text-primary'
    };

    const inactiveVariants = {
        default: 'text-text-muted hover:text-text-primary',
        primary: 'text-text-muted hover:text-text-primary',
        outline: 'text-text-muted hover:text-text-primary'
    };

    return (
        <div className={clsx("flex p-1 rounded-xl transition-all", containerVariants[variant], className)}>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    className={clsx(
                        "flex-1 font-medium rounded-lg capitalize transition-all duration-200",
                        sizes[size],
                        value === option.value
                            ? activeVariants[variant]
                            : inactiveVariants[variant]
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
