/**
 * ListItem Component - Tailwind version
 * For growth/trend displays
 */
export const ListItem = ({
    label,
    sublabel = '',
    value,
    trendType = 'neutral',
    icon = ''
}) => {
    const trendColors = {
        up: 'text-success bg-success/10',
        down: 'text-danger bg-danger/10',
        neutral: 'text-text-muted bg-surface-input'
    };

    const trendIcons = {
        up: 'trending-up',
        down: 'trending-down',
        neutral: 'minus'
    };

    const colorClass = trendColors[trendType] || trendColors.neutral;
    const trendIcon = icon || trendIcons[trendType];

    return `
    <div class="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
        <div class="flex flex-col">
            <span class="text-sm font-medium text-text-main">${label}</span>
            ${sublabel ? `<span class="text-xs text-text-muted opacity-70">${sublabel}</span>` : ''}
        </div>
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${colorClass}">
            <i data-lucide="${trendIcon}" class="w-3.5 h-3.5"></i>
            <span class="text-sm font-semibold">${value}</span>
        </div>
    </div>
`;
};
