/**
 * EventManager - Handles global application events
 * Extracted from App to maintain single responsibility
 */
import { eventBus } from '../lib/eventBus';
import { UIUtils } from '../lib/dom';
import type { App } from './App';

export class EventManager {
    private app: App;

    // CSS selector for elements that can receive focus within a modal
    private static readonly FOCUSABLE_SELECTOR =
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

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

    // ---------------------------------------------------------------------------
    // Event Bus Listeners
    // ---------------------------------------------------------------------------

    private setupEventBusListeners(): void {
        // Handle transaction saved
        eventBus.on('transaction:saved', () => {
            // Reload data asynchronously
            this.app.state.loadTransactions();
            this.app.state.loadAccounts();

            // Invalidate AI cache
            this.app.aiCache.invalidate('dashboard');
            this.app.aiCache.invalidate('transactions');

            // Refresh current view
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

    // ---------------------------------------------------------------------------
    // Keyboard Listeners
    // ---------------------------------------------------------------------------

    private setupKeyboardListeners(): void {
        window.addEventListener('keydown', (e) => {
            // Escape to close modals
            if (e.key === 'Escape') {
                this.closeAllModals();
                return;
            }

            // Tab for Focus Trap in modals
            if (e.key === 'Tab') {
                this.handleFocusTrap(e);
            }
        });
    }

    /**
     * Closes all visible modals
     */
    private closeAllModals(): void {
        const visibleModals = document.querySelectorAll('.modal:not(.hidden)');
        visibleModals.forEach((modal) => {
            UIUtils.setHidden(`#${modal.id}`, true);
        });
    }

    /**
     * Modal focus trap (accessibility)
     * Ensures Tab cycling stays within the active modal
     */
    private handleFocusTrap(e: KeyboardEvent): void {
        const visibleModal = document.querySelector('.modal:not(.hidden)') as HTMLElement;
        if (!visibleModal) return;

        const focusableElements = Array.from(
            visibleModal.querySelectorAll(EventManager.FOCUSABLE_SELECTOR)
        ) as HTMLElement[];

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // If shifting tab, cycle backwards; otherwise cycle forwards
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

    // ---------------------------------------------------------------------------
    // Theme Listeners
    // ---------------------------------------------------------------------------

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

                // Apply theme attributes and classes
                document.documentElement.setAttribute('data-theme', mode);
                document.documentElement.classList.toggle('dark', mode === 'dark');

                // Cache locally for initialization
                localStorage.setItem('bofo_theme_cache', mode);

                // Notify listeners
                window.dispatchEvent(
                    new CustomEvent('theme-changed', { detail: { mode, theme: 'system' } })
                );
            }
        });
    }
}