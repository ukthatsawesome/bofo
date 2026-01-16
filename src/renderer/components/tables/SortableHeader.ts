/**
 * SortableHeader Component
 * Table header with sort indicators - Object syntax only
 */

interface SortableHeaderProps {
  label: string;
  field: string;
  currentSort: string;
  direction: 'asc' | 'desc';
  onclick: string;
}

export const SortableHeader = ({
  label,
  field,
  currentSort,
  direction,
  onclick,
}: SortableHeaderProps): string => {
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
