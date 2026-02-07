
import { JSX } from 'preact';

interface UiButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'soft' | 'gradient' | 'outline';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
    icon?: any;
    fullWidth?: boolean;
}

export const UiButton = ({
    children,
    className = '',
    variant = 'primary',
    size = 'md',
    isLoading = false,
    icon,
    fullWidth = false,
    disabled,
    ...props
}: UiButtonProps) => {

    const variants = {
        primary: 'bg-brand-primary text-white hover:bg-brand-primary/90 shadow-sm shadow-brand-primary/20',
        secondary: 'bg-surface-base text-text-primary border border-border hover:bg-surface-input',
        outline: 'bg-transparent text-text-secondary border border-border hover:bg-surface-base hover:text-text-primary',
        danger: 'bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20', // Soft danger
        ghost: 'bg-transparent text-text-muted hover:bg-surface-base hover:text-text-primary',
        soft: 'bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20',
        gradient: 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-md hover:shadow-lg hover:scale-[1.02] border-none'
    };

    const sizes = {
        sm: 'h-8 px-3 text-xs rounded-lg',
        md: 'h-10 px-4 text-sm rounded-xl',
        lg: 'h-12 px-6 text-base rounded-2xl',
        icon: 'h-10 w-10 p-0 rounded-xl flex items-center justify-center'
    };

    const width = fullWidth ? 'w-full' : '';
    const loading = isLoading ? 'opacity-70 cursor-not-allowed' : '';

    return (
        <button
            className={`
        inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 active:scale-[0.98]
        disabled:opacity-50 disabled:pointer-events-none outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400
        ${variants[variant] || variants.primary} ${sizes[size]} ${width} ${loading} ${className}
      `}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : icon}
            {children}
        </button>
    );
};
