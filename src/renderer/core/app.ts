import { StateManager } from './state';
import { Formatter } from './formatter';
import { Router } from './router';
import { eventBus } from './eventBus';
import { UIUtils, $ } from './dom';
import { ChartManager } from '../components/charts/ChartManager';
import { NotificationManager } from '../components/notifications/NotificationManager';
import { NotificationModal } from '../components/notifications/NotificationModal';
import { CURRENCIES } from '../../shared/currencies';
import { aiInsightCache } from './aiInsightCache';
import { createFallbackGenerator, FallbackInsightGenerator } from './fallbackInsightGenerator';

// Views
import { DashboardView } from '../views/DashboardView';
import { TransactionsView } from '../views/TransactionsView';
import { ForecastView } from '../views/ForecastView';
import { BudgetView } from '../views/BudgetView';
import { GoalsView } from '../views/GoalsView';
import { SandboxView } from '../views/SandboxView';
import { RecurringChargesView } from '../views/RecurringChargesView';
import { BillsView } from '../views/BillsView';
import { SettingsView } from '../views/SettingsView';
import { AISettingsView } from '../views/AISettingsView';
import { BaseView } from '../views/BaseView';

// Modals
import { TransactionModal } from '../modals/TransactionModal';
import { AccountModal } from '../modals/AccountModal';
import { CategoryModal } from '../modals/CategoryModal';
import { BudgetModal } from '../modals/BudgetModal';
import { SandboxModal } from '../modals/SandboxModal';
import { BillTypeModal } from '../modals/BillTypeModal';
import { BillReadingModal } from '../modals/BillReadingModal';

interface ViewsMap {
    [key: string]: BaseView;
    dashboard: DashboardView;
    transactions: TransactionsView;
    forecast: ForecastView;
    budget: BudgetView;
    goals: GoalsView;
    whatif: SandboxView;
    recurring: RecurringChargesView;
    bills: BillsView;
    settings: SettingsView;
    'ai-settings': AISettingsView;
}

export class App {
    state: StateManager;
    formatter: Formatter;
    chartManager: ChartManager;
    notifications: NotificationManager;
    aiCache: typeof aiInsightCache;
    fallbackGenerator: FallbackInsightGenerator | null;
    views: ViewsMap;
    router: Router;
    currencies: typeof CURRENCIES;

    constructor() {
        this.state = new StateManager();
        this.formatter = new Formatter(this.state);
        this.chartManager = new ChartManager(this.state);
        this.notifications = new NotificationManager();
        this.aiCache = aiInsightCache;
        this.fallbackGenerator = null; // Initialized after formatter is ready

        this.views = {
            dashboard: new DashboardView(this),
            transactions: new TransactionsView(this),
            forecast: new ForecastView(this),
            budget: new BudgetView(this),
            goals: new GoalsView(this),
            whatif: new SandboxView(this),
            recurring: new RecurringChargesView(this),
            bills: new BillsView(this),
            settings: new SettingsView(this),
            'ai-settings': new AISettingsView(this)
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
                this.state.loadBudgets(),
                this.state.loadRecurringCharges()
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
        window.addEventListener('ai-connection-status', (e: any) => {
            this.updateAIStatusIndicator(e.detail.connected);
        });

        // Click handler - navigate directly to AI settings view
        navItem.addEventListener('click', () => {
            // Remove active from other nav items
            document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
            navItem.classList.add('active');

            this.router.navigate('ai-settings');
        });
    }

    /**
     * Update AI status indicator in sidebar
     */
    async updateAIStatusIndicator(status: boolean | null = null) {
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
        if (!aiSettings.enabled || !this.fallbackGenerator) return;

        try {
            // Prepare dashboard summary for prefetch
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            const mStats = this.state.transactions.reduce((acc, t) => {
                const tDate = new Date(t.start_date);
                if (tDate >= monthStart) {
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
                (data) => this.fallbackGenerator!.generateDashboardInsight(data),
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
        this.setupModalActions();
    }

    setupModalActions() {
        // --- Cross-Currency Logic ---
        const checkCurrencies = () => {
            const fromSelect = $('#modal-tx-account') as HTMLSelectElement;
            const toSelect = $('#modal-tx-to-account') as HTMLSelectElement;
            const activeSegment = document.querySelector('#transaction-modal .segment.active') as HTMLElement;
            const type = activeSegment?.dataset?.type;

            if (type !== 'transfer') {
                UIUtils.setHidden('#modal-tx-rate-group', true);
                return;
            }

            const fromCurrency = fromSelect.options[fromSelect.selectedIndex]?.dataset?.currency;
            const toCurrency = toSelect.options[toSelect.selectedIndex]?.dataset?.currency;

            const isMultiCurrency = fromCurrency && toCurrency && fromCurrency !== toCurrency;

            const rateInput = $('#modal-tx-exchange-rate') as HTMLInputElement;
            const toAmountInput = $('#modal-tx-to-amount') as HTMLInputElement;
            const rateGroup = $('#modal-tx-rate-group');

            if (isMultiCurrency) {
                if (rateGroup) rateGroup.classList.remove('hidden');
                if (rateInput) rateInput.disabled = false;
                if (toAmountInput) toAmountInput.disabled = false;
                if (rateInput && !rateInput.value) rateInput.value = '1';
                // Trigger calc
                updateCalculations('amount');
            } else {
                if (rateGroup) rateGroup.classList.add('hidden');
                if (rateInput) rateInput.disabled = true;
                if (toAmountInput) toAmountInput.disabled = true;
                if (toAmountInput) toAmountInput.value = '';
            }
        };

        const updateCalculations = (source: string) => {
            const amount = parseFloat(($('#modal-tx-amount') as HTMLInputElement).value) || 0;
            const rate = parseFloat(($('#modal-tx-exchange-rate') as HTMLInputElement)?.value) || 1;
            const toAmountInput = $('#modal-tx-to-amount') as HTMLInputElement;

            if (!toAmountInput || toAmountInput.disabled) return;

            if (source === 'amount' || source === 'rate') {
                toAmountInput.value = (amount * rate).toFixed(2);
            } else if (source === 'toAmount') {
                const toAmount = parseFloat(toAmountInput.value) || 0;
                if (amount > 0) {
                    const rateInput = $('#modal-tx-exchange-rate') as HTMLInputElement;
                    if (rateInput) rateInput.value = (toAmount / amount).toFixed(4);
                }
            }
        };

        // Attach listeners (using delegation or direct if elements exist)
        const attachCalcListeners = () => {
            const els = {
                from: $('#modal-tx-account'),
                to: $('#modal-tx-to-account'),
                amt: $('#modal-tx-amount'),
                rate: $('#modal-tx-exchange-rate'),
                toAmt: $('#modal-tx-to-amount')
            };
            if (els.from) els.from.addEventListener('change', checkCurrencies);
            if (els.to) els.to.addEventListener('change', checkCurrencies);
            if (els.amt) els.amt.addEventListener('input', () => updateCalculations('amount'));
            if (els.rate) els.rate.addEventListener('input', () => updateCalculations('rate'));
            if (els.toAmt) els.toAmt.addEventListener('input', () => updateCalculations('toAmount'));
        };
        attachCalcListeners();

        // --- Transaction Modal ---
        const btnTxSave = document.getElementById('modal-tx-save');
        if (btnTxSave) {
            const newBtn = btnTxSave.cloneNode(true);
            btnTxSave.parentNode?.replaceChild(newBtn, btnTxSave);

            newBtn.addEventListener('click', async () => {
                const amount = parseFloat(($('#modal-tx-amount') as HTMLInputElement).value);
                const date = ($('#modal-tx-date') as HTMLInputElement).value;
                const accountId = parseInt(($('#modal-tx-account') as HTMLSelectElement).value);
                const category = ($('#modal-tx-category') as HTMLSelectElement).value;
                const description = ($('#modal-tx-desc') as HTMLInputElement).value;
                const activeSegment = document.querySelector('#transaction-modal .segment.active') as HTMLElement;
                const type = activeSegment?.dataset?.type || 'expense';

                if (!amount || amount <= 0 || !date) {
                    return this.notifications.toast('Error', 'Please fill all required fields', 'error');
                }

                const tx: any = { amount, start_date: date, account_id: accountId, category, description, type, frequency: 'once' };

                // Handle transfer fields
                if (type === 'transfer') {
                    tx.to_account_id = parseInt(($('#modal-tx-to-account') as HTMLSelectElement).value);
                    tx.category = 'Transfer';
                    if (tx.account_id === tx.to_account_id) {
                        return this.notifications.toast('Error', 'Source and destination must be different', 'error');
                    }

                    // Capture cross-currency fields if active
                    const rateInput = $('#modal-tx-exchange-rate') as HTMLInputElement;
                    const toAmountInput = $('#modal-tx-to-amount') as HTMLInputElement;
                    if (rateInput && !rateInput.disabled) {
                        tx.exchange_rate = parseFloat(rateInput.value);
                        tx.to_amount = parseFloat(toAmountInput.value);
                    }
                }

                try {
                    await window.api.addTransaction(tx);
                    this.notifications.toast('Success', 'Transaction saved');
                    UIUtils.setHidden('#transaction-modal', true);
                    eventBus.emit('transaction:saved', undefined);
                } catch (e: any) {
                    this.notifications.alert('Error', e.message);
                }
            });
        }

        // --- Account Modal ---
        const btnAccSave = document.getElementById('save-account');
        if (btnAccSave) {
            const newBtn = btnAccSave.cloneNode(true);
            btnAccSave.parentNode?.replaceChild(newBtn, btnAccSave);

            newBtn.addEventListener('click', async () => {
                const name = ($('#acc-name') as HTMLInputElement).value;
                const type = ($('#acc-type') as HTMLSelectElement).value;
                const balance = parseFloat(($('#acc-balance') as HTMLInputElement).value) || 0;
                const currency = ($('#acc-currency') as HTMLSelectElement).value;

                if (!name) return this.notifications.toast('Error', 'Name is required', 'error');

                try {
                    await window.api.addAccount({ name, type, balance, currency });
                    this.notifications.toast('Success', 'Account created');
                    UIUtils.setHidden('#account-modal', true);
                    await this.state.loadAccounts();
                    this.updateAccountDropdowns();
                    // Optional: refresh current view if it's accounts-related
                    this.views[this.router.currentViewName!]?.render();
                } catch (e: any) {
                    this.notifications.alert('Error', e.message);
                }
            });
        }

        // --- Category Modal ---
        const btnCatSave = document.getElementById('save-category');
        if (btnCatSave) {
            const newBtn = btnCatSave.cloneNode(true);
            btnCatSave.parentNode?.replaceChild(newBtn, btnCatSave);

            newBtn.addEventListener('click', async () => {
                const name = ($('#new-cat-name') as HTMLInputElement).value;
                const type = ($('#new-cat-type') as HTMLSelectElement).value;

                if (!name) return this.notifications.toast('Error', 'Name is required', 'error');

                try {
                    await window.api.addCategory(type, name);
                    this.notifications.toast('Success', 'Category saved');
                    UIUtils.setHidden('#category-modal', true);
                    await this.state.loadCategories();
                    this.updateCategoryDropdowns();
                    // Refresh current view if needed
                    this.views[this.router.currentViewName!]?.render();
                } catch (e: any) {
                    this.notifications.alert('Error', e.message);
                }
            });
        }

        // --- Budget Modal ---
        const btnBudSave = document.getElementById('save-budget');
        if (btnBudSave) {
            const newBtn = btnBudSave.cloneNode(true);
            btnBudSave.parentNode?.replaceChild(newBtn, btnBudSave);

            newBtn.addEventListener('click', async () => {
                const category = ($('#budget-category') as HTMLSelectElement).value;
                const amount = parseFloat(($('#budget-limit') as HTMLInputElement).value);
                const period = ($('#budget-period') as HTMLSelectElement).value;
                const startNode = $('#budget-start') as HTMLInputElement;
                const endNode = $('#budget-end') as HTMLInputElement;

                // Determine dates if not manual
                let start = startNode.value;
                let end = endNode.value;

                if (!amount) return this.notifications.toast('Error', 'Amount is required', 'error');
                if (!start || !end) {
                    // Auto-fill if empty (simplification)
                    const now = new Date();
                    start = now.toISOString().split('T')[0];
                    const endDateObj = new Date();
                    if (period === 'monthly') endDateObj.setMonth(endDateObj.getMonth() + 1);
                    else if (period === 'weekly') endDateObj.setDate(endDateObj.getDate() + 7);
                    else endDateObj.setFullYear(endDateObj.getFullYear() + 1);
                    end = endDateObj.toISOString().split('T')[0];
                }

                try {
                    await window.api.setBudget(category, amount, period, start, end);
                    this.notifications.toast('Success', 'Budget set');
                    UIUtils.setHidden('#budget-modal', true);
                    if (this.router.currentView === 'budget') this.views.budget.render();
                } catch (e: any) {
                    this.notifications.alert('Error', e.message);
                }
            });
        }

        // --- Transaction Modal Type Toggles ---
        document.querySelectorAll('#transaction-modal .segment').forEach(seg => {
            seg.addEventListener('click', () => {
                document.querySelectorAll('#transaction-modal .segment').forEach(s => s.classList.remove('active'));
                seg.classList.add('active');

                const type = (seg as HTMLElement).dataset.type;
                if (type === 'transfer') {
                    UIUtils.setHidden('#modal-tx-to-account-group', false);
                    UIUtils.setHidden('#modal-tx-category', true);
                    checkCurrencies();
                } else {
                    UIUtils.setHidden('#modal-tx-to-account-group', true);
                    UIUtils.setHidden('#modal-tx-category', false);
                    checkCurrencies();
                }
            });
        });
    }

    setupModalListeners() {
        // Use event delegation for standard modal interactions
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            // Close button or Cancel button
            const closeBtn = target.closest('.modal .close, .modal .btn.secondary, [data-modal-close]');
            if (closeBtn) {
                const modal = closeBtn.closest('.modal');
                if (modal) {
                    UIUtils.setHidden(`#${modal.id}`, true);
                }
                return;
            }

            // Backdrop click (target is the modal itself)
            if (target.classList.contains('modal')) {
                UIUtils.setHidden(`#${target.id}`, true);
            }
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
            this.views[this.router.currentViewName!]?.render();
        });

        // Listen for AI settings changes
        eventBus.on('ai:settings-changed', async () => {
            await this.updateAIStatusIndicator();
            this.aiCache.invalidate(); // Clear all cached insights
        });

        // Global Escape key to close modals
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const visibleModals = document.querySelectorAll('.modal:not(.hidden)');
                visibleModals.forEach(modal => {
                    UIUtils.setHidden(`#${modal.id}`, true);
                });
            }
        });
    }

    populateCurrencyDropdowns() {
        const html = this.currencies.map(c => `<option value="${c.code}">${c.code} - ${c.name}</option>`).join('');
        document.querySelectorAll('.currency-select').forEach(el => {
            const select = el as HTMLSelectElement;
            const current = select.value;
            select.innerHTML = html;
            if (current) select.value = current;
        });
    }

    setLoading(isLoading: boolean) {
        const loader = document.getElementById('global-loader');
        if (loader) {
            if (isLoading) loader.classList.remove('hidden');
            else loader.classList.add('hidden');
        }
    }

    // Bridge methods for legacy support or global access
    async updateAppSetting(key: string, value: string | boolean) {
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
        const html = accounts.map(a => `<option value="${a.id}" data-currency="${a.currency}">${a.name} (${this.formatter.formatCurrency(a.balance, a.currency)})</option>`).join('');

        // Update both general dropdowns and modal specific ones
        const selectors = ['.account-dropdown', '#modal-tx-account', '#modal-tx-to-account'];
        selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                const select = el as HTMLSelectElement;
                const current = select.value;
                select.innerHTML = html;
                if (current) select.value = current;
            });
        });
    }

    updateCategoryDropdowns() {
        const categories = (this.state.categories || []).filter(c => c.status !== 'archived');
        const html = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

        const selectors = ['.category-dropdown', '#modal-tx-category', '#budget-category'];
        selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                const select = el as HTMLSelectElement;
                const current = select.value;
                select.innerHTML = html;
                if (current) select.value = current;
            });
        });
    }

    async handleDeleteTransaction(id: number) {
        if (await this.notifications.confirm('Delete Transaction', 'Are you sure you want to delete this transaction? This action cannot be undone.')) {
            try {
                await window.api.deleteTransaction(id);
                await Promise.all([
                    this.state.loadTransactions(),
                    this.state.loadAccounts()
                ]);
                this.views[this.router.currentViewName!]?.render();
                this.notifications.toast('Deleted', 'Transaction removed successfully');
            } catch (err: any) {
                this.notifications.alert('Error', err.message);
            }
        }
    }
}
