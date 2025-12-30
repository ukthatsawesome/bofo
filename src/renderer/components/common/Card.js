/**
 * Card Component - Tailwind version
 * Usage: Card({ title: 'My Card', content: '<p>Content</p>', icon: 'box' })
 */
export const Card = ({
    title = '',
    content,
    id = '',
    className = '',
    footer = '',
    icon = '',
    variant = 'glass'
}) => {
    // Card variants using Tailwind classes
    const variants = {
        glass: 'card-glass', // from tailwind-input.css
        panel: 'card-panel', // from tailwind-input.css
        flat: 'bg-surface-card border border-border rounded-lg p-6'
    };

    const cardClass = variants[variant] || variants.glass;

    return `
    <div ${id ? `id="${id}"` : ''} class="${cardClass} ${className}">
        ${(title || icon) ? `
            <div class="flex items-center justify-between mb-4">
                <h3 class="flex items-center gap-2 text-base font-semibold text-text-main m-0">
                    ${icon ? `<i data-lucide="${icon}" class="w-5 h-5 text-brand-primary"></i>` : ''}
                    ${title}
                </h3>
            </div>
        ` : ''}
        <div class="card-body">
            ${content}
        </div>
        ${footer ? `
            <div class="mt-4 pt-4 border-t border-border">
                ${footer}
            </div>
        ` : ''}
    </div>
`;
};
