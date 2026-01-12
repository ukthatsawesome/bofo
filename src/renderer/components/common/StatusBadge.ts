/**
 * StatusBadge Component - Tailwind version
 */

interface StatusBadgeProps {
    text: string;
    type?: 'active' | 'inactive' | 'warning' | 'danger' | 'info';
    id?: string;
}

// Convert from (text, type, id) to Object props to be consistent with others?
// Most components I migrated use Object props. 
// Original: (text, type='active', id='')
// I'll make it support Object props and update usage if found.
// Or I can support both? No, stick to one. Object props is cleaner.

export const StatusBadge = ({ text, type = 'active', id = '' }: StatusBadgeProps): string => {
    const types: Record<string, string> = {
        active: 'bg-success/15 text-success',
        inactive: 'bg-surface-input text-text-muted',
        warning: 'bg-warning/15 text-warning',
        danger: 'bg-danger/15 text-danger',
        info: 'bg-info/15 text-info'
    };

    const typeClass = types[type] || types.active;

    return `
    <span 
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${typeClass}"
        ${id ? `id="${id}"` : ''}
    >
        <span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
        ${text}
    </span>
`;
};
