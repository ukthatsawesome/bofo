import { BaseView } from './BaseView';
import { $, $$, UIUtils } from '../core/dom';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { SortableHeader } from '../components/tables/SortableHeader';
import { TransactionRow } from '../components/tables/TransactionRow';
import { EmptyState } from '../components/common/EmptyState';
import { StatCard } from '../components/common/StatCard';
import { ViewHeader } from '../components/common/ViewHeader';
import { DateUtils } from '../../shared/utils/dateUtils';
import {
  Transaction,
  TransactionListDTO,
  TransactionPayload,
  Category,
  Account,
} from '../../shared/types';
import type { App } from '../core/app';

interface TransactionSummary {
  income: string;
  expense: string;
  netFlow: string;
  netFlowPositive: boolean;
  savingsRate: string;
  transactionCount: number;
  topCategories: { category: string; amount: number; percent: string }[];
  yoyChange: string | null;
  incomeRaw: number;
  expenseRaw: number;
}

interface TransactionStats {
  income: number;
  expense: number;
  transfers: number;
  count: number;
}

export class TransactionsView extends BaseView {
  private selectedTxType: string = 'income';
  private editingTxId: number | null = null;
  protected insightsLoaded: boolean = false;

  constructor(app: App) {
    super(app, 'transactions');
    (window as any).transactionsView = this;
  }

  async onShow(): Promise<void> {
    if (!this.isInitialized) {
      this.renderBaseTemplate();
      this.setupHistoryListeners();
      this.setupModalListeners();
      this.isInitialized = true;
    }

    // Lazy load transactions
    await this.app.state.loadTransactions();
    this.render();
    this.loadInsights();
  }

  hide(): void {
    super.hide();
    delete (window as any).transactionsView;
    this.app.chartManager.destroyChart('tx-period-chart');
  }

  destroy(): void {
    super.destroy();
    delete (window as any).transactionsView;
    this.app.chartManager.destroyChart('tx-period-chart');
  }

  // Global helper for EmptyState action
  navigateToDashboard(): void {
    this.app.router.navigate('dashboard');
  }

  renderBaseTemplate(): void {
    if (!this.element) return;
    this.element.innerHTML = `
      ${ViewHeader({
      title: 'Transactions',
      subtitle: 'Manage your income, expenses, and transfers',
      actions: `
          <div class="filter-group">
            <label>Month</label>
            <input type="month" id="tx-month-filter" class="form-control sm">
          </div>
        `,
    })}

      <div id="tx-stats-container" class="stats-grid mb-6"></div>
      <div id="tx-insight-container" class="mb-6"></div>

      <div class="tx-history-container">
        <div class="card h-full">
          <div class="card-header flex-row justify-between align-center">
            <h3><i data-lucide="history"></i> History <span class="text-muted ms-2" style="font-size: 0.9em;" id="tx-total-count"></span></h3>
            <div id="tx-filter-container"></div>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead id="tx-table-head"></thead>
              <tbody id="tx-table-body"></tbody>
            </table>
          </div>
          <div class="card-footer flex-row justify-between align-center">
            <span class="text-muted" id="tx-page-info">Page 1 of 1</span>
            <div class="pagination">
              <button class="btn-icon" id="prev-tx" title="Previous"><i data-lucide="chevron-left"></i></button>
              <button class="btn-icon" id="next-tx" title="Next"><i data-lucide="chevron-right"></i></button>
            </div>
          </div>
        </div>
      </div>
    `;
    this.refreshIcons();
  }

  /* -------------------- LISTENERS -------------------- */

  private setupHistoryListeners(): void {
    const monthFilter = $('#tx-month-filter') as HTMLInputElement | null;
    monthFilter?.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      this.state.txMonthFilter = target.value;
      await this.state.goToPage(1);
      this.render();
    });

    $('#prev-tx')?.addEventListener('click', () => this.changePage(-1));
    $('#next-tx')?.addEventListener('click', () => this.changePage(1));
  }

  private setupModalListeners(): void {
    $('#close-transaction-modal')?.addEventListener('click', () =>
      UIUtils.setHidden('#transaction-modal', true)
    );
    $('#modal-tx-cancel')?.addEventListener('click', () =>
      UIUtils.setHidden('#transaction-modal', true)
    );
    $('#modal-tx-save')?.addEventListener('click', () => this.handleUpdate());

    $$('.tx-type-toggle-modal .segment').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.tx-type-toggle-modal .segment').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const type = (btn as HTMLElement).dataset.type || 'expense';
        UIUtils.setHidden('#modal-tx-to-account-group', type !== 'transfer');
        this.updateSecondaryCategoryDropdown(type);
      });
    });
  }

  /* -------------------- HANDLERS -------------------- */

  async handleFilter(type: string): Promise<void> {
    this.state.txHistoryFilter = type;
    await this.state.goToPage(1);
    this.render();
  }

  handleSort(field: string): void {
    const sameField = this.state.txSortField === field;
    this.state.txSortField = field;
    this.state.txSortOrder = sameField && this.state.txSortOrder === 'asc' ? 'desc' : 'asc';
    this.state.goToPage(1).then(() => this.render());
  }

  changePage(delta: number): void {
    const total = this.state.transactionMetadata.total;
    const pageSize = this.state.txHistoryPageSize;
    const maxPage = Math.ceil(total / pageSize) || 1;
    const newPage = this.state.txHistoryPage + delta;

    if (newPage >= 1 && newPage <= maxPage) {
      this.state.goToPage(newPage).then(() => this.render());
    }
  }

  /* -------------------- RENDER -------------------- */

  async render(): Promise<void> {
    const tbody = $('#tx-table-body');
    if (!tbody) return;

    const { txHistoryFilter, txSortField, txSortOrder } = this.state;

    // Filter toggle
    this.renderFilterControl(txHistoryFilter);

    // Table header
    this.renderTableHeader(txSortField, txSortOrder);

    const transactions = (this.state.transactions || []) as TransactionListDTO[];
    const total = this.state.transactionMetadata.total;
    const pageSize = this.state.txHistoryPageSize;
    const page = this.state.txHistoryPage;
    const totalPages = Math.ceil(total / pageSize) || 1;

    if (transactions.length === 0) {
      this.renderEmptyState(tbody);
    } else {
      tbody.innerHTML = transactions
        .map((t) =>
          TransactionRow({
            id: t.id,
            date: t.start_date,
            category: t.category_name,
            type: t.type as 'income' | 'expense' | 'transfer',
            accountText: t.account_name,
            description: t.description,
            amount: t.amount,
            formatter: this.formatter,
            onEdit: `window.transactionsView.handleEdit(${t.id})`,
            onDelete: `window.app.handleDeleteTransaction(${t.id})`,
          })
        )
        .join('');
      this.refreshIcons(tbody);
    }

    this.setText('tx-page-info', `Page ${page} of ${totalPages}`);
    const prevBtn = $('#prev-tx') as HTMLButtonElement | null;
    const nextBtn = $('#next-tx') as HTMLButtonElement | null;
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= totalPages;

    this.refreshIcons('#tx-table-body');
    this.refreshIcons('.pagination');

    // Render stats
    this._renderStats();
  }

  private renderFilterControl(currentFilter: string): void {
    const filterContainer = $('#tx-filter-container');
    if (!filterContainer) return;

    if (!filterContainer.innerHTML.trim()) {
      filterContainer.innerHTML = SegmentedControl({
        id: 'tx-history-filter',
        options: [
          { label: 'All', value: 'all', active: currentFilter === 'all' },
          { label: 'Income', value: 'income', active: currentFilter === 'income' },
          { label: 'Expense', value: 'expense', active: currentFilter === 'expense' },
          { label: 'Transfer', value: 'transfer', active: currentFilter === 'transfer' },
        ],
        onchange: 'window.transactionsView.handleFilter',
      });
    } else {
      filterContainer.querySelectorAll('.segment').forEach((btn) => {
        const el = btn as HTMLElement;
        el.classList.toggle('active', el.dataset.value === currentFilter);
      });
    }
  }

  private renderTableHeader(sortField: string, sortOrder: string): void {
    const thead = $('#tx-table-head');
    if (thead && !thead.innerHTML.trim()) {
      thead.innerHTML = `
        <tr>
          ${SortableHeader({
        label: 'Date',
        field: 'start_date',
        currentSort: sortField,
        direction: sortOrder as 'asc' | 'desc',
        onclick: 'window.transactionsView.handleSort',
      })}
          ${SortableHeader({
        label: 'Category',
        field: 'category_name',
        currentSort: sortField,
        direction: sortOrder as 'asc' | 'desc',
        onclick: 'window.transactionsView.handleSort',
      })}
          ${SortableHeader({
        label: 'Account',
        field: 'account_name',
        currentSort: sortField,
        direction: sortOrder as 'asc' | 'desc',
        onclick: 'window.transactionsView.handleSort',
      })}
          ${SortableHeader({
        label: 'Description',
        field: 'description',
        currentSort: sortField,
        direction: sortOrder as 'asc' | 'desc',
        onclick: 'window.transactionsView.handleSort',
      })}
          ${SortableHeader({
        label: 'Amount',
        field: 'amount',
        currentSort: sortField,
        direction: sortOrder as 'asc' | 'desc',
        onclick: 'window.transactionsView.handleSort',
      })}
          <th>Action</th>
        </tr>
      `;
    }
  }

  private renderEmptyState(tbody: HTMLElement): void {
    tbody.innerHTML = `<tr><td colspan="100%" class="p-0">${EmptyState({
      icon: 'inbox',
      title: 'No Transactions Found',
      message:
        this.state.txHistoryFilter !== 'all' || this.state.txMonthFilter
          ? 'Try adjusting your filters to see more transactions.'
          : 'Start tracking your finances by adding your first transaction from the Dashboard.',
      action:
        !this.state.txHistoryFilter && !this.state.txMonthFilter
          ? {
            label: 'Go to Dashboard',
            icon: 'arrow-right',
            onclick: 'window.transactionsView.navigateToDashboard()',
          }
          : null,
    })}</td></tr>`;
    this.refreshIcons(tbody);
  }

  /* -------------------- EDIT -------------------- */

  async handleEdit(id: number | string): Promise<void> {
    try {
      this.app.setLoading(true);
      const t = (await window.api.getTransaction(Number(id))) as Transaction | null;
      this.app.setLoading(false);

      if (!t) return;

      this.editingTxId = t.id;
      this.populateEditModal(t);

      UIUtils.setHidden('#transaction-modal', false);
      this.refreshIcons();
      $('#modal-tx-account')?.dispatchEvent(new Event('change'));

    } catch (e: any) {
      this.app.setLoading(false);
      this.app.notifications.toast('Error', 'Failed to load transaction details', 'error');
    }
  }

  private populateEditModal(t: Transaction): void {
    UIUtils.setInputValue('#modal-tx-amount', t.amount);
    UIUtils.setInputValue('#modal-tx-desc', t.description || '');
    UIUtils.setInputValue('#modal-tx-date', t.start_date);
    UIUtils.setInputValue('#modal-tx-account', t.account_id || '');

    if (t.type === 'transfer') {
      this.setupTransferFields(t);
    }

    // Set transaction type toggle
    $$('.tx-type-toggle-modal .segment').forEach((btn) => {
      const active = (btn as HTMLElement).dataset.type === t.type;
      btn.classList.toggle('active', active);
    });

    UIUtils.setHidden('#modal-tx-to-account-group', t.type !== 'transfer');
    this.updateSecondaryCategoryDropdown(t.type);

    const categorySelect = $('#modal-tx-category') as HTMLSelectElement | null;
    if (categorySelect && t.category) {
      categorySelect.value = t.category;
    }
  }

  private setupTransferFields(t: Transaction): void {
    UIUtils.setInputValue('#modal-tx-to-account', t.to_account_id || '');

    const fromAccount = (this.state.accounts as Account[]).find((a) => a.id === t.account_id);
    const toAccount = (this.state.accounts as Account[]).find((a) => a.id === t.to_account_id);
    const isMultiCurrency =
      fromAccount && toAccount && fromAccount.currency !== toAccount.currency;

    const rateInput = $('#modal-tx-exchange-rate') as HTMLInputElement | null;
    const toAmountInput = $('#modal-tx-to-amount') as HTMLInputElement | null;

    if (isMultiCurrency) {
      UIUtils.setHidden('#modal-tx-rate-group', false);
      if (rateInput) rateInput.disabled = false;
      if (toAmountInput) toAmountInput.disabled = false;

      if (t.exchange_rate)
        UIUtils.setInputValue('#modal-tx-exchange-rate', t.exchange_rate.toFixed(6));
      else UIUtils.setInputValue('#modal-tx-exchange-rate', '1');

      if (t.to_amount)
        UIUtils.setInputValue('#modal-tx-to-amount', t.to_amount.toFixed(2));
      else UIUtils.setInputValue('#modal-tx-to-amount', t.amount.toFixed(2));
    } else {
      UIUtils.setHidden('#modal-tx-rate-group', true);
      if (rateInput) rateInput.disabled = true;
      if (toAmountInput) toAmountInput.disabled = true;
    }
  }

  updateSecondaryCategoryDropdown(type: string): void {
    const select = $('#modal-tx-category');
    if (!select) return;

    select.innerHTML = (this.state.categories as Category[])
      .filter((c) => c.type === type && (c.status === 'active' || !c.status))
      .map((c) => `<option value="${c.name}">${c.name}</option>`)
      .join('');
  }

  async handleUpdate(): Promise<void> {
    try {
      const id = this.editingTxId;
      if (!id) return;

      const formValues = this.getEditFormValues();
      if (!formValues) return;

      await window.api.updateTransaction(id, formValues as any);

      UIUtils.setHidden('#transaction-modal', true);

      await Promise.all([
        this.state.loadAccounts(),
        this.state.goToPage(this.state.txHistoryPage),
      ]);

      if (this.app.updateAccountDropdowns) this.app.updateAccountDropdowns();
      this.render();
      this.loadInsights();
      this.app.notifications.toast('Success', 'Transaction updated', 'success');
    } catch (err: any) {
      console.error(err);
      this.app.notifications.alert('Update Failed', err.message || 'Unknown error', 'error');
    }
  }

  private getEditFormValues(): TransactionPayload | null {
    const amount = parseFloat(($('#modal-tx-amount') as HTMLInputElement).value);
    const account_id = parseInt(($('#modal-tx-account') as HTMLSelectElement).value);
    const activeSegment = $('.tx-type-toggle-modal .segment.active') as HTMLElement | null;
    const type = (activeSegment?.dataset.type || 'expense') as 'income' | 'expense' | 'transfer';

    // Validate required fields
    if (!amount || amount <= 0) {
      throw new Error('Invalid amount');
    }

    const data: TransactionPayload = {
      amount,
      account_id,
      type,
      start_date: UIUtils.getInputValue('#modal-tx-date'),
    };

    const description = UIUtils.getInputValue('#modal-tx-desc');
    if (description) data.description = description;

    if (type === 'transfer') {
      data.to_account_id = parseInt(($('#modal-tx-to-account') as HTMLSelectElement).value);
      data.category = 'Transfer';

      // Handle transfer specific fields (exchange rate, to_amount)
      const rateInput = $('#modal-tx-exchange-rate') as HTMLInputElement | null;

      if (rateInput && !rateInput.disabled) {
        data.exchange_rate = parseFloat(UIUtils.getInputValue('#modal-tx-exchange-rate')) || 1;
        data.to_amount = parseFloat(UIUtils.getInputValue('#modal-tx-to-amount')) || amount * data.exchange_rate;
      } else {
        data.exchange_rate = 1;
        data.to_amount = amount;
      }

    } else {
      data.category = UIUtils.getInputValue('#modal-tx-category');
    }

    return data;
  }

  /* -------------------- INSIGHTS -------------------- */

  async loadInsights(): Promise<void> {
    await this._renderStats();
  }

  async _renderStats(): Promise<void> {
    const container = $('#tx-stats-container');
    if (!container) return;

    const { state, formatter } = this.app;

    const statsOptions: any = {};
    if (state.txHistoryFilter !== 'all') statsOptions.type = state.txHistoryFilter;
    if (state.txMonthFilter) {
      const [y, m] = state.txMonthFilter.split('-').map(Number);
      const { start, end } = DateUtils.getMonthBoundariesForYearMonth(y, m);
      statsOptions.startDate = start;
      statsOptions.endDate = end;
    } else {
      const { start, end } = DateUtils.getMonthBoundaries();
      statsOptions.startDate = start;
      statsOptions.endDate = end;
    }

    const stats = (await window.api.getTransactionStats(statsOptions)) as TransactionStats || {
      income: 0,
      expense: 0,
      transfers: 0,
      count: 0,
    };

    const netFlow = stats.income - stats.expense;
    const savingsRate =
      stats.income > 0 ? ((netFlow / stats.income) * 100).toFixed(1) : '0.0';

    container.innerHTML = `
      ${StatCard({
      label: 'Income',
      value: formatter.formatCurrency(stats.income),
      icon: 'trending-up',
    })}
      ${StatCard({
      label: 'Expenses',
      value: formatter.formatCurrency(stats.expense),
      icon: 'trending-down',
    })}
      ${StatCard({
      label: 'Net Flow',
      value: (netFlow >= 0 ? '+' : '') + formatter.formatCurrency(netFlow),
      icon: netFlow >= 0 ? 'arrow-up-circle' : 'arrow-down-circle',
    })}
      ${StatCard({
      label: 'Savings Rate',
      value: savingsRate + '%',
      icon: 'piggy-bank',
    })}
      ${StatCard({
      label: 'Transfers',
      value: formatter.formatCurrency(stats.transfers),
      icon: 'arrow-right-left',
    })}
    `;

    this.setText('tx-total-count', `(${stats.count})`);
    this.refreshIcons(container);
  }
}
