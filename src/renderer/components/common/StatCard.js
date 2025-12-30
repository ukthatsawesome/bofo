/**
 * StatCard Component - Tailwind version
 * Usage: StatCard({ label: 'Balance', value: '$1,000', icon: 'wallet' })
 */
export const StatCard = ({
    label,
    value,
    icon,
    type = 'default',
    trend = null,
    className = ''
}) => {
    // Trend color classes
    const trendColors = {
        up: 'text-success',
        down: 'text-danger',
        neutral: 'text-text-muted'
    };

    const trendColor = trend ? (trendColors[trend.type] || trendColors.neutral) : '';

    return `
    <div class="stat-card-tw ${className}">
        <div class="flex items-center gap-3 mb-3">
            ${icon ? `
                <div class="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                    <i data-lucide="${icon}" class="w-5 h-5 text-brand-primary"></i>
                </div>
            ` : ''}
            <p class="text-xs font-bold uppercase tracking-wider text-text-muted opacity-80">
                ${label}
            </p>
        </div>
        <h2 class="text-2xl font-extrabold tracking-tight text-gradient leading-tight">
            ${value}
        </h2>
        ${trend ? `
            <div class="flex items-center gap-1.5 mt-2 ${trendColor}">
                <i data-lucide="${trend.type === 'up' ? 'trending-up' : 'trending-down'}" class="w-4 h-4"></i>
                <span class="text-sm font-semibold">${trend.value}</span>
            </div>
        ` : ''}
    </div>
`;
};
