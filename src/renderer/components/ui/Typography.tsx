import { JSX } from 'preact';
import { clsx } from 'clsx';

type TextVariant = 'default' | 'muted' | 'secondary' | 'inverse' | 'success' | 'danger' | 'warning';
type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold';
type TextSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

interface BaseTypographyProps {
  children: preact.ComponentChildren;
  className?: string;
}

interface TextProps extends BaseTypographyProps {
  variant?: TextVariant;
  weight?: TextWeight;
  size?: TextSize;
  as?: keyof JSX.IntrinsicElements;
}

const variantStyles: Record<TextVariant, string> = {
  default: 'text-text-primary',
  secondary: 'text-text-secondary',
  muted: 'text-text-muted',
  inverse: 'text-text-inverse',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
};

const weightStyles: Record<TextWeight, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

const sizeStyles: Record<TextSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl',
};

export const PageTitle = ({ children, className = '' }: BaseTypographyProps) => (
  <h1
    className={clsx('text-3xl font-bold tracking-tight text-text-primary font-display', className)}
  >
    {children}
  </h1>
);

export const SectionTitle = ({ children, className = '' }: BaseTypographyProps) => (
  <h2
    className={clsx('text-2xl font-bold tracking-tight text-text-primary font-display', className)}
  >
    {children}
  </h2>
);

export const SubsectionTitle = ({ children, className = '' }: BaseTypographyProps) => (
  <h3 className={clsx('text-lg font-semibold text-text-primary font-display', className)}>
    {children}
  </h3>
);

interface LabelProps extends BaseTypographyProps {
  htmlFor?: string;
}

export const Label = ({ children, className = '', htmlFor }: LabelProps) => (
  <label
    htmlFor={htmlFor}
    className={clsx('text-xs font-semibold text-text-muted uppercase tracking-wide', className)}
  >
    {children}
  </label>
);

export const Caption = ({ children, className = '' }: BaseTypographyProps) => (
  <p className={clsx('text-xs text-text-muted', className)}>{children}</p>
);

export const Text = ({
  children,
  className = '',
  variant = 'default',
  weight = 'normal',
  size = 'base',
  as = 'p',
}: TextProps) => {
  const Tag = as as any;
  return (
    <Tag
      className={clsx(variantStyles[variant], weightStyles[weight], sizeStyles[size], className)}
    >
      {children}
    </Tag>
  );
};
