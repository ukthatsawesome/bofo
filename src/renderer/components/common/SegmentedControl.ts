/**
 * SegmentedControl Component - Tailwind version
 * Toggle button group for filtering
 */

interface SegmentOption {
    label: string;
    value: string;
    active?: boolean;
}

interface SegmentedControlProps {
    id: string;
    options: SegmentOption[];
    onchange: string; // Function name string
    size?: 'sm' | 'default' | 'lg';
}

export const SegmentedControl = ({
    id,
    options,
    onchange,
    size = 'default'
}: SegmentedControlProps): string => {
    const sizes: Record<string, string> = {
        sm: 'text-xs px-3 py-1.5',
        default: 'text-sm px-4 py-2',
        lg: 'text-base px-5 py-2.5'
    };

    const sizeClass = sizes[size] || sizes.default;

    return `
    <div class="inline-flex bg-surface-input rounded-xl p-1 gap-1" id="${id}">
        ${options.map(item => `
            <button 
                class="segment ${sizeClass} rounded-lg font-semibold transition-all duration-200
                       ${item.active ? 'active' : ''}" 
                onclick="${onchange}('${item.value}')" 
                data-value="${item.value}"
            >
                ${item.label}
            </button>
        `).join('')}
    </div>
`;
};
