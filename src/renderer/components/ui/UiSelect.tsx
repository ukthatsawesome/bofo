
import { JSX } from 'preact';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ChevronDown } from 'lucide-preact';
import { Label } from '@/components/ui/Typography';

interface UiSelectProps extends JSX.SelectHTMLAttributes<HTMLSelectElement> { // Changed from HTMLAttributes
    label?: string;
    error?: string;
    icon?: any;
    options: { label: string; value: string | number }[];
    fullWidth?: boolean;
    placeholder?: string;
}

export const UiSelect = ({
    label,
    error,
    icon: Icon,
    options,
    className,
    fullWidth = true,
    placeholder,
    disabled,
    ...props
}: UiSelectProps) => {
    return (
        <div className={clsx("flex flex-col gap-1.5", fullWidth && "w-full")}>
            {label && (
                <Label className="ml-1">{label}</Label>
            )}
            <div className="relative group">
                {Icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-primary transition-colors pointer-events-none">
                        <Icon size={16} />
                    </div>
                )}
                <select
                    disabled={disabled}
                    className={twMerge(clsx(
                        "flex h-10 w-full appearance-none rounded-xl border border-input bg-surface-input px-3 py-2 text-sm text-text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 focus-visible:border-brand-primary disabled:cursor-not-allowed disabled:opacity-50 transition-all cursor-pointer",
                        Icon && "pl-10",
                        error && "border-danger focus-visible:ring-danger/20",
                        className
                    ))}
                    {...props}
                >
                    {placeholder && <option value="" disabled selected>{placeholder}</option>}
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
                    <ChevronDown size={14} />
                </div>
            </div>
            {error && <p className="text-xs text-rose-500 font-medium ml-1">{error}</p>}
        </div>
    );
};
