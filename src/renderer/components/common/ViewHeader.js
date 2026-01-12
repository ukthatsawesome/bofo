/**
 * ViewHeader Component
 * 
 * Consistent header structure for all views.
 * Reduces ~50 lines of duplicated HTML per view.
 */

/**
 * @param {Object} props
 * @param {string} props.title - Main heading
 * @param {string} props.subtitle - Description text
 * @param {string} props.actions - HTML string for action buttons
 * @returns {string} HTML string
 */
export const ViewHeader = ({ title, subtitle = '', actions = '' }) => `
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
export const StatsContainer = (id, className = 'stats-grid mb-6') =>
    `<div id="${id}" class="${className}"></div>`;



/**
 * ActionButton Component
 * Consistent button with icon
 */
export const ActionButton = ({
    id = '',
    label,
    icon = 'plus',
    variant = 'primary',
    className = ''
}) => `
    <button class="btn ${variant} ${className}"${id ? ` id="${id}"` : ''}>
        <i data-lucide="${icon}"></i>
        ${label}
    </button>
`;

/**
 * FilterInput Component
 * Month filter input with container
 */
export const MonthFilterInput = ({ id, containerId = '' }) => `
    <div${containerId ? ` id="${containerId}"` : ''} class="filter-group">
        <input type="month" id="${id}" class="form-control sm">
    </div>
`;
