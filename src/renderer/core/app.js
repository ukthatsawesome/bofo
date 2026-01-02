import { StateManager } from './state.js';
import { Formatter } from './formatter.js';
import { Router } from './router.js';
import { eventBus } from './eventBus.js';
import { UIUtils } from './dom.js';
import { ChartManager } from '../components/charts/ChartManager.js';
import { NotificationManager } from '../components/notifications/NotificationManager.js';
import { NotificationModal } from '../components/notifications/NotificationModal.js';
import { CURRENCIES } from '../../shared/currencies.js';
import { aiInsightCache } from './aiInsightCache.js';
import { createFallbackGenerator } from './fallbackInsightGenerator.js';

// Views
import { DashboardView } from '../views/DashboardView.js';
import { TransactionsView } from '../views/TransactionsView.js';
import { ForecastView } from '../views/ForecastView.js';
import { BudgetView } from '../views/BudgetView.js';
import { GoalsView } from '../views/GoalsView.js';
import { SandboxView } from '../views/SandboxView.js';
import { RecurringChargesView } from '../views/RecurringChargesView.js';
import { BillsView } from '../views/BillsView.js';
import { SettingsView } from '../views/SettingsView.js';

// Modals
import { TransactionModal } from '../modals/TransactionModal.js';
import { AccountModal } from '../modals/AccountModal.js';
import { CategoryModal } from '../modals/CategoryModal.js';
import { BudgetModal } from '../modals/BudgetModal.js';
import { SandboxModal } from '../modals/SandboxModal.js';
import { BillTypeModal } from '../modals/BillTypeModal.js';
import { BillReadingModal } from '../modals/BillReadingModal.js';

export class App {
    constructor() {
        this.state = new StateManager();
        this.formatter = new Formatter(this.state);
        this.chartManager = new ChartManager(this.state);
        this.notifications = new NotificationManager();
        this.aiCache = aiInsightCache;
        this.fallbackGenerator = null; // Initialized after formatter is ready

        this.views = {
            dashboard: new DashboardView(this, 'dashboard'),
            transactions: new TransactionsView(this, 'transactions'),
            forecast: new ForecastView(this, 'forecast'),
            budget: new BudgetView(this, 'budget'),
            goals: new GoalsView(this, 'goals'),
            whatif: new SandboxView(this, 'whatif'),
            recurring: new RecurringChargesView(this, 'recurring'),
            bills: new BillsView(this, 'bills'),
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

            // Initialize fallback generator with formatter
            this.fallbackGenerator = createFallbackGenerator(this.formatter);

            this.renderDynamicModals();
            this.populateCurrencyDropdowns();
            this.setupGlobalEvents();
            this.initAIStatusIndicator();

            // Initial view
            this.router.navigate('dashboard');

            this.setLoading(false);
            UIUtils.refreshIcons();

            // Background: Check AI connection and prefetch insights
            this.prefetchInsightsInBackground();
        } catch (error) {
            console.error('App initialization failed:', error);
            this.setLoading(false);
        }
    }

    /**
     * Initialize global AI status indicator in sidebar
     */
    initAIStatusIndicator() {
        const navItem = document.getElementById('ai-status-nav');
        if (!navItem) return;

        // Initially show checking state
        navItem.classList.add('ai-checking');

        // Check AI connection and update
        this.updateAIStatusIndicator();

        // Listen for connection status changes
        window.addEventListener('ai-connection-status', (e) => {
            this.updateAIStatusIndicator(e.detail.connected);
        });

        // Click handler - navigate directly to AI settings
        navItem.addEventListener('click', () => {
            // Remove active from other nav items
            document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
            navItem.classList.add('active');

            this.router.navigate('settings');
            setTimeout(() => {
                this.views.settings.showSubView('ai-settings');
            }, 100);
        });
    }

    /**
     * Update AI status indicator in sidebar
     */
    async updateAIStatusIndicator(status = null) {
        const navItem = document.getElementById('ai-status-nav');
        if (!navItem) return;

        // Remove all status classes
        navItem.classList.remove('ai-checking', 'ai-online', 'ai-offline', 'ai-disabled');

        // If status not provided, check it
        if (status === null) {
            const aiSettings = await window.api.getAISettings();
            if (!aiSettings.enabled) {
                navItem.classList.add('ai-disabled');
                return;
            }
            status = await this.aiCache.isAIAvailable();
        }

        // Apply the appropriate status class
        navItem.classList.add(status ? 'ai-online' : 'ai-offline');
        navItem.title = status ? 'AI Online - Click to configure' : 'AI Offline - Click to configure';
    }

    /**
     * Prefetch insights in background for faster view loads
     */
    async prefetchInsightsInBackground() {
        // Wait a bit after initial load
        await new Promise(resolve => setTimeout(resolve, 2000));

        const aiSettings = await window.api.getAISettings();
        if (!aiSettings.enabled) return;

        try {
            // Prepare dashboard summary for prefetch
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            const mStats = this.state.transactions.reduce((acc, t) => {
                if (new Date(t.start_date) >= monthStart) {
                    if (t.type === 'income') acc.income += t.amount;
                    if (t.type === 'expense') acc.expense += t.amount;
                }
                return acc;
            }, { income: 0, expense: 0 });

            const totalBalance = this.state.accounts.reduce((sum, a) => {
                const isAsset = ['bank', 'wallet', 'investment'].includes(a.type);
                return sum + (isAsset ? a.balance : -a.balance);
            }, 0);

            const summaryData = {
                balance: totalBalance,
                monthIncome: mStats.income,
                monthExpense: mStats.expense,
                savingsRate: mStats.income > 0 ? ((mStats.income - mStats.expense) / mStats.income * 100).toFixed(1) : 0
            };

            // Prefetch dashboard insight
            await this.aiCache.fetchInsight(
                'dashboard',
                summaryData,
                async (data) => await window.api.getAIInsight(data),
                (data) => this.fallbackGenerator.generateDashboardInsight(data),
                { aiTitle: 'AI Financial Insight', fallbackTitle: 'Financial Insight' }
            );
        } catch (err) {
            console.warn('Background prefetch failed:', err);
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
            ${BillTypeModal()}
            ${BillReadingModal({ billTypes: this.state.billTypes || [] })}
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

        document.getElementById('cancel-bill-type')?.addEventListener('click', () => {
            UIUtils.setHidden('#bill-type-modal', true);
        });

        document.getElementById('cancel-bill-reading')?.addEventListener('click', () => {
            UIUtils.setHidden('#bill-reading-modal', true);
        });
    }

    setupGlobalEvents() {
        // Handle global actions
        eventBus.on('transaction:saved', () => {
            this.state.loadTransactions();
            this.state.loadAccounts();
            // Invalidate AI insights cache when data changes
            this.aiCache.invalidate('dashboard');
            this.aiCache.invalidate('transactions');
            this.router.views[this.router.currentView]?.render();
        });

        // Listen for AI settings changes
        eventBus.on('ai:settings-changed', async () => {
            await this.updateAIStatusIndicator();
            this.aiCache.invalidate(); // Clear all cached insights
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
