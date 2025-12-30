/**
 * Toast notification component
 */
export const Toast = ({ title, message, type = 'info' }) => {
    const icons = {
        success: 'check-circle',
        error: 'x-circle',
        warning: 'alert-triangle',
        info: 'info'
    };

    return `
        <div class="toast toast-${type}">
            <div class="toast-icon">
                <i data-lucide="${icons[type] || icons.info}"></i>
            </div>
            <div class="toast-content">
                ${title ? `<h4>${title}</h4>` : ''}
                <p>${message}</p>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i data-lucide="x"></i>
            </button>
        </div>
    `;
};
