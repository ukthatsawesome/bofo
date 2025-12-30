/**
 * FormGroup Component - Tailwind version
 * Usage: FormGroup({ label: 'Email', content: '<input type="email" />' })
 */
export const FormGroup = ({
    label,
    content,
    className = '',
    icon = '',
    required = false,
    hint = ''
}) => `
    <div class="mb-6 ${className}">
        ${label ? `
            <label class="flex items-center gap-2 text-[0.85rem] font-bold uppercase tracking-wider text-text-muted mb-2.5">
                ${icon ? `<i data-lucide="${icon}" class="w-4 h-4"></i>` : ''}
                ${label}
                ${required ? '<span class="text-danger">*</span>' : ''}
            </label>
        ` : ''}
        ${content}
        ${hint ? `<p class="text-xs text-text-muted mt-1.5 opacity-70">${hint}</p>` : ''}
    </div>
`;

/**
 * Input field helper - returns Tailwind styled input
 */
export const Input = ({
    type = 'text',
    id = '',
    name = '',
    value = '',
    placeholder = '',
    required = false,
    className = ''
}) => `
    <input 
        type="${type}"
        ${id ? `id="${id}"` : ''}
        ${name ? `name="${name}"` : ''}
        ${value ? `value="${value}"` : ''}
        placeholder="${placeholder}"
        ${required ? 'required' : ''}
        class="input-field ${className}"
    />
`;

/**
 * Select field helper - returns Tailwind styled select
 */
export const Select = ({
    id = '',
    name = '',
    className = '',
    options = [],
    value = ''
}) => `
    <select 
        ${id ? `id="${id}"` : ''}
        ${name ? `name="${name}"` : ''}
        class="select-field ${className}"
    >
        ${options.map(opt => `
            <option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>
                ${opt.label}
            </option>
        `).join('')}
    </select>
`;

/**
 * Textarea field helper
 */
export const Textarea = ({
    id = '',
    name = '',
    rows = 4,
    placeholder = '',
    value = '',
    className = ''
}) => `
    <textarea 
        ${id ? `id="${id}"` : ''}
        ${name ? `name="${name}"` : ''}
        rows="${rows}"
        placeholder="${placeholder}"
        class="input-field resize-y min-h-[100px] ${className}"
    >${value}</textarea>
`;
