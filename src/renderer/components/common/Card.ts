/**
 * Card Component - Tailwind version
 * Usage: Card({ title: 'My Card', content: '<p>Content</p>', icon: 'box' })
 */

interface CardProps {
  title?: string;
  content: string;
  id?: string;
  className?: string;
  footer?: string;
  icon?: string;
  variant?: 'glass' | 'panel' | 'default' | 'flat';
  bodyClass?: string;
}

export const Card = ({
  title = '',
  content,
  id = '',
  className = '',
  footer = '',
  icon = '',
  variant = 'default',
  bodyClass = '',
}: CardProps): string => {
  // Card variants using Tailwind classes
  const variants: Record<string, string> = {
    glass: 'card-glass', // from tailwind-input.css
    panel: 'card-panel', // from tailwind-input.css
    default: 'card',
    flat: 'bg-surface-card border border-border rounded-lg p-6',
  };

  const cardClass = variants[variant] || variants.glass;
  const headerPadding = (variant === 'default' || variant === 'glass') ? 'px-6 pt-6' : '';

  return `
    <div ${id ? `id="${id}"` : ''} class="${cardClass} ${className}">
        ${title || icon
      ? `
            <div class="flex items-center justify-between mb-4 ${headerPadding}">
                <h3 class="flex items-center gap-2 text-base font-semibold text-text-main m-0 min-w-0 overflow-hidden">
                    ${icon ? `<i data-lucide="${icon}" class="w-5 h-5 text-brand-primary shrink-0"></i>` : ''}
                    <span class="truncate" title="${title}">${title}</span>
                </h3>
            </div>
        `
      : ''
    }
        <div class="card-body ${bodyClass}">
            ${content}
        </div>
        ${footer
      ? `
            <div class="mt-4 pt-4 border-t border-border">
                ${footer}
            </div>
        `
      : ''
    }
    </div>
`;
};
