/**
 * ViewHeader Component
 * 
 * Consistent header structure for all views.
 * Reduces ~50 lines of duplicated HTML per view.
 */

interface ViewHeaderProps {
    title: string;
    subtitle?: string;
    actions?: string;
}

export const ViewHeader = ({ title, subtitle = '', actions = '' }: ViewHeaderProps): string => `
    <div class="view-header">
        <div class="header-main">
            <h1>${title}</h1>
            ${subtitle ? `<p class="text-muted">${subtitle}</p>` : ''}
        </div>
        <div class="header-actions flex gap-3">
            ${actions}
        </div>
    </div>
`;

/**
 * StatsContainer Component
 * Container for stat cards with consistent styling
 */
export const StatsContainer = (id: string, className: string = 'stats-grid mb-6'): string =>
    `<div id="${id}" class="${className}"></div>`;

/**
 * ActionButton Component
 * Consistent button with icon
 */

interface ActionButtonProps {
    id?: string;
    label: string;
    icon?: string;
    variant?: string;
    className?: string;
}

export const ActionButton = ({
    id = '',
    label,
    icon = 'plus',
    variant = 'primary',
    className = ''
}: ActionButtonProps): string => `
    <button class="btn ${variant} ${className}"${id ? ` id="${id}"` : ''}>
        <i data-lucide="${icon}"></i>
        ${label}
    </button>
`;

/**
 * FilterInput Component
 * Month filter input with container
 */

interface MonthFilterInputProps {
    id: string;
    containerId?: string;
}

export const MonthFilterInput = ({ id, containerId = '' }: MonthFilterInputProps): string => `
    <div${containerId ? ` id="${containerId}"` : ''} class="filter-group">
        <input type="month" id="${id}" class="form-control sm">
    </div>
`;
