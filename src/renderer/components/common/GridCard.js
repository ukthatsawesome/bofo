/**
 * GridCard Component - Tailwind version
 * Small info card for dashboard grids
 */
export const GridCard = ({
    title,
    icon,
    content,
    id = '',
    className = ''
}) => `
    <div class="card-panel ${className}" ${id ? `id="${id}"` : ''}>
        <h3 class="flex items-center gap-2 text-sm font-bold text-text-main mb-4">
            <i data-lucide="${icon}" class="w-4 h-4 text-brand-primary"></i>
            ${title}
        </h3>
        <div class="space-y-2">
            ${content}
        </div>
    </div>
`;
