/**
 * EmptyState Component - Tailwind version
 * Displayed when no data is available
 */
export const EmptyState = ({
    icon = 'folder-open',
    title = 'No data found',
    message = 'There are no items to display here.',
    action = null
}) => `
    <div class="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div class="w-20 h-20 rounded-full bg-surface-input flex items-center justify-center mb-6">
            <i data-lucide="${icon}" class="w-10 h-10 text-text-muted opacity-50"></i>
        </div>
        <h3 class="text-lg font-semibold text-text-main mb-2">${title}</h3>
        <p class="text-sm text-text-muted max-w-xs">${message}</p>
        ${action ? `
            <button class="btn-primary mt-6" onclick="${action.onclick}">
                ${action.icon ? `<i data-lucide="${action.icon}" class="w-4 h-4"></i>` : ''}
                ${action.label}
            </button>
        ` : ''}
    </div>
`;
