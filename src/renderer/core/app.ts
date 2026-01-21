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
      'ai-settings': new AISettingsView(this),
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
        this.state.loadRecurringCharges(),
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
      this.showInitError(error as Error);
    }
  }

  /**
   * Show user-friendly error UI when app fails to initialize
   */
  showInitError(error: Error) {
    const main = document.getElementById('main-content');
    if (main) {
      main.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2rem; text-align: center;">
                    <div style="background: var(--card-bg, #fff); border-radius: 16px; padding: 2rem 3rem; box-shadow: 0 4px 24px rgba(0,0,0,0.1); max-width: 480px;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                        <h2 style="margin: 0 0 0.5rem; color: var(--text-primary, #1a1a2e);">Connection Failed</h2>
                        <p style="color: var(--text-secondary, #666); margin-bottom: 1.5rem;">
                            Could not connect to the backend server.<br>
                            <small style="opacity: 0.7;">${error.message || 'Unknown error'}</small>
                        </p>
                        <div style="display: flex; gap: 0.75rem; justify-content: center;">
                            <button onclick="window.location.reload()" style="padding: 0.75rem 1.5rem; border-radius: 8px; border: none; background: var(--primary, #4f46e5); color: white; cursor: pointer; font-weight: 500;">
                                Retry Connection
                            </button>
                            <button onclick="localStorage.removeItem('bofo_remote_host'); localStorage.removeItem('bofo_remote_key'); window.location.reload();" style="padding: 0.75rem 1.5rem; border-radius: 8px; border: 1px solid var(--border, #e5e7eb); background: transparent; cursor: pointer; font-weight: 500;">
                                Reset Config
                            </button>
                        </div>
                    </div>
                </div>
            `;
    }
  }

  /**
   * Reload all state data from the backend
   */
  async loadData(): Promise<void> {
    await Promise.all([
      this.state.loadSettings(),
      this.state.loadAccounts(),
      this.state.loadCategories(),
      this.state.loadTransactions(),
      this.state.loadBudgets(),
      this.state.loadRecurringCharges(),
    ]);
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

    // Poll for connection status (cache handles throttling)
    // This ensures the red icon turns green without page reload
    setInterval(() => this.updateAIStatusIndicator(), 5000);

    // Click handler - navigate directly to AI settings view
    navItem.addEventListener('click', () => {
      // Remove active from other nav items
      document.querySelectorAll('.nav-links li').forEach((li) => li.classList.remove('active'));
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
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const aiSettings = await window.api.getAISettings();
    if (!aiSettings.enabled || !this.fallbackGenerator) return;

    try {
      // Prepare dashboard summary for prefetch
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const mStats = this.state.transactions.reduce(
        (acc, t) => {
          const tDate = new Date(t.start_date);
          if (tDate >= monthStart) {
            if (t.type === 'income') acc.income += t.amount;
            if (t.type === 'expense') acc.expense += t.amount;
          }
          return acc;
        },
        { income: 0, expense: 0 }
      );

      const totalBalance = this.state.accounts.reduce((sum, a) => {
        const isAsset = ['bank', 'wallet', 'investment'].includes(a.type);
        return sum + (isAsset ? a.balance : -a.balance);
      }, 0);

      const summaryData = {
        balance: totalBalance,
        monthIncome: mStats.income,
        monthExpense: mStats.expense,
        savingsRate:
          mStats.income > 0
            ? (((mStats.income - mStats.expense) / mStats.income) * 100).toFixed(1)
            : 0,
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

    const accounts = (this.state.accounts || []).filter((a) => a.status !== 'archived');
    const categories = (this.state.categories || []).filter((c) => c.status !== 'archived');

    container.innerHTML = `
            ${TransactionModal({ accounts, categories })}
            ${AccountModal()}
            ${CategoryModal()}
            ${BudgetModal({ categories })}
            ${SandboxModal()}
            ${BillTypeModal()}
            ${BillReadingModal({ billTypes: (this.state.billTypes as any) || [] })}
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
    const checkCurrencies = async () => {
      const fromSelect = $('#modal-tx-account') as HTMLSelectElement;
      const toSelect = $('#modal-tx-to-account') as HTMLSelectElement;
      const activeSegment = document.querySelector(
        '#transaction-modal .segment.active'
      ) as HTMLElement;
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
      const rateSourceHint = $('#modal-tx-rate-source');

      if (isMultiCurrency) {
        if (rateGroup) rateGroup.classList.remove('hidden');
        if (rateInput) rateInput.disabled = false;
        if (toAmountInput) toAmountInput.disabled = false;

        // Auto-fetch stored exchange rate
        try {
          const storedRate = await window.api.getExchangeRate(fromCurrency, toCurrency);
          if (storedRate !== null && rateInput) {
            rateInput.value = storedRate.toFixed(6);
            if (rateSourceHint) {
              rateSourceHint.textContent = '(from saved rates)';
              rateSourceHint.classList.remove('text-warning');
              rateSourceHint.classList.add('text-success');
            }
          } else if (rateInput && !rateInput.value) {
            rateInput.value = '1';
            if (rateSourceHint) {
              rateSourceHint.textContent = '(no rate found - enter manually)';
              rateSourceHint.classList.remove('text-success');
              rateSourceHint.classList.add('text-warning');
            }
          }
        } catch {
          if (rateInput && !rateInput.value) rateInput.value = '1';
        }

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
        toAmt: $('#modal-tx-to-amount'),
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
        const activeSegment = document.querySelector(
          '#transaction-modal .segment.active'
        ) as HTMLElement;
        const type = activeSegment?.dataset?.type || 'expense';

        if (!amount || amount <= 0 || !date) {
          return this.notifications.toast('Error', 'Please fill all required fields', 'error');
        }

        const tx: any = {
          amount,
          start_date: date,
          account_id: accountId,
          category,
          description,
          type,
          frequency: 'once',
        };

        // Handle transfer fields
        if (type === 'transfer') {
          tx.to_account_id = parseInt(($('#modal-tx-to-account') as HTMLSelectElement).value);
          tx.category = 'Transfer';
          if (tx.account_id === tx.to_account_id) {
            return this.notifications.toast(
              'Error',
              'Source and destination must be different',
              'error'
            );
          }

          // Always set exchange rate and to_amount for transfers
          const rateInput = $('#modal-tx-exchange-rate') as HTMLInputElement;
          const toAmountInput = $('#modal-tx-to-amount') as HTMLInputElement;

          // Check if cross-currency (rate input is enabled)
          if (rateInput && !rateInput.disabled && rateInput.value) {
            tx.exchange_rate = parseFloat(rateInput.value) || 1;
            tx.to_amount = parseFloat(toAmountInput?.value) || amount * tx.exchange_rate;
          } else {
            // Same currency transfer - rate is 1:1
            tx.exchange_rate = 1;
            tx.to_amount = amount;
          }

          console.log('[Transfer] exchange_rate:', tx.exchange_rate, 'to_amount:', tx.to_amount);
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
          await window.api.addAccount({ name, type: type as any, balance, currency });
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
          await window.api.addCategory({ type: type as any, name });
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
    // NOTE: Budget save is handled by BudgetView.setupEventListeners()
    // Do not add a duplicate handler here to avoid creating duplicate budget records

    // --- Transaction Modal Type Toggles ---
    document.querySelectorAll('#transaction-modal .segment').forEach((seg) => {
      seg.addEventListener('click', () => {
        document
          .querySelectorAll('#transaction-modal .segment')
          .forEach((s) => s.classList.remove('active'));
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

    // Global API Error Handler
    eventBus.on('api:error', (error: any) => {
      const title = error.code ? error.code.replace(/_/g, ' ') : 'Error';
      this.notifications.toast(title, error.message || 'Operation failed', 'error');
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
        visibleModals.forEach((modal) => {
          UIUtils.setHidden(`#${modal.id}`, true);
        });
      }
    });

    // Theme Change Listener
    window.addEventListener('theme-changed', () => {
      const currentView = this.views[this.router.currentViewName!];
      if (currentView) {
        // Re-render to update charts with new theme colors
        currentView.render();
      }
    });

    // Native Theme Synchronization
    window.api.onNativeThemeChanged((isDark: boolean) => {
      // Only react if we are in system mode
      if (this.state.theme === 'system') {
        const mode = isDark ? 'dark' : 'light';
        // Force update the UI without changing state.theme
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

  populateCurrencyDropdowns() {
    const html = this.currencies
      .map((c) => `<option value="${c.code}">${c.code} - ${c.name}</option>`)
      .join('');
    document.querySelectorAll('.currency-select').forEach((el) => {
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

  async toggleTheme(theme: string) {
    await this.updateAppSetting('theme', theme);
  }

  handleNewTransaction() {
    this.router.navigate('transactions');
  }

  updateAccountDropdowns() {
    const accounts = (this.state.accounts || []).filter((a) => a.status !== 'archived');
    const html = accounts
      .map(
        (a) =>
          `<option value="${a.id}" data-currency="${a.currency}">${a.name} (${this.formatter.formatCurrency(a.balance, a.currency)})</option>`
      )
      .join('');

    // Update both general dropdowns and modal specific ones
    const selectors = ['.account-dropdown', '#modal-tx-account', '#modal-tx-to-account'];
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        const select = el as HTMLSelectElement;
        const current = select.value;
        select.innerHTML = html;
        if (current) select.value = current;
      });
    });
  }

  updateCategoryDropdowns() {
    const categories = (this.state.categories || []).filter((c) => c.status !== 'archived');
    const html = categories.map((c) => `<option value="${c.name}">${c.name}</option>`).join('');

    const selectors = ['.category-dropdown', '#modal-tx-category', '#budget-category'];
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        const select = el as HTMLSelectElement;
        const current = select.value;
        select.innerHTML = html;
        if (current) select.value = current;
      });
    });
  }

  async handleDeleteTransaction(id: number) {
    if (
      await this.notifications.confirm(
        'Delete Transaction',
        'Are you sure you want to delete this transaction? This action cannot be undone.'
      )
    ) {
      try {
        await window.api.deleteTransaction(id);
        await Promise.all([this.state.loadTransactions(), this.state.loadAccounts()]);
        this.views[this.router.currentViewName!]?.render();
        this.notifications.toast('Deleted', 'Transaction removed successfully');
      } catch (err: any) {
        this.notifications.alert('Error', err.message);
      }
    }
  }
}
