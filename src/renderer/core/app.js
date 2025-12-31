import { StateManager } from './state.js';
import { Formatter } from './formatter.js';
import { Router } from './router.js';
import { eventBus } from './eventBus.js';
import { UIUtils } from './utils.js';
import { ChartManager } from '../components/charts/ChartManager.js';
import { NotificationManager } from '../components/notifications/NotificationManager.js';
import { NotificationModal } from '../components/notifications/NotificationModal.js';
import { CURRENCIES } from '../../shared/currencies.js';

// Views
import { DashboardView } from '../views/DashboardView.js';
import { TransactionsView } from '../views/TransactionsView.js';
import { ForecastView } from '../views/ForecastView.js';
import { BudgetView } from '../views/BudgetView.js';
import { GoalsView } from '../views/GoalsView.js';
import { SandboxView } from '../views/SandboxView.js';
import { RecurringChargesView } from '../views/RecurringChargesView.js';
import { SettingsView } from '../views/SettingsView.js';

// Modals
import { TransactionModal } from '../modals/TransactionModal.js';
import { AccountModal } from '../modals/AccountModal.js';
import { CategoryModal } from '../modals/CategoryModal.js';
import { BudgetModal } from '../modals/BudgetModal.js';
import { SandboxModal } from '../modals/SandboxModal.js';

export class App {
    constructor() {
        this.state = new StateManager();
        this.formatter = new Formatter(this.state);
        this.chartManager = new ChartManager(this.state);
        this.notifications = new NotificationManager();

        this.views = {
            dashboard: new DashboardView(this, 'dashboard'),
            transactions: new TransactionsView(this, 'transactions'),
            forecast: new ForecastView(this, 'forecast'),
            budget: new BudgetView(this, 'budget'),
            goals: new GoalsView(this, 'goals'),
            whatif: new SandboxView(this, 'whatif'),
            recurring: new RecurringChargesView(this, 'recurring'),
            settings: new SettingsView(this, 'settings')
        };

        this.router = new Router(this);
        this.currencies = CURRENCIES;
    }

    async init() {
        try {
            this.setLoading(true);

            await Promise.all([
                this.state.loadSettings(),
                this.state.loadAccounts(),
                this.state.loadCategories(),
                this.state.loadTransactions(),
                this.state.loadBudgets()
            ]);

            this.renderDynamicModals();
            this.populateCurrencyDropdowns();
            this.setupGlobalEvents();

            // Initial view
            this.router.navigate('dashboard');

            this.setLoading(false);
            UIUtils.refreshIcons();
        } catch (error) {
            console.error('App initialization failed:', error);
            this.setLoading(false);
        }
    }

    renderDynamicModals() {
        const container = document.getElementById('dynamic-modals-container');
        if (!container) return;

        const accounts = (this.state.accounts || []).filter(a => a.status !== 'archived');
        const categories = (this.state.categories || []).filter(c => c.status !== 'archived');

        container.innerHTML = `
            ${TransactionModal({ accounts, categories })}
            ${AccountModal()}
            ${CategoryModal()}
            ${BudgetModal({ categories })}
            ${SandboxModal()}
        `;

        const notificationContainer = document.getElementById('notification-modal-container');
        if (notificationContainer) {
            notificationContainer.innerHTML = NotificationModal();
            this.notifications.setupEventListeners();
        }

        this.setupModalListeners();
    }

    setupModalListeners() {
        // Modal close buttons
        document.querySelectorAll('.modal .close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                if (modal) UIUtils.setHidden(`#${modal.id}`, true);
            });
        });

        // Specific modal buttons
        document.getElementById('cancel-category')?.addEventListener('click', () => {
            UIUtils.setHidden('#category-modal', true);
        });

        document.getElementById('cancel-account')?.addEventListener('click', () => {
            UIUtils.setHidden('#account-modal', true);
        });
    }

    setupGlobalEvents() {
        // Handle global actions
        eventBus.on('transaction:saved', () => {
            this.state.loadTransactions();
            this.state.loadAccounts();
            this.router.views[this.router.currentView]?.render();
        });
    }

    populateCurrencyDropdowns() {
        const html = this.currencies.map(c => `<option value="${c.code}">${c.code} - ${c.name}</option>`).join('');
        document.querySelectorAll('.currency-select').forEach(el => {
            const current = el.value;
            el.innerHTML = html;
            if (current) el.value = current;
        });
    }

    setLoading(isLoading) {
        const loader = document.getElementById('global-loader');
        if (loader) {
            if (isLoading) loader.classList.remove('hidden');
            else loader.classList.add('hidden');
        }
    }

    // Bridge methods for legacy support or global access
    async updateAppSetting(key, value) {
        const valStr = typeof value === 'boolean' ? String(value) : value;
        await window.api.updateSetting({ key, value: valStr });
        await this.state.loadSettings();
        if (key === 'theme') this.state.applyTheme(valStr);
    }

    handleNewTransaction() {
        this.router.navigate('transactions');
    }

    updateAccountDropdowns() {
        const accounts = (this.state.accounts || []).filter(a => a.status !== 'archived');
        const html = accounts.map(a => `<option value="${a.id}">${a.name} (${this.formatter.formatCurrency(a.balance, a.currency)})</option>`).join('');

        // Update both general dropdowns and modal specific ones
        const selectors = ['.account-dropdown', '#modal-tx-account', '#modal-tx-to-account'];
        selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                const current = el.value;
                el.innerHTML = html;
                if (current) el.value = current;
            });
        });
    }

    updateCategoryDropdowns() {
        const categories = (this.state.categories || []).filter(c => c.status !== 'archived');
        const html = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

        const selectors = ['.category-dropdown', '#modal-tx-category', '#budget-category'];
        selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                const current = el.value;
                el.innerHTML = html;
                if (current) el.value = current;
            });
        });
    }

    async handleDeleteTransaction(id) {
        if (await this.notifications.confirm('Delete Transaction', 'Are you sure you want to delete this transaction? This action cannot be undone.')) {
            try {
                await window.api.deleteTransaction(id);
                await Promise.all([
                    this.state.loadTransactions(),
                    this.state.loadAccounts()
                ]);
                this.router.views[this.router.currentView]?.render();
                this.notifications.toast('Deleted', 'Transaction removed successfully');
            } catch (err) {
                this.notifications.alert('Error', err.message);
            }
        }
    }
}
