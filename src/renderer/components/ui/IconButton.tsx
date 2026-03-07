import { h, JSX } from 'preact';
import { clsx } from 'clsx';

interface IconButtonProps extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'icon'> {
  icon: any;
  variant?: 'ghost' | 'danger' | 'primary' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  tooltip?: string;
}

export const IconButton = ({
  icon: Icon,
  variant = 'ghost',
  size = 'md',
  tooltip,
  className,
  disabled,
  ...props
}: IconButtonProps) => {
  const variants = {
    ghost: 'text-text-muted hover:text-text-primary hover:bg-surface-active',
    danger: 'text-text-muted hover:text-danger hover:bg-danger/10',
    primary: 'text-text-muted hover:text-brand-primary hover:bg-brand-primary/10',
    subtle: 'text-text-muted/50 hover:text-text-muted hover:bg-surface-hover',
  };

  const sizes = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  return (
    <button
      type="button"
      className={clsx(
        'rounded-lg transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      title={tooltip}
      disabled={disabled}
      {...props}
    >
      <Icon size={iconSizes[size]} />
    </button>
  );
};
