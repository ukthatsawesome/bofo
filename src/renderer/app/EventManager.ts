/**
 * EventManager - Handles global application events
 * Extracted from App to maintain single responsibility
 */
import { eventBus } from '../lib/eventBus';
import { UIUtils } from '../lib/dom';
import type { App } from './App';

export class EventManager {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Setup all global event listeners
     */
    setup(): void {
        this.setupEventBusListeners();
        this.setupKeyboardListeners();
        this.setupThemeListeners();
    }

    /**
     * EventBus-based events (transaction, api, ai)
     */
    private setupEventBusListeners(): void {
        // Handle transaction saved
        eventBus.on('transaction:saved', () => {
            this.app.state.loadTransactions();
            this.app.state.loadAccounts();
            this.app.aiCache.invalidate('dashboard');
            this.app.aiCache.invalidate('transactions');
            this.app.views[this.app.router.currentViewName!]?.render();
        });

        // Global API Error Handler
        eventBus.on('api:error', (error: any) => {
            const title = error.code ? error.code.replace(/_/g, ' ') : 'Error';
            this.app.notifications.toast(title, error.message || 'Operation failed', 'error');
        });

        // AI settings changes
        eventBus.on('ai:settings-changed', async () => {
            await this.app.updateAIStatusIndicator();
            this.app.aiCache.invalidate();
        });
    }

    /**
     * Keyboard shortcuts and focus trap
     */
    private setupKeyboardListeners(): void {
        window.addEventListener('keydown', (e) => {
            // Escape to close modals
            if (e.key === 'Escape') {
                const visibleModals = document.querySelectorAll('.modal:not(.hidden)');
                visibleModals.forEach((modal) => {
                    UIUtils.setHidden(`#${modal.id}`, true);
                });
                return;
            }

            // Tab for Focus Trap in modals
            if (e.key === 'Tab') {
                this.handleFocusTrap(e);
            }
        });
    }

    /**
     * Modal focus trap (accessibility)
     */
    private handleFocusTrap(e: KeyboardEvent): void {
        const visibleModal = document.querySelector('.modal:not(.hidden)') as HTMLElement;
        if (!visibleModal) return;

        const focusableElements = visibleModal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                lastElement.focus();
                e.preventDefault();
            }
        } else {
            if (document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
            }
        }
    }

    /**
     * Theme change listeners
     */
    private setupThemeListeners(): void {
        // Theme Change Listener - re-render current view for charts
        window.addEventListener('theme-changed', () => {
            const currentView = this.app.views[this.app.router.currentViewName!];
            if (currentView) {
                currentView.render();
            }
        });

        // Native Theme Synchronization (system theme changes)
        window.api.onNativeThemeChanged((isDark: boolean) => {
            if (this.app.state.theme === 'system') {
                const mode = isDark ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', mode);
                localStorage.setItem('bofo_theme_cache', mode);

                if (mode === 'dark') {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }

                window.dispatchEvent(new CustomEvent('theme-changed', { detail: { mode, theme: 'system' } }));
            }
        });
    }
}
