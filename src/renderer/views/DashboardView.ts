import { BaseView } from './BaseView';
import { $, UIUtils } from '../core/dom';
import { StatCard } from '../components/common/StatCard';
import { ProgressBar } from '../components/common/ProgressBar';
import { InsightCard } from '../components/common/InsightCard';
import { Card } from '../components/common/Card';
import { ListItem } from '../components/common/ListItem';
import { ViewHeader } from '../components/common/ViewHeader';
import { EmptyState } from '../components/common/EmptyState';
import { DateUtils } from '../../shared/utils/dateUtils';
import type { App } from '../core/app';

export class DashboardView extends BaseView {
  private quickTxType: string = 'expense';

  constructor(app: App) {
    super(app, 'dashboard');
  }

  highlightInsightKeywords(text: string): string {
    if (!text) return '';

    // Define keyword mappings
    const mappings: { [key: string]: string[] } = {
      'text-success font-medium': ['income', 'savings', 'increase', 'growth', 'saved', 'profit', 'surplus', 'under budget'],
      'text-danger font-medium': ['expense', 'spending', 'cost', 'decrease', 'debt', 'loss', 'deficit', 'over budget'],
      'text-warning font-medium': ['warning', 'note', 'alert', 'caution', 'attention']
    };

    let result = text;

    // Process each category
    Object.entries(mappings).forEach(([className, keywords]) => {
      keywords.forEach(keyword => {
        // Case insensitive replacement
        const regex = new RegExp(`\\b(${keyword}[a-z]*)\\b`, 'gi');
        result = result.replace(regex, `<span class="${className}">$1</span>`);
      });
    });

    return result;
  }

  async onShow(): Promise<void> {
    if (!this.isInitialized) {
      this.renderBaseTemplate();
      this.isInitialized = true;
    }

    if (this.app.updateAccountDropdowns) {
      this.app.updateAccountDropdowns();
    }
    await this.render();
    this.loadAIInsight();
  }

  renderBaseTemplate(): void {
    if (!this.element) return;
    this.element.innerHTML = `
            ${ViewHeader({
      title: 'Financial Dashboard',
      subtitle: "Welcome back, here's your financial overview",
    })}

            <div id="dashboard-stats-container" class="stats-grid mb-6"></div>

            <div id="dashboard-insight-container" class="mb-6"></div>

            <div class="dashboard-grid">
                <div class="dashboard-main-col">
                    ${Card({
      title: 'Net Worth & Cash Flow',
      icon: 'line-chart',
      variant: 'default',
      className: 'h-full flex flex-col',
      bodyClass: 'flex-1 flex flex-col pt-0',
      content: `
                            <div class="chart-container flex-1 relative min-h-[350px]">
                                <canvas id="mainChart"></canvas>
                            </div>
                        `,
    })}
                </div>
                <div class="dashboard-side-col">
                    <div id="quick-transaction-widget"></div>
                </div>
            </div>

            <div id="dashboard-insights-grid" class="dashboard-insights-grid mt-6"></div>

            <div id="dashboard-accounts-container" class="mt-6"></div>
        `;
    this.refreshIcons();
  }

  async loadAIInsight(): Promise<void> {
    const container = $('#dashboard-insight-container');
    if (!container) return;

    // Always show insight container
    UIUtils.setHidden('#dashboard-insight-container', false);

    // Prepare summary data
    const { start: monthStart, end: monthEnd } = DateUtils.getMonthBoundaries();

    const mStats = {
      income: this.state.summaryStats.monthIncome,
      expense: this.state.summaryStats.monthExpense
    };

    const totalBalance = this.state.summaryStats.totalBalance;

    // Fetch top category from server
    let topCategory = 'None';
    let topCategoryAmount = 0;
    try {
      const stats = await window.api.getTransactionStats({
        type: 'expense',
        startDate: monthStart,
        endDate: monthEnd
      });
      if (stats.topCategories && stats.topCategories.length > 0) {
        topCategory = stats.topCategories[0].category;
        topCategoryAmount = stats.topCategories[0].amount;
      }
    } catch (e) {
      console.warn('Failed to fetch top category for insight', e);
    }

    const summary = {
      balance: totalBalance,
      monthIncome: mStats.income,
      monthExpense: mStats.expense,
      savingsRate:
        mStats.income > 0
          ? (((mStats.income - mStats.expense) / mStats.income) * 100).toFixed(1)
          : 0,
      topCategory,
      topCategoryAmount,
    };

    // Try to get cached insight first (show immediately if available)
    const cachedInsight = this.app.aiCache.getCached('dashboard', summary);
    if (cachedInsight) {
      container.innerHTML = InsightCard({
        title: cachedInsight.title,
        message: this.highlightInsightKeywords(cachedInsight.text),
        icon: cachedInsight.icon,
      });
      this.refreshIcons(container);
      return;
    }

    // Show loading state
    const settings = await window.api.getAISettings();
    container.innerHTML = InsightCard({
      title: settings.enabled ? 'AI Financial Insight' : 'Financial Insight',
      message: '<span class="loading-pulse">Analyzing your latest data...</span>',
      icon: settings.enabled ? 'sparkles' : 'lightbulb',
    });
    this.refreshIcons(container);

    // Fetch insight using cache system
    try {
      const insight = await this.app.aiCache.fetchInsight(
        'dashboard',
        summary,
        async (data: any) => await window.api.getAIInsight(data),
        (data: any) => (this.app as any).fallbackGenerator.generateDashboardInsight(data),
        {
          aiTitle: 'AI Financial Insight',
          fallbackTitle: 'Financial Insight',
          ttl: 24 * 60 * 60 * 1000, // 24 hours
        }
      );

      if (!insight) throw new Error('No insight returned');

      container.innerHTML = InsightCard({
        title: insight.title || 'Financial Insight',
        message: this.highlightInsightKeywords(insight.text),
        icon: insight.icon,
      });
      this.refreshIcons(container);
    } catch (err) {
      console.error('Failed to load insight:', err);
      // Show fallback on error
      const fallbackText = (this.app as any).fallbackGenerator.generateDashboardInsight(summary);
      container.innerHTML = InsightCard({
        title: 'Financial Insight',
        message: fallbackText,
        icon: 'lightbulb',
      });
      this.refreshIcons(container);
    }
  }

  // Helper methods replaced by server-side logic in loadAIInsight/render


  async render(): Promise<void> {
    // Load exchange rates for currency conversion
    await this.formatter.loadExchangeRates();

    // Use server-side stats
    const liquidBalance = this.state.summaryStats.totalBalance;
    const netWorth = this.state.summaryStats.netWorth;
    const monthlyIncome = this.state.summaryStats.monthIncome;
    const monthlyExpense = this.state.summaryStats.monthExpense;
    const savingsRate = this.state.summaryStats.savingsRate;

    // Render stats using components
    const statsContainer = $('#dashboard-stats-container');
    if (statsContainer) {
      statsContainer.innerHTML = `
                ${StatCard({
        label: 'Current Balance',
        value: this.formatter.formatCurrency(liquidBalance),
        icon: 'landmark',
      })}
                ${StatCard({
        label: 'Net Worth',
        value: this.formatter.formatCurrency(netWorth),
        icon: 'gem',
      })}
                ${StatCard({
        label: 'Average Income',
        value: this.formatter.formatCurrency(monthlyIncome),
        icon: 'wallet',
      })}
                ${StatCard({
        label: 'Average Expenses',
        value: this.formatter.formatCurrency(monthlyExpense),
        icon: 'trending-down',
        trend: {
          type: savingsRate >= 20 ? 'up' : 'down',
          value: `${savingsRate.toFixed(1)}% Saved`,
        },
      })}
            `;
    }

    // Render Insights Grid using Components
    const gridContainer = $('#dashboard-insights-grid');
    if (gridContainer) {
      gridContainer.innerHTML = `
                ${Card({
        title: 'Growth Highlights',
        icon: 'trending-up',
        variant: 'panel',
        content: '<div id="growth-list" class="flex flex-col gap-4"></div>',
      })}
                ${Card({
        title: 'Top Categories',
        icon: 'pie-chart',
        variant: 'panel',
        content: '<div id="category-distribution" class="flex flex-col gap-4"></div>',
      })}
                ${Card({
        title: 'Current Budget',
        icon: 'target',
        variant: 'panel',
        content:
          '<div id="dashboard-budget-content" class="flex flex-col gap-4 min-h-[120px]"></div>',
      })}
            `;
    }

    this.renderGrowthHighlights();
    this.renderCategoryDistribution();
    this.renderBudgetSummary();
    this.renderQuickTransaction();
    this.renderAccountsOverview();

    // Use server-side dashboard data
    const dashboardData = await window.api.getDashboardData(6);

    // Check if we have any data to display
    if (!dashboardData || dashboardData.labels.length === 0) {
      // Show helpful empty state
      const chartContainer = document.querySelector('#mainChart')?.parentElement;
      if (chartContainer) {
        chartContainer.innerHTML = EmptyState({
          icon: 'trending-up',
          title: 'Your Financial Story Starts Here',
          message: 'Add transactions using the Quick Record widget on the right to see your income and expense trends over time.',
          action: {
            label: 'Add First Transaction',
            icon: 'plus',
            onclick: 'document.getElementById("quick-tx-amount")?.focus()'
          }
        });
        this.refreshIcons(chartContainer);
      }
    } else {
      this.chartManager.renderDashboardChart('mainChart', dashboardData);
    }

    // Targeted refresh after sub-renders
    this.refreshIcons('#dashboard-stats-container');
    this.refreshIcons('#dashboard-insights-grid');
  }

  renderQuickTransaction(): void {
    const container = $('#quick-transaction-widget');
    if (!container) return;

    const { state } = this.app;
    const currentType = this.quickTxType || 'expense';

    container.innerHTML = `
            <div class="card quick-tx-card h-full">
                <div class="card-header flex-row justify-between align-center py-3">
                    <h3 class="text-sm font-bold uppercase tracking-wider text-text-muted">Quick Record</h3>
                    <div class="tx-type-toggle-sm" id="quick-tx-type-toggle">
                        <button class="segment icon-btn ${currentType === 'income' ? 'active' : ''}" data-type="income" title="Income">
                            <i data-lucide="trending-up" class="w-4 h-4"></i>
                        </button>
                        <button class="segment icon-btn ${currentType === 'expense' ? 'active' : ''}" data-type="expense" title="Expense">
                            <i data-lucide="trending-down" class="w-4 h-4"></i>
                        </button>
                        <button class="segment icon-btn ${currentType === 'transfer' ? 'active' : ''}" data-type="transfer" title="Transfer">
                            <i data-lucide="arrow-right-left" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body flex-col gap-4">
                    <!-- Transfer Balance Preview (compact, color-coded) -->
                    <div id="transfer-balance-preview" class="transfer-preview-horizontal hidden">
                        <span id="transfer-from-label">—</span>
                        <span class="transfer-balance decrease" id="transfer-from-balance">$0 → $0</span>
                        <span class="transfer-separator">→</span>
                        <span id="transfer-to-label">—</span>
                        <span class="transfer-balance increase" id="transfer-to-balance">$0 → $0</span>
                    </div>

                    <div class="quick-tx-amount-container">
                        <span class="currency-prefix text-text-muted">$</span>
                        <input type="number" id="quick-tx-amount" placeholder="0.00" step="0.01" class="amount-input" title="Enter the transaction amount. For expenses, this will be deducted from your account.">
                    </div>

                    <div class="form-grid-condensed">
                        <div class="form-group mb-0">
                            <label class="text-[10px] font-bold uppercase text-text-muted mb-1">Account</label>
                            <select id="quick-tx-account" class="form-control sm" title="Select the account for this transaction"></select>
                        </div>
                        <div class="form-group mb-0 ${currentType === 'transfer' ? '' : 'hidden'}" id="quick-tx-to-account-group">
                            <label class="text-[10px] font-bold uppercase text-text-muted mb-1">To Account</label>
                            <select id="quick-tx-to-account" class="form-control sm" title="Select the destination account for this transfer"></select>
                        </div>
                        <div class="form-group mb-0 ${currentType === 'transfer' ? 'hidden' : ''}" id="quick-tx-category-group">
                            <label class="text-[10px] font-bold uppercase text-text-muted mb-1">Category</label>
                            <select id="quick-tx-category" class="form-control sm" title="Choose the category that best describes this transaction"></select>
                        </div>
                        <div class="form-group mb-0">
                            <label class="text-[10px] font-bold uppercase text-text-muted mb-1">Date</label>
                            <input type="date" id="quick-tx-date" class="form-control sm" value="${DateUtils.today()}" title="Date of the transaction">
                        </div>
                        <div class="form-group mb-0">
                            <label class="text-[10px] font-bold uppercase text-text-muted mb-1">Frequency</label>
                            <select id="quick-tx-frequency" class="form-control sm" title="Choose 'Once' for one-time transactions, or select a frequency for recurring transactions">
                                <option value="once" selected>Once</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="yearly">Yearly</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group mb-0">
                        <label class="text-[10px] font-bold uppercase text-text-muted mb-1">Description</label>
                        <input type="text" id="quick-tx-desc" placeholder="Notes..." class="form-control sm" title="Add a description or notes for this transaction">
                    </div>

                    <button class="btn secondary w-full py-3 font-bold mt-2" id="btn-quick-save">
                        Record Transaction
                    </button>
                </div>
            </div>
        `;

    this.populateQuickTxDropdowns();
    this.setupQuickTxListeners();
    // Crucial: Refresh icons after dynamic widget update
    this.refreshIcons(container);
  }

  populateQuickTxDropdowns(): void {
    const { state } = this.app;
    const currentType = this.quickTxType || 'expense';

    // Account dropdowns - include currency for exchange rate detection
    const accHtml = state.accounts
      .map(
        (a) =>
          `<option value="${a.id}" data-currency="${a.currency}">${a.name} (${a.currency})</option>`
      )
      .join('');
    const accSelect = $('#quick-tx-account');
    const toAccSelect = $('#quick-tx-to-account');
    if (accSelect) accSelect.innerHTML = accHtml;
    if (toAccSelect) toAccSelect.innerHTML = accHtml;

    // Category dropdown with smart suggestions
    let categories = state.categories.filter(
      (c) => c.type === (currentType === 'income' ? 'income' : 'expense')
    );

    // Sort by usage frequency
    const usageStats = this._getCategoryUsageStats();
    categories.sort((a, b) => {
      const aUsage = usageStats[a.name] || 0;
      const bUsage = usageStats[b.name] || 0;
      return bUsage - aUsage; // Most used first
    });

    const catHtml = categories
      .map((c, index) => {
        // Add star emoji to top 3 most used
        const star = index < 3 && usageStats[c.name] ? ' ⭐' : '';
        return `<option value="${c.name}">${c.name}${star}</option>`;
      })
      .join('');
    const catSelect = $('#quick-tx-category');
    if (catSelect) catSelect.innerHTML = catHtml;
  }

  /**
   * Get category usage statistics from localStorage
   */
  _getCategoryUsageStats(): Record<string, number> {
    try {
      const stats = localStorage.getItem('bofo-category-usage-stats');
      return stats ? JSON.parse(stats) : {};
    } catch {
      return {};
    }
  }

  /**
   * Increment category usage counter
   */
  _incrementCategoryUsage(category: string): void {
    try {
      const stats = this._getCategoryUsageStats();
      stats[category] = (stats[category] || 0) + 1;
      localStorage.setItem('bofo-category-usage-stats', JSON.stringify(stats));
    } catch (err) {
      console.warn('Failed to update category usage stats:', err);
    }
  }

  setupQuickTxListeners(): void {
    // Type Toggles
    document.querySelectorAll('#quick-tx-type-toggle .segment').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.quickTxType = (btn as HTMLElement).dataset.type || 'expense';
        this.renderQuickTransaction();
      });
    });

    // Save Button
    const btnSave = $('#btn-quick-save');
    if (btnSave) {
      btnSave.addEventListener('click', () => this.handleQuickSave());
    }

    // Real-time balance preview
    const amountInput = $('#quick-tx-amount') as HTMLInputElement;
    const accountSelect = $('#quick-tx-account') as HTMLSelectElement;
    const toAccountSelect = $('#quick-tx-to-account') as HTMLSelectElement;
    const transferPreview = $('#transfer-balance-preview');

    const updateBalancePreview = async () => {
      const amount = parseFloat(amountInput?.value) || 0;
      const accountId = parseInt(accountSelect?.value);
      const account = this.state.accounts.find(a => a.id === accountId);
      const type = this.quickTxType;

      // Handle transfer preview separately
      if (type === 'transfer' && transferPreview) {
        const toAccountId = parseInt(toAccountSelect?.value);
        const toAccount = this.state.accounts.find(a => a.id === toAccountId);

        if (account && toAccount && amount > 0 && accountId !== toAccountId) {
          // Show transfer preview
          transferPreview.classList.remove('hidden');

          // Check if currencies are different
          const fromCurrency = account.currency || 'USD';
          const toCurrency = toAccount.currency || 'USD';
          const isDifferentCurrency = fromCurrency !== toCurrency;

          let exchangeRate = 1;
          let toAmount = amount;

          if (isDifferentCurrency) {
            // Fetch actual exchange rate
            try {
              const rate = await window.api.getExchangeRate(fromCurrency, toCurrency);
              if (rate) {
                exchangeRate = rate;
                toAmount = amount * exchangeRate;
              }
            } catch (err) {
              console.warn('Failed to fetch exchange rate, using 1:1', err);
            }
          }

          // Update from account (decrease - red) - compact format
          const fromAfter = account.balance - amount;
          $('#transfer-from-label')!.textContent = account.name;
          $('#transfer-from-balance')!.textContent =
            `${this.formatter.formatCurrency(account.balance)} → ${this.formatter.formatCurrency(fromAfter)}`;

          // Update to account (increase - green) - compact format
          const toAfter = toAccount.balance + toAmount;
          $('#transfer-to-label')!.textContent = toAccount.name;
          const toBalanceText = isDifferentCurrency && exchangeRate !== 1
            ? `${this.formatter.formatCurrency(toAccount.balance)} → ${this.formatter.formatCurrency(toAfter)} (${exchangeRate.toFixed(4)}×)`
            : `${this.formatter.formatCurrency(toAccount.balance)} → ${this.formatter.formatCurrency(toAfter)}`;
          $('#transfer-to-balance')!.textContent = toBalanceText;
        } else {
          transferPreview.classList.add('hidden');
        }
      } else if (transferPreview) {
        // Hide transfer preview for non-transfer types
        transferPreview.classList.add('hidden');

        // Show inline preview for income/expense
        if (account && amount > 0 && accountSelect) {
          let newBalance = account.balance;

          if (type === 'expense') {
            newBalance = account.balance - amount;
          } else if (type === 'income') {
            newBalance = account.balance + amount;
          }

          // Update dropdown text to show preview
          const selectedOption = accountSelect.querySelector(`option[value="${accountId}"]`) as HTMLOptionElement;
          if (selectedOption) {
            const balanceIndicator = newBalance >= 0 ? '→' : '⚠️';
            selectedOption.textContent = `${account.name} (${this.formatter.formatCurrency(account.balance)}) ${balanceIndicator} ${this.formatter.formatCurrency(newBalance)}`;
          }
        } else if (accountSelect) {
          // Reset to original text
          this.populateQuickTxDropdowns();
        }
      }
    };

    if (amountInput) {
      amountInput.addEventListener('input', updateBalancePreview);
    }
    if (accountSelect) {
      accountSelect.addEventListener('change', updateBalancePreview);
    }
    if (toAccountSelect) {
      toAccountSelect.addEventListener('change', updateBalancePreview);
    }
  }

  /**
   * Validates the quick transaction amount input
   */
  _validateQuickTxAmount(): { valid: boolean; amount: number } {
    const input = $('#quick-tx-amount') as HTMLInputElement;
    const amount = parseFloat(input.value);

    // Remove any existing error styling
    input.classList.remove('error');
    const existingError = input.parentElement?.querySelector('.error-message');
    existingError?.remove();

    if (isNaN(amount) || amount <= 0) {
      input.classList.add('error');

      // Add inline error message
      const errorMsg = document.createElement('span');
      errorMsg.className = 'error-message text-xs text-danger mt-1';
      errorMsg.textContent = amount < 0
        ? 'Amount must be positive. Enter the absolute value for expenses.'
        : 'Please enter a valid amount greater than 0';
      input.parentElement?.appendChild(errorMsg);

      this.app.notifications.toast('Validation Error', 'Please enter a valid amount', 'error');
      return { valid: false, amount: 0 };
    }

    return { valid: true, amount };
  }

  /**
   * Builds a transaction object from quick transaction form inputs
   */
  _buildQuickTransaction(amount: number, type: string): { tx: any; valid: boolean } {
    const accInput = $('#quick-tx-account') as HTMLSelectElement;
    const accountId = parseInt(accInput.value);
    const account = this.state.accounts.find((a) => a.id === accountId);

    // Validate sufficient balance for expenses and transfers
    if ((type === 'expense' || type === 'transfer') && account) {
      if (amount > account.balance) {
        this.app.notifications.toast(
          'Insufficient Balance',
          `Account "${account.name}" only has ${this.formatter.formatCurrency(account.balance)} available`,
          'error'
        );
        return { tx: null, valid: false };
      }
    }

    const dateInput = $('#quick-tx-date') as HTMLInputElement;
    const catInput = $('#quick-tx-category') as HTMLSelectElement;
    const descInput = $('#quick-tx-desc') as HTMLInputElement;
    const freqInput = $('#quick-tx-frequency') as HTMLSelectElement;

    const tx: any = {
      start_date: dateInput.value,
      category: type === 'transfer' ? 'Transfer' : catInput.value,
      account_id: accountId,
      description: descInput.value || (type === 'transfer' ? 'Internal Transfer' : 'Quick entry'),
      amount,
      type,
      frequency: freqInput?.value || 'once',
    };

    if (type === 'transfer') {
      const toAccInput = $('#quick-tx-to-account') as HTMLSelectElement;
      tx.to_account_id = parseInt(toAccInput.value);
      if (tx.account_id === tx.to_account_id) {
        this.app.notifications.toast(
          'Error',
          'Source and destination accounts must be different',
          'error'
        );
        return { tx: null, valid: false };
      }

      // Get currencies from selected accounts
      const fromCurrency = accInput.options[accInput.selectedIndex]?.dataset?.currency;
      const toCurrency = toAccInput.options[toAccInput.selectedIndex]?.dataset?.currency;

      if (fromCurrency && toCurrency && fromCurrency !== toCurrency) {
        // Cross-currency transfer - mark for async handling
        tx._needsExchangeRate = true;
        tx._fromCurrency = fromCurrency;
        tx._toCurrency = toCurrency;
      } else {
        // Same currency - 1:1 transfer
        tx.exchange_rate = 1;
        tx.to_amount = amount;
      }
    }

    return { tx, valid: true };
  }

  async handleQuickSave(): Promise<void> {
    // Validate amount
    const { valid: amountValid, amount } = this._validateQuickTxAmount();
    if (!amountValid) return;

    // Build transaction
    const type = this.quickTxType || 'expense';
    const { tx, valid: txValid } = this._buildQuickTransaction(amount, type);
    if (!txValid) return;

    // Handle cross-currency transfers - fetch exchange rate
    if (tx._needsExchangeRate) {
      try {
        const rate = await window.api.getExchangeRate(tx._fromCurrency, tx._toCurrency);
        if (rate !== null && rate > 0) {
          tx.exchange_rate = rate;
          tx.to_amount = amount * rate;
        } else {
          // No rate found - prompt user or use 1:1
          this.app.notifications.toast(
            'Exchange Rate Missing',
            `No rate found for ${tx._fromCurrency}→${tx._toCurrency}. Using 1:1. Configure rates in Settings → Currency.`,
            'warning'
          );
          tx.exchange_rate = 1;
          tx.to_amount = amount;
        }
      } catch (err) {
        console.error('Failed to fetch exchange rate:', err);
        tx.exchange_rate = 1;
        tx.to_amount = amount;
      }
      // Clean up temp properties
      delete tx._needsExchangeRate;
      delete tx._fromCurrency;
      delete tx._toCurrency;
    }

    // Save and refresh
    try {
      const savedTx = await window.api.addTransaction(tx);

      // Track category usage for smart suggestions
      if (tx.category) {
        this._incrementCategoryUsage(tx.category);
      }

      // Check for anomalies after save
      try {
        const anomalyResult = await (window.api as any).detectAnomalies({ transaction: savedTx });
        if (anomalyResult.success && anomalyResult.anomalies.length > 0) {
          // Show anomaly alerts
          const highSeverity = anomalyResult.anomalies.filter((a: any) => a.severity === 'high');
          if (highSeverity.length > 0) {
            this.app.notifications.toast(
              'Unusual Transaction Detected',
              highSeverity[0].message,
              'warning'
            );
          } else {
            // Show info for medium/low severity
            this.app.notifications.toast(
              'Transaction Alert',
              anomalyResult.anomalies[0].message,
              'info'
            );
          }
        }
      } catch (anomalyErr) {
        // Don't block on anomaly detection failure
        console.warn('Anomaly detection failed:', anomalyErr);
      }

      this.app.notifications.toast('Success', 'Transaction recorded', 'success');

      // Check for milestones
      const transactionCount = this.state.transactions.length + 1;
      const milestone = this.app.milestoneTracker.checkMilestone('transaction', transactionCount);
      if (milestone) {
        // Show milestone after a brief delay so it doesn't overlap with success message
        setTimeout(() => {
          this.app.notifications.toast('Milestone!', milestone, 'success');
        }, 1500);
      }

      const inputAmount = $('#quick-tx-amount') as HTMLInputElement;
      const inputDesc = $('#quick-tx-desc') as HTMLInputElement;
      if (inputAmount) inputAmount.value = '';
      if (inputDesc) inputDesc.value = '';

      await this.app.state.loadTransactions();
      await this.app.state.loadAccounts();
      this.render();
    } catch (err: any) {
      console.error('Quick save failed:', err.message);

      // Enhanced error messages with recovery suggestions
      let errorTitle = 'Save Failed';
      let errorMessage = 'Could not save transaction';

      if (err.message.includes('UNIQUE')) {
        errorTitle = 'Duplicate Transaction';
        errorMessage = 'A similar transaction already exists. Check your recent transactions or edit the existing one.';
      } else if (err.message.includes('balance') || err.message.includes('Insufficient')) {
        errorTitle = 'Insufficient Funds';
        errorMessage = 'This account doesn\'t have enough balance. Try transferring funds first or use a different account.';
      } else if (err.message.includes('account')) {
        errorTitle = 'Account Error';
        errorMessage = 'There was an issue with the selected account. Please try again or select a different account.';
      } else {
        errorMessage = `${err.message}. Please try again or contact support if this persists.`;
      }

      this.app.notifications.toast(errorTitle, errorMessage, 'error');
    }
  }

  renderGrowthHighlights(): void {
    const items: any[] = [];
    const currentNW = this.state.summaryStats.netWorth;
    // We only have one data point for NW here, so no % change unless we fetch history.
    // For now, simple display.
    items.push({ name: 'Total Net Worth', pct: 0, sub: 'Current Status', valueType: 'currency', value: currentNW });

    UIUtils.renderList('growth-list', items, (item) =>
      ListItem({
        label: item.name,
        sublabel: item.sub,
        value: this.formatter.formatCurrency(item.value),
        trendType: 'neutral',
      })
    );
  }

  async renderCategoryDistribution(): Promise<void> {
    const { start: monthStart, end: monthEnd } = DateUtils.getMonthBoundaries();

    // Use server stats
    const stats = await window.api.getTransactionStats({
      type: 'expense',
      startDate: monthStart,
      endDate: monthEnd
    });

    // with updated Types, topCategories should be available
    const topCats = stats.topCategories || [];

    UIUtils.renderList(
      'category-distribution',
      topCats,
      (cat) => {
        return ProgressBar({
          label: cat.category,
          value: this.formatter.formatCurrency(cat.amount),
          percent: parseFloat(cat.percent),
        });
      },
      'No expenses this month.'
    );
  }

  async renderBudgetSummary(): Promise<void> {
    const summary = await window.api.getBudgetSummary();
    const totalBudget = summary.totalAmount;

    // For now, we only have total allocated.
    // In a future phase, we can calculate 'spent' server-side efficiently.
    // Dashboard Card logic remains:

    // We need to fetch basic active budget count/list for the list display if needed?
    // The previous implementation used activeBudgets.length. 
    // This view method seems to render a summary card only.

    // Let's verify what 'activeBudgets' was used for.
    // It calculated totalBudget and listed them?
    // Looking at the context, it seems to render a simple Budget vs Spend bar or text.

    // For this phase, we will trust the API summary.

    const now = new Date();
    const { start: monthStart, end: monthEnd } = DateUtils.getMonthBoundaries();

    // Get actual spending from server
    const spending = await window.api.getCategorySpending(monthStart, monthEnd);


    // Simplified spent calculation relying on total expenses for budget categories
    // Since we don't have the full budget list in memory to match categories exactly, 
    // we will rely on total spending matching the summary for now.
    // Ideally we would fetch "spent against budget" from the server too.

    let totalSpent = 0;
    // Iterate spending to approximate (or use total monthly expense if easier)
    spending.forEach(s => totalSpent += s.amount);
    // This is an approximation as it includes non-budget categories, 
    // but better than nothing for the skeleton view.
    // TODO: Implement getBudgetStatus() on backend for perfect accuracy.

    const el = $('#dashboard-budget-content');
    if (!el) return;

    if (totalBudget === 0) {
      el.innerHTML =
        '<p class="text-muted" style="margin-top: 10px;">No active budgets. <a href="#" onclick="app.router.navigate(\'budget\'); return false;" style="color: var(--accent);">Set one</a></p>';
      return;
    }

    const share = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    el.innerHTML = ProgressBar({
      label: 'Monthly Spending',
      value: `${this.formatter.formatCurrency(totalSpent)} of ${this.formatter.formatCurrency(totalBudget)}`,
      percent: Math.min(share, 100),
      color: share > 100 ? 'var(--expense)' : share > 85 ? 'var(--warning)' : 'var(--income)',
    });
  }

  renderAccountsOverview(): void {
    const container = $('#dashboard-accounts-container');
    if (!container) return;

    const { state, formatter } = this.app;
    const accounts = state.accounts.filter((a) => a.status !== 'archived');

    const typeLabels: Record<string, string> = {
      bank: 'Bank',
      wallet: 'Wallet',
      credit_card: 'Credit Card',
      loan: 'Loan',
      investment: 'Investment',
      other: 'Other',
    };

    const typeColors: Record<string, string> = {
      bank: 'bg-info/15 text-info border-info/20',
      wallet: 'bg-brand-primary/15 text-brand-primary border-brand-primary/20',
      credit_card: 'bg-warning/15 text-warning border-warning/20',
      loan: 'bg-danger/15 text-danger border-danger/20',
      investment: 'bg-success/15 text-success border-success/20',
      other: 'bg-surface-input text-text-muted border-border',
    };

    const accountsHtml =
      accounts.length > 0
        ? accounts
          .map((acc) => {
            const typeClass = typeColors[acc.type] || typeColors.other;
            const balanceClass = acc.balance >= 0 ? 'text-success' : 'text-danger';
            const initialBalanceClass =
              (acc.initial_balance || 0) >= 0 ? 'text-text-muted' : 'text-danger';

            return `
                <tr class="border-b border-border/50 last:border-0 hover:bg-surface-hover/50 transition-colors">
                    <td class="py-3 px-4">
                        <span class="font-medium text-text-main">${acc.name}</span>
                    </td>
                    <td class="py-3 px-4">
                        <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${typeClass}">
                            ${typeLabels[acc.type] || acc.type}
                        </span>
                    </td>
                    <td class="py-3 px-4">
                        <span class="text-xs font-medium uppercase tracking-wide bg-surface-input px-2 py-0.5 rounded">
                            ${acc.currency || state.getBaseCurrency()}
                        </span>
                    </td>
                    <td class="py-3 px-4 text-right">
                        <span class="${initialBalanceClass} text-sm">${formatter.formatCurrency(acc.initial_balance || 0, acc.currency)}</span>
                    </td>
                    <td class="py-3 px-4 text-right">
                        <span class="${balanceClass} font-semibold">${formatter.formatCurrency(acc.balance, acc.currency)}</span>
                    </td>
                </tr>
            `;
          })
          .join('')
        : `
            <tr>
                <td colspan="5" class="py-8 text-center text-text-muted">
                    <p>No accounts configured. <a href="#" onclick="app.router.navigate('settings'); setTimeout(() => app.views.settings.handleNewAccount(), 100); return false;" class="text-brand-primary hover:underline">Add one</a></p>
                </td>
            </tr>
        `;

    container.innerHTML = Card({
      title: 'Accounts Overview',
      icon: 'wallet',
      variant: 'panel',
      content: `
                <div class="overflow-x-auto -mx-4">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b border-border text-text-muted">
                                <th class="py-2 px-4 text-left font-semibold text-xs uppercase tracking-wider">Account</th>
                                <th class="py-2 px-4 text-left font-semibold text-xs uppercase tracking-wider">Type</th>
                                <th class="py-2 px-4 text-left font-semibold text-xs uppercase tracking-wider">Currency</th>
                                <th class="py-2 px-4 text-right font-semibold text-xs uppercase tracking-wider">Initial</th>
                                <th class="py-2 px-4 text-right font-semibold text-xs uppercase tracking-wider">Current</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${accountsHtml}
                        </tbody>
                    </table>
                </div>
            `,
    });

    this.refreshIcons(container);
  }
}
