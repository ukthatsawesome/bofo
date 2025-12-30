import { StateManager } from './state.js';
import { Formatter } from './formatter.js';
import { Router } from './router.js';
import { eventBus } from './eventBus.js';
import { UIUtils } from './utils.js';
import { ChartManager } from '../components/charts/ChartManager.js';
import { NotificationManager } from '../components/notifications/NotificationManager.js';
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

        const accounts = this.state.accounts || [];
        const categories = this.state.categories || [];

        container.innerHTML = `
            ${TransactionModal({ accounts, categories })}
            ${AccountModal()}
            ${CategoryModal()}
            ${BudgetModal({ categories })}
            ${SandboxModal()}
        `;

        this.setupModalListeners();
    }

    setupModalListeners() {
        // Modal close buttons
        document.querySelectorAll('.modal .close').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal').classList.add('hidden');
            });
        });

        // Specific modal buttons
        document.getElementById('cancel-category')?.addEventListener('click', () => {
            document.getElementById('category-modal').classList.add('hidden');
        });

        document.getElementById('cancel-account')?.addEventListener('click', () => {
            document.getElementById('account-modal').classList.add('hidden');
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
        const accounts = this.state.accounts || [];
        const html = accounts.map(a => `<option value="${a.id}">${a.name} (${this.formatter.formatCurrency(a.balance, a.currency)})</option>`).join('');
        document.querySelectorAll('.account-dropdown').forEach(el => {
            el.innerHTML = html;
        });
    }
}
