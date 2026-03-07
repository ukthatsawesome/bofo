import { JSX } from 'preact';

interface UiCardProps {
  children: preact.ComponentChildren;
  className?: string;
  title?: string;
  subtitle?: string;
  variant?: 'default' | 'flat' | 'elevated' | 'glass';
  hoverEffect?: boolean;
  onClick?: () => void;
  actions?: preact.ComponentChildren;
  icon?: any;
  noPadding?: boolean;
}

export const UiCard = ({
  children,
  className = '',
  title,
  subtitle,
  variant = 'default',
  hoverEffect = false,
  onClick,
  actions,
  icon: Icon,
  noPadding = false,
}: UiCardProps) => {
  const variants = {
    default: 'bg-surface-card border border-border shadow-sm',
    flat: 'bg-surface-base border-none', // Matte finish
    elevated:
      'bg-surface-elevated shadow-lg shadow-black/5 dark:shadow-black/20 border-transparent',
    glass: 'bg-surface-card/70 backdrop-blur-md border border-border/50 shadow-sm',
  };

  const hovers = hoverEffect
    ? 'transition-all duration-300 hover:scale-[1.01] hover:shadow-md cursor-pointer'
    : '';

  const padding = noPadding ? 'p-0' : 'p-6';

  return (
    <div
      className={`rounded-2xl ${padding} ${variants[variant]} ${hovers} ${className}`}
      onClick={onClick}
    >
      {(title || subtitle || actions || Icon) && (
        <div
          className={`flex items-start justify-between mb-4 ${noPadding ? 'p-6 border-b border-border' : ''}`}
        >
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 bg-surface-active rounded-lg text-text-secondary">
                {typeof Icon === 'function' ? <Icon size={20} /> : Icon}
              </div>
            )}
            <div>
              {title && (
                <h3 className="text-lg font-bold tracking-tight text-text-primary font-display">
                  {title}
                </h3>
              )}
              {subtitle && <p className="text-sm text-text-muted font-medium">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
