/**
 * App - Main application orchestrator
 * Composes and coordinates all managers and services
 */
import { StateManager } from './state';
import { Formatter } from './formatter';
import { Router } from './router';
import { UIUtils } from './dom';
import { ChartManager } from '../components/charts/ChartManager';
import { NotificationManager } from '../components/notifications/NotificationManager';
import { CURRENCIES } from '../../shared/currencies';

// Managers
import { ModalManager } from './ModalManager';
import { EventManager } from './EventManager';
import { FormHelper } from './FormHelper';

// AI Services
import { aiInsightCache, createFallbackGenerator, FallbackInsightGenerator } from '../services/ai';

// Services
import { MilestoneTracker } from '../services/milestoneTracker';

// Views - Dynamic Imports
import { BaseView } from '../views/BaseView';

// Type for View Constructor
type ViewConstructor = new (app: App) => BaseView;

// View Loaders Map
const VIEW_LOADERS: Record<string, () => Promise<ViewConstructor>> = {
  dashboard: () => import('../views/DashboardView').then(m => m.DashboardView),
  transactions: () => import('../views/TransactionsView').then(m => m.TransactionsView),
  forecast: () => import('../views/ForecastView').then(m => m.ForecastView),
  budget: () => import('../views/BudgetView').then(m => m.BudgetView),
  goals: () => import('../views/GoalsView').then(m => m.GoalsView),
  whatif: () => import('../views/SandboxView').then(m => m.SandboxView),
  recurring: () => import('../views/RecurringChargesView').then(m => m.RecurringChargesView),
  bills: () => import('../views/BillsView').then(m => m.BillsView),
  settings: () => import('../views/SettingsView').then(m => m.SettingsView),
  'ai-settings': () => import('../views/AISettingsView').then(m => m.AISettingsView),
};

export class App {
  // Core Services
  state: StateManager;
  formatter: Formatter;
  chartManager: ChartManager;
  notifications: NotificationManager;
  router: Router;
  currencies: typeof CURRENCIES;

  // AI Services
  aiCache: typeof aiInsightCache;
  fallbackGenerator: FallbackInsightGenerator | null;

  // Managers
  modals: ModalManager;
  events: EventManager;
  forms: FormHelper;

  // Other Services
  milestoneTracker: MilestoneTracker;

  // Views (Instantiated)
  views: Record<string, BaseView> = {};

  constructor() {
    // Initialize core services
    this.state = new StateManager();
    this.formatter = new Formatter(this.state);
    this.chartManager = new ChartManager(this.state, this.formatter);
    this.notifications = new NotificationManager();
    this.currencies = CURRENCIES;

    // Initialize AI services
    this.aiCache = aiInsightCache;
    this.fallbackGenerator = null; // Initialized after formatter is ready

    // Initialize managers
    this.modals = new ModalManager(this);
    this.events = new EventManager(this);
    this.forms = new FormHelper(this.state, this.formatter);

    // Initialize other services
    this.milestoneTracker = new MilestoneTracker();

    // Views are now initialized lazily in getView()

    this.router = new Router(this);
  }

  /**
   * Lazily load and return a view instance
   */
  async getView(name: string): Promise<BaseView> {
    // Return existing instance if already loaded
    if (this.views[name]) {
      return this.views[name];
    }

    // Check if we have a loader for this view
    const loader = VIEW_LOADERS[name];
    if (!loader) {
      throw new Error(`No view loader found for: ${name}`);
    }

    try {
      // Load the view module
      const ViewClass = await loader();

      // Instantiate and cache
      const viewInstance = new ViewClass(this);
      this.views[name] = viewInstance;

      return viewInstance;
    } catch (error) {
      console.error(`Failed to load view: ${name}`, error);
      throw error;
    }
  }


  async init(): Promise<void> {
    try {
      this.setLoading(true);

      // Listen for DB status from Main process
      this.setupDBStatusListener();

      // Load core data
      await Promise.all([
        this.state.loadSettings(),
        this.state.loadAccounts(),
        this.state.loadCategories(),
        this.state.loadSummaryStats(),
      ]);

      // Initialize fallback generator with formatter
      this.fallbackGenerator = createFallbackGenerator(this.formatter);

      // Setup UI
      this.modals.renderDynamicModals();
      this.forms.populateCurrencyDropdowns();
      this.events.setup();
      this.initAIStatusIndicator();

      // Load exchange rates
      await this.formatter.loadExchangeRates();

      // Navigate to initial view
      this.router.navigate('dashboard');

      this.setLoading(false);
      UIUtils.refreshIcons();

      // Background: Prefetch AI insights
      this.prefetchInsightsInBackground();
    } catch (error) {
      console.error('App initialization failed:', error);
      this.setLoading(false);
      this.showInitError(error as Error);
    }
  }

  private setupDBStatusListener(): void {
    const winWithElectron = window as any;
    if (winWithElectron.electron) {
      winWithElectron.electron.ipcRenderer.on('app:db-status', (_: any, status: string, message?: string) => {
        if (status === 'connecting') {
          this.updateLoadingMessage('Connecting to Database...');
        } else if (status === 'ready') {
          this.updateLoadingMessage('Database Connected');
        } else if (status === 'error') {
          this.setLoading(false);
          this.showInitError(new Error(message || 'Database failed to initialize'));
        }
      });
    }
  }

  /**
   * Show user-friendly error UI when app fails to initialize
   */
  showInitError(error: Error): void {
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
  initAIStatusIndicator(): void {
    const navItem = document.getElementById('ai-status-nav');
    if (!navItem) return;

    navItem.classList.add('ai-checking');
    this.updateAIStatusIndicator();

    window.addEventListener('ai-connection-status', (e: any) => {
      this.updateAIStatusIndicator(e.detail.connected);
    });

    // Poll for connection status
    setInterval(() => this.updateAIStatusIndicator(), 5000);

    // Click handler - navigate to AI settings
    navItem.addEventListener('click', () => {
      document.querySelectorAll('.nav-links li').forEach((li) => li.classList.remove('active'));
      navItem.classList.add('active');
      this.router.navigate('ai-settings');
    });
  }

  /**
   * Update AI status indicator in sidebar
   */
  async updateAIStatusIndicator(status: boolean | null = null): Promise<void> {
    const navItem = document.getElementById('ai-status-nav');
    if (!navItem) return;

    navItem.classList.remove('ai-checking', 'ai-online', 'ai-offline', 'ai-disabled');

    if (status === null) {
      const aiSettings = await window.api.getAISettings();
      if (!aiSettings.enabled) {
        navItem.classList.add('ai-disabled');
        return;
      }
      status = await this.aiCache.isAIAvailable();
    }

    navItem.classList.add(status ? 'ai-online' : 'ai-offline');
    navItem.title = status ? 'AI Online - Click to configure' : 'AI Offline - Click to configure';
  }

  /**
   * Prefetch insights in background for faster view loads
   */
  async prefetchInsightsInBackground(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const aiSettings = await window.api.getAISettings();
    if (!aiSettings.enabled || !this.fallbackGenerator) return;

    try {
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
        savingsRate: mStats.income > 0
          ? (((mStats.income - mStats.expense) / mStats.income) * 100).toFixed(1)
          : 0,
      };

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

  // --- Loading State ---

  setLoading(isLoading: boolean): void {
    const loader = document.getElementById('global-loader');
    if (loader) {
      if (isLoading) loader.classList.remove('hidden');
      else loader.classList.add('hidden');
    }
  }

  updateLoadingMessage(message: string): void {
    const loader = document.getElementById('global-loader');
    if (loader) {
      const text = loader.querySelector('p');
      if (text) text.innerText = message;
    }
  }

  // --- Bridge Methods (Legacy Compatibility) ---

  async updateAppSetting(key: string, value: string | boolean): Promise<void> {
    const valStr = typeof value === 'boolean' ? String(value) : value;
    await this.state.financeService.updateSetting({ key, value: valStr });
    await this.state.loadSettings();
    if (key === 'theme') this.state.applyTheme(valStr);
  }

  async toggleTheme(theme: string): Promise<void> {
    await this.updateAppSetting('theme', theme);
  }

  handleNewTransaction(): void {
    this.router.navigate('transactions');
  }

  async handleDeleteTransaction(id: number): Promise<void> {
    if (
      await this.notifications.confirm(
        'Delete Transaction',
        'Are you sure you want to delete this transaction? This action cannot be undone.'
      )
    ) {
      try {
        await this.state.financeService.deleteTransaction(id);
        await Promise.all([this.state.loadTransactions(), this.state.loadAccounts()]);
        this.views[this.router.currentViewName!]?.render();
        this.notifications.toast('Deleted', 'Transaction removed successfully');
      } catch (err: any) {
        this.notifications.alert('Error', err.message);
      }
    }
  }
}
