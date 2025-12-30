/**
 * Modal Component - Tailwind version
 * Usage: Modal({ id: 'my-modal', title: 'Edit Item', content: '...', actions: '...' })
 */
export const Modal = ({
    id,
    title,
    content,
    actions = '',
    closeId = '',
    size = 'md'
}) => {
    // Size variants
    const sizes = {
        sm: 'max-w-md',
        md: 'max-w-xl',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl'
    };

    const sizeClass = sizes[size] || sizes.md;

    return `
    <div id="${id}" class="modal fixed inset-0 bg-black/85 backdrop-blur-sm z-[2000] flex items-center justify-center transition-all duration-300 hidden opacity-0 invisible pointer-events-none">
        <div class="modal-content bg-surface-card w-[90%] ${sizeClass} p-10 rounded-lg border border-border-strong shadow-premium relative animate-[modalSlideUp_0.5s_cubic-bezier(0.16,1,0.3,1)]">
            <button 
                class="close absolute right-7 top-7 text-3xl text-text-muted cursor-pointer transition-colors duration-200 hover:text-accent bg-transparent border-none" 
                id="${closeId || `close-${id}`}"
            >
                &times;
            </button>
            ${title ? `
                <h2 class="text-xl font-bold text-text-main mb-6">${title}</h2>
            ` : ''}
            <div class="modal-body">
                ${content}
            </div>
            ${actions ? `
                <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
                    ${actions}
                </div>
            ` : ''}
        </div>
    </div>
`;
};
