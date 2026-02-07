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
    className?: string;
}

export function ToggleButtonGroup<T extends string>({
    options,
    value,
    onChange,
    size = 'md',
    className
}: ToggleButtonGroupProps<T>) {
    const sizes = {
        sm: 'py-1 px-2.5 text-xs',
        md: 'py-1.5 px-3 text-sm'
    };

    return (
        <div className={clsx("flex bg-surface-base p-1 rounded-xl", className)}>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    className={clsx(
                        "font-medium rounded-lg capitalize transition-all",
                        sizes[size],
                        value === option.value
                            ? 'bg-surface-card shadow-sm text-text-primary'
                            : 'text-text-muted hover:text-text-primary'
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
