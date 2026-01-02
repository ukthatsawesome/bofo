/**
 * NotificationManager - Toast and modal notifications
 */
export class NotificationManager {
    constructor() {
        this.resolvePromise = null;
        // Bind event listeners only once the DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
    }

    setupEventListeners() {
        const confirmBtn = document.getElementById('notification-confirm');
        const cancelBtn = document.getElementById('notification-cancel');

        if (confirmBtn) {
            confirmBtn.onclick = (e) => {
                e.preventDefault();
                this.closeModal(true);
            };
        }
        if (cancelBtn) {
            cancelBtn.onclick = (e) => {
                e.preventDefault();
                this.closeModal(false);
            };
        }
    }

    /**
     * Show a non-intrusive toast notification
     */
    toast(title, message = '', type = 'success', duration = 3500) {
        const icons = {
            success: 'check-circle',
            error: 'alert-circle',
            info: 'info',
            warning: 'alert-triangle'
        };

        const colors = {
            success: 'bg-success/15 border-success/30 text-success',
            error: 'bg-danger/15 border-danger/30 text-danger',
            info: 'bg-info/15 border-info/30 text-info',
            warning: 'bg-warning/15 border-warning/30 text-warning'
        };

        const toast = document.createElement('div');
        toast.className = `flex items-center gap-3 p-4 rounded-xl border backdrop-blur-sm shadow-lg 
                          animate-[slideIn_0.3s_ease-out] ${colors[type] || colors.info}`;
        toast.innerHTML = `
            <div class="w-8 h-8 rounded-lg flex items-center justify-center">
                <i data-lucide="${icons[type] || 'info'}" class="w-5 h-5"></i>
            </div>
            <div class="flex-1">
                <div class="font-semibold text-sm">${title}</div>
                ${message ? `<div class="text-xs opacity-80">${message}</div>` : ''}
            </div>
        `;

        const container = document.getElementById('toast-container');
        if (container) {
            container.appendChild(toast);
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }

            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                toast.style.transition = 'all 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
    }

    /**
     * Show an intrusive modal for alerts or confirmations
     */
    async _showModal(title, message, type, isConfirm) {
        // Ensure any previously open modal is closed
        this.closeModal(false);

        return new Promise((resolve) => {
            this.resolvePromise = resolve;

            const titleEl = document.getElementById('notification-title');
            if (titleEl) titleEl.innerText = title;

            const msgEl = document.getElementById('notification-message');
            if (msgEl) msgEl.innerText = message;

            const icons = {
                success: 'check-circle',
                error: 'x-circle',
                warning: 'alert-triangle',
                info: 'info'
            };

            const iconEl = document.getElementById('notification-icon');
            if (iconEl) {
                // Remove existing type classes
                iconEl.classList.remove('success', 'error', 'warning', 'info', 'bg-success/20', 'bg-danger/20', 'bg-warning/20', 'bg-info/20', 'text-success', 'text-danger', 'text-warning', 'text-info');

                // Add new classes based on type
                iconEl.classList.add(type);
                const colorMap = {
                    success: ['bg-success/20', 'text-success'],
                    error: ['bg-danger/20', 'text-danger'],
                    warning: ['bg-warning/20', 'text-warning'],
                    info: ['bg-info/20', 'text-info']
                };
                if (colorMap[type]) {
                    iconEl.classList.add(...colorMap[type]);
                }
                iconEl.innerHTML = `<i data-lucide="${icons[type] || 'info'}" class="w-10 h-10"></i>`;
            }

            const cancelBtn = document.getElementById('notification-cancel');
            if (cancelBtn) {
                if (isConfirm) cancelBtn.classList.remove('hidden');
                else cancelBtn.classList.add('hidden');
            }

            const confirmBtn = document.getElementById('notification-confirm');
            if (confirmBtn) {
                confirmBtn.innerText = isConfirm ? 'Confirm' : 'Got it';
                confirmBtn.className = isConfirm ? 'btn-primary' : 'btn-secondary';
                if (type === 'error' || type === 'warning') {
                    confirmBtn.className = 'btn-danger';
                }
            }

            const modal = document.getElementById('notification-modal');
            if (modal) {
                modal.classList.remove('hidden', 'opacity-0', 'invisible', 'pointer-events-none');
            }
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        });
    }

    confirm(title, message, type = 'warning') {
        return this._showModal(title, message, type, true);
    }

    alert(title, message, type = 'info') {
        return this._showModal(title, message, type, false);
    }

    closeModal(result) {
        const modal = document.getElementById('notification-modal');
        if (modal) {
            modal.classList.add('hidden', 'opacity-0', 'invisible', 'pointer-events-none');
        }

        if (this.resolvePromise) {
            const resolve = this.resolvePromise;
            this.resolvePromise = null;
            resolve(result);
        }
    }
}
