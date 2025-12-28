class NotificationSystem {
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

        const toast = UIUtils.createElement('div', `toast ${type}`, `
            <div class="toast-icon"><i data-lucide="${icons[type] || 'info'}"></i></div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
        `);

        const container = document.getElementById('toast-container');
        if (container) {
            container.appendChild(toast);
            UIUtils.refreshIcons();

            setTimeout(() => {
                toast.classList.add('removing');
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
                iconEl.className = `notification-icon ${type}`;
                iconEl.innerHTML = `<i data-lucide="${icons[type] || 'info'}"></i>`;
            }

            const cancelBtn = document.getElementById('notification-cancel');
            if (cancelBtn) {
                if (isConfirm) cancelBtn.classList.remove('hidden');
                else cancelBtn.classList.add('hidden');
            }

            const confirmBtn = document.getElementById('notification-confirm');
            if (confirmBtn) {
                confirmBtn.innerText = isConfirm ? 'Confirm' : 'Got it';
                confirmBtn.className = isConfirm ? 'btn primary' : 'btn';
                if (type === 'error' || type === 'warning') {
                    confirmBtn.classList.add('danger');
                }
            }

            const modal = document.getElementById('notification-modal');
            if (modal) {
                modal.classList.remove('hidden');
            }
            UIUtils.refreshIcons();
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
            modal.classList.add('hidden');
        }

        if (this.resolvePromise) {
            const resolve = this.resolvePromise;
            this.resolvePromise = null;
            resolve(result);
        }
    }
}

// Global instance
window.notifications = new NotificationSystem();
