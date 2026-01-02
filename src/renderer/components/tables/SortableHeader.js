/**
 * SortableHeader Component
 * Table header with sort indicators
 * Supports both positional arguments and object argument
 */
export const SortableHeader = (labelOrObj, field, currentField, direction, onclick) => {
    let label = labelOrObj;
    let currentSort = currentField;
    let sortField = field;
    let sortDirection = direction;
    let clickHandler = onclick;

    if (typeof labelOrObj === 'object' && labelOrObj !== null) {
        label = labelOrObj.label;
        sortField = labelOrObj.field;
        currentSort = labelOrObj.currentSort || labelOrObj.currentField;
        sortDirection = labelOrObj.direction;
        clickHandler = labelOrObj.onclick;
    }

    const isActive = sortField === currentSort;
    const icon = isActive ? (sortDirection === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down';

    return `
        <th 
            class="px-5 py-4 text-left cursor-pointer select-none transition-colors hover:bg-brand-primary/10
                   ${isActive ? 'text-brand-primary' : 'text-text-secondary'}" 
            onclick="${clickHandler}('${sortField}')"
        >
            <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                <span>${label}</span>
                <i data-lucide="${icon}" class="w-3.5 h-3.5 ${isActive ? 'text-brand-primary opacity-100' : 'opacity-40'} transition-all"></i>
            </div>
        </th>
    `;
};
