/**
 * Button Component - Tailwind version
 * Usage: Button({ label: 'Save', variant: 'primary', icon: 'save' })
 */

interface ButtonProps {
  label: string;
  id?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'text';
  icon?: string;
  type?: 'button' | 'submit' | 'reset';
  onclick?: string;
  disabled?: boolean;
  size?: 'sm' | 'default' | 'lg';
}

export const Button = ({
  label,
  id,
  className = '',
  variant = 'primary',
  icon = '',
  type = 'button',
  onclick = '',
  disabled = false,
  size = 'default',
}: ButtonProps): string => {
  // Base classes for all buttons
  const baseClasses =
    'inline-flex items-center gap-2.5 font-bold cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]';

  // Size variants
  const sizes = {
    sm: 'px-4 py-2 text-[0.85rem] rounded-xl',
    default: 'px-7 py-3.5 text-[0.95rem] rounded-2xl',
    lg: 'px-11 py-4.5 text-[1.1rem] rounded-[20px]',
  };

  // Style variants - using CSS classes from tailwind-input.css for complex gradients
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    text: 'btn-text',
  };

  const sizeClass = sizes[size] || sizes.default;
  const variantClass = variants[variant] || variants.primary;

  // For text variant, override size classes
  const finalClasses =
    variant === 'text'
      ? `${variantClass} ${className}`.trim()
      : `${baseClasses} ${sizeClass} ${variantClass} ${className}`.trim();

  return `
    <button 
        type="${type}" 
        ${id ? `id="${id}"` : ''} 
        class="${finalClasses}" 
        ${onclick ? `onclick="${onclick}"` : ''}
        ${disabled ? 'disabled' : ''}
    >
        ${icon ? `<i data-lucide="${icon}" class="w-4 h-4"></i>` : ''}
        ${label}
    </button>
`;
};
