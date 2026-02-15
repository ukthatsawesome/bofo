
import { JSX } from 'preact';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Label } from '@/components/ui/Typography';
import { useId } from 'preact/hooks';

interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: any;
    fullWidth?: boolean;
}

export const Input = ({
    label,
    error,
    icon: Icon,
    className,
    fullWidth = true,
    disabled,
    id,
    ...props
}: InputProps) => {
    const generatedId = useId() as string;
    const inputId = String(id ?? generatedId);
    const errorId = error ? `${inputId}-error` : undefined;

    return (
        <div className={clsx("flex flex-col gap-1.5", fullWidth && "w-full")}>
            {label && (
                <Label className="ml-1" htmlFor={inputId}>{label}</Label>
            )}
            <div className="relative group">
                {Icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-primary transition-colors">
                        <Icon size={16} />
                    </div>
                )}
                <input
                    id={inputId}
                    disabled={disabled}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={errorId}
                    className={twMerge(clsx(
                        "h-10 w-full rounded-xl border border-input bg-surface-input px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 focus-visible:border-brand-primary disabled:cursor-not-allowed disabled:opacity-50 transition-all",
                        Icon && "pl-10",
                        error && "border-danger focus-visible:ring-danger/20",
                        className
                    ))}
                    {...props}
                />
            </div>
            {error && <p id={errorId} className="text-xs text-rose-500 font-medium ml-1" role="alert">{error}</p>}
        </div>
    );
};
