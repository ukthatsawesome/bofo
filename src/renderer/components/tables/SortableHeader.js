/**
 * SortableHeader Component
 * Table header with sort indicators - Object syntax only
 * 
 * @param {Object} props
 * @param {string} props.label - Column display label
 * @param {string} props.field - Sort field name
 * @param {string} props.currentSort - Currently active sort field
 * @param {string} props.direction - Sort direction ('asc' or 'desc')
 * @param {string} props.onclick - Click handler function path
 */
export const SortableHeader = ({ label, field, currentSort, direction, onclick }) => {
    const isActive = field === currentSort;
    const icon = isActive ? (direction === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down';

    return `
        <th 
            class="px-5 py-4 text-left cursor-pointer select-none transition-colors hover:bg-brand-primary/10
                   ${isActive ? 'text-brand-primary' : 'text-text-secondary'}" 
            onclick="${onclick}('${field}')"
        >
            <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                <span>${label}</span>
                <i data-lucide="${icon}" class="w-3.5 h-3.5 ${isActive ? 'text-brand-primary opacity-100' : 'opacity-40'} transition-all"></i>
            </div>
        </th>
    `;
};
