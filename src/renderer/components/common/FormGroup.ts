/**
 * FormGroup Component - Tailwind version
 * Usage: FormGroup({ label: 'Email', content: '<input type="email" />' })
 */

interface FormGroupProps {
    label?: string;
    content: string;
    className?: string;
    icon?: string;
    required?: boolean;
    hint?: string;
}

export const FormGroup = ({
    label,
    content,
    className = '',
    icon = '',
    required = false,
    hint = ''
}: FormGroupProps): string => `
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

interface InputProps {
    type?: string;
    id?: string;
    name?: string;
    value?: string | number;
    placeholder?: string;
    required?: boolean;
    className?: string;
}

export const Input = ({
    type = 'text',
    id = '',
    name = '',
    value = '',
    placeholder = '',
    required = false,
    className = ''
}: InputProps): string => `
    <input 
        type="${type}"
        ${id ? `id="${id}"` : ''}
        ${name ? `name="${name}"` : ''}
        ${value !== undefined ? `value="${value}"` : ''}
        placeholder="${placeholder}"
        ${required ? 'required' : ''}
        class="input-field ${className}"
    />
`;

/**
 * Select field helper - returns Tailwind styled select
 */

interface SelectOption {
    value: string;
    label: string;
}

interface SelectProps {
    id?: string;
    name?: string;
    className?: string;
    options?: SelectOption[];
    value?: string;
}

export const Select = ({
    id = '',
    name = '',
    className = '',
    options = [],
    value = ''
}: SelectProps): string => `
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

interface TextareaProps {
    id?: string;
    name?: string;
    rows?: number;
    placeholder?: string;
    value?: string;
    className?: string;
}

export const Textarea = ({
    id = '',
    name = '',
    rows = 4,
    placeholder = '',
    value = '',
    className = ''
}: TextareaProps): string => `
    <textarea 
        ${id ? `id="${id}"` : ''}
        ${name ? `name="${name}"` : ''}
        rows="${rows}"
        placeholder="${placeholder}"
        class="input-field resize-y min-h-[100px] ${className}"
    >${value}</textarea>
`;
