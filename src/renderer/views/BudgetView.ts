import { BaseView } from './BaseView';
import { $, UIUtils } from '../core/dom';
import { StatCard } from '../components/common/StatCard';
import { ProgressBar } from '../components/common/ProgressBar';
import { SortableHeader } from '../components/tables/SortableHeader';
import { EmptyState } from '../components/common/EmptyState';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { ViewHeader } from '../components/common/ViewHeader';
import type { App } from '../core/app';

interface BudgetWithSpent {
  id: number;
  category: string;
  amount: number;
  period: string; // 'weekly' | 'monthly' | 'yearly'
  start_date: string;
  end_date: string;
  spent: number;
}

export class BudgetView extends BaseView {
  private editingBudgetId: number | null = null;
  private sortField: string = 'category';
  private sortDirection: 'asc' | 'desc' = 'asc';

  constructor(app: App) {
    super(app, 'budget');
  }

  async onShow(): Promise<void> {
    if (!this.isInitialized) {
      this.renderBaseTemplate();
      this.setupEventListeners();
      this.isInitialized = true;
    }

    const { state } = this.app;
    const monthFilter = $('#budget-month-filter') as HTMLInputElement;
    if (monthFilter) {
      monthFilter.value = state.budgetViewMonth;
      UIUtils.setHidden('#budget-month-filter-container', state.budgetViewFilter === 'active');
    }

    await this.app.state.loadBudgets();
    await this.render();
  }

  renderBaseTemplate(): void {
    if (!this.element) return;
    this.element.innerHTML = `
            ${ViewHeader({
      title: 'Budget Management',
      subtitle: 'Set limits and track your spending across categories',
      actions: `
                    <div id="budget-month-filter-container" class="filter-group">
                        <input type="month" id="budget-month-filter" class="form-control sm">
                    </div>
                    <button class="btn primary" id="btn-add-budget">
                        <i data-lucide="plus"></i> New Budget
                    </button>
                `,
    })}

            <div id="budget-summary-container" class="stats-grid mb-6"></div>

            <div class="card">
                <div class="card-header flex-row justify-between align-center">
                    <div id="budget-filter-container"></div>
                </div>
                <div class="card-body no-padding overflow-x-auto">
                    <table class="data-table">
                        <thead id="budget-table-head">
                            <tr>
                                <th>Category</th>
                                <th>Period</th>
                                <th>Limit</th>
                                <th>Spent</th>
                                <th>Progress</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="budget-list-body"></tbody>
                    </table>
                </div>
            </div>
        `;
    this.refreshIcons();
  }

  handleFilter(filter: 'active' | 'past'): void {
    this.app.state.budgetViewFilter = filter;
    UIUtils.setHidden('#budget-month-filter-container', filter === 'active');
    this.render();
  }

  async render(): Promise<void> {
    const { state, formatter } = this.app;
    await state.loadBudgets();
    await state.loadTransactions();

    // Render Toggle Component once or when needed
    const filterContainer = $('#budget-filter-container');
    if (filterContainer && !filterContainer.innerHTML.trim()) {
      filterContainer.innerHTML = SegmentedControl({
        id: 'budget-view-filter',
        onchange: 'app.views.budget.handleFilter',
        options: [
          { label: 'Active', value: 'active', active: state.budgetViewFilter === 'active' },
          { label: 'History', value: 'past', active: state.budgetViewFilter === 'past' },
        ],
      });
    } else if (filterContainer) {
      filterContainer.querySelectorAll('.segment').forEach((btn) => {
        const el = btn as HTMLElement;
        el.classList.toggle('active', el.dataset.value === state.budgetViewFilter);
      });
    }

    const tbody = $('#budget-list-body');
    if (!tbody) return;

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    let filteredBudgets: any[] = [];
    let viewMonthStart: Date, viewMonthEnd: Date;

    if (state.budgetViewFilter === 'active') {
      filteredBudgets = state.budgets.filter((b) => b.start_date <= today && b.end_date >= today);
      viewMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      viewMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else {
      const [year, month] = state.budgetViewMonth.split('-').map(Number);
      viewMonthStart = new Date(year, month - 1, 1);
      viewMonthEnd = new Date(year, month, 0);
      const monthStr = state.budgetViewMonth;

      filteredBudgets = state.budgets.filter((b) => {
        const bStart = b.start_date.slice(0, 7);
        const bEnd = b.end_date.slice(0, 7);
        return monthStr >= bStart && monthStr <= bEnd;
      });
    }

    // Get spending from server for the view period
    const spendingData = await window.api.getCategorySpending(
      viewMonthStart.toISOString().split('T')[0],
      viewMonthEnd.toISOString().split('T')[0]
    );

    let totalBudgeted = 0;
    let totalSpent = 0;

    if (filteredBudgets.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-12 text-text-muted opacity-50">No ${state.budgetViewFilter} budgets found.</td></tr>`;
      this.updateSummary(0, 0);
      this.refreshIcons(tbody);
      return;
    }

    // Calculate data for each budget
    const budgetsWithData: BudgetWithSpent[] = filteredBudgets.map((budget) => {
      // Find spending for this category
      // Note: This matches simple category names. If period logic is complex (e.g. weekly),
      // we might need more granular server queries or handling.
      // For now, assuming monthly aggregation matches the budget period reasonably well for "Monthly" view.

      const categorySpend = spendingData.find((s: any) => s.category === budget.category);
      const spent = categorySpend ? categorySpend.amount : 0;

      return { ...budget, spent };
    });

    // Apply sorting
    const sorted = [...budgetsWithData].sort((a, b) => {
      let A = (a as any)[this.sortField];
      let B = (b as any)[this.sortField];

      if (this.sortField === 'amount' || this.sortField === 'spent') {
        A = parseFloat(A) || 0;
        B = parseFloat(B) || 0;
      } else {
        A = (A || '').toString().toLowerCase();
        B = (B || '').toString().toLowerCase();
      }

      if (A === B) return 0;
      return this.sortDirection === 'asc' ? (A < B ? -1 : 1) : A > B ? -1 : 1;
    });

    // Render sortable header
    const thead = $('#budget-table-head');
    if (thead) {
      thead.innerHTML = `
                <tr>
                    ${SortableHeader({ label: 'Category', field: 'category', currentSort: this.sortField, direction: this.sortDirection, onclick: 'app.views.budget.sort' })}
                    ${SortableHeader({ label: 'Period', field: 'period', currentSort: this.sortField, direction: this.sortDirection, onclick: 'app.views.budget.sort' })}
                    ${SortableHeader({ label: 'Limit', field: 'amount', currentSort: this.sortField, direction: this.sortDirection, onclick: 'app.views.budget.sort' })}
                    ${SortableHeader({ label: 'Spent', field: 'spent', currentSort: this.sortField, direction: this.sortDirection, onclick: 'app.views.budget.sort' })}
                    <th>Progress</th>
                    <th>Actions</th>
                </tr>
            `;
    }

    tbody.innerHTML = sorted
      .map((budget) => {
        totalBudgeted += budget.amount;
        totalSpent += budget.spent;

        const percent = Math.min((budget.spent / budget.amount) * 100, 100);
        const remaining = budget.amount - budget.spent;
        const freq: Record<string, string> = {
          weekly: 'Weekly',
          monthly: 'Monthly',
          yearly: 'Yearly',
        };

        return `
                <tr>
                    <td><strong>${UIUtils.escapeHTML(budget.category)}</strong></td>
                    <td><span class="badge secondary">${freq[budget.period] || budget.period}</span></td>
                    <td class="font-bold">${formatter.formatCurrency(budget.amount)}</td>
                    <td class="amount expense font-bold">${formatter.formatCurrency(budget.spent)}</td>
                    <td>
                        <div class="flex-col gap-1" style="min-width: 120px;">
                            ${ProgressBar({ percent, color: this.getProgressColor(percent) })}
                            <div class="flex-row justify-between text-xs mt-1">
                                <span class="${percent > 90 ? 'text-danger' : 'text-text-muted'}">${percent.toFixed(0)}%</span>
                                <span class="${remaining < 0 ? 'text-danger' : 'text-success'}">
                                    ${remaining < 0 ? '-' : ''}${formatter.formatCurrency(Math.abs(remaining))} left
                                </span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="row-actions">
                            <button class="action-btn" onclick="app.views.budget.handleEdit(${budget.id})">
                                <i data-lucide="edit-3"></i>
                            </button>
                            <button class="action-btn danger" onclick="app.views.budget.handleDeleteBudget(${budget.id})">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
      })
      .join('');

    this.updateSummary(totalBudgeted, totalSpent);
    this.refreshIcons(tbody);
  }

  updateSummary(budgeted: number, spent: number): void {
    const remaining = budgeted - spent;
    const fmt = this.app.formatter;
    const container = $('#budget-summary-container');

    if (!container) return;

    container.innerHTML = `
            ${StatCard({
      label: 'Total Budgeted',
      value: fmt.formatCurrency(budgeted),
      icon: 'piggy-bank',
      trend: { type: 'neutral', value: 'Monthly target' },
    })}
            ${StatCard({
      label: 'Total Spent',
      value: fmt.formatCurrency(spent),
      icon: 'shopping-cart',

    })}
            ${StatCard({
      label: 'Remaining',
      value: fmt.formatCurrency(Math.abs(remaining)),
      icon: remaining < 0 ? 'alert-circle' : 'check-circle',
      trend: {
        type: remaining < 0 ? 'down' : 'up',
        value: remaining < 0 ? 'Over budget' : 'Under budget'
      },
    })}
        `;
    this.refreshIcons(container);
  }

  getProgressColor(percent: number): string {
    if (percent >= 100) return 'danger';
    if (percent >= 80) return 'warning';
    return 'success';
  }

  sort(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.render();
  }

  setupEventListeners(): void {
    $('#budget-month-filter')?.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      this.app.state.budgetViewMonth = target.value;
      this.render();
    });

    $('#btn-add-budget')?.addEventListener('click', () => this.showBudgetModal());

    $('#save-budget')?.addEventListener('click', async () => {
      const category = ($('#budget-category') as HTMLSelectElement).value;
      const amount = parseFloat(($('#budget-limit') as HTMLInputElement).value);
      const period = ($('#budget-period') as HTMLSelectElement).value;
      const startDate = ($('#budget-start') as HTMLInputElement).value;
      const endDate = ($('#budget-end') as HTMLInputElement).value;

      try {
        // Validation with specific error messages
        if (!category) {
          throw new Error('Please select a category');
        }
        if (!amount || amount <= 0) {
          throw new Error('Please enter a valid budget limit');
        }
        if (!startDate || !endDate) {
          throw new Error('Please set start and end dates');
        }
        if (new Date(startDate) > new Date(endDate)) {
          throw new Error('End date must be after start date');
        }

        if (this.editingBudgetId) {
          await window.api.updateBudget(
            this.editingBudgetId,
            category,
            amount,
            period,
            startDate,
            endDate
          );
          this.app.notifications.toast('Budget Updated', `${category} limit updated`, 'success');
        } else {
          await window.api.setBudget(category, amount, period, startDate, endDate);
          this.app.notifications.toast('Budget Created', `${category} limit set`, 'success');
        }

        this.hideBudgetModal();
        await this.render();
      } catch (err: any) {
        this.app.notifications.alert('Error', err.message, 'error');
      }
    });

    const startInput = $('#budget-start') as HTMLInputElement;
    const periodInput = $('#budget-period') as HTMLSelectElement;
    const endInput = $('#budget-end') as HTMLInputElement;

    const updateEndDate = () => {
      if (!startInput?.value) return;
      const start = new Date(startInput.value);
      let end: Date;

      switch (periodInput?.value) {
        case 'weekly':
          end = new Date(start);
          end.setDate(start.getDate() + 6);
          break;
        case 'monthly':
          end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
          break;
        case 'yearly':
          end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate() - 1);
          break;
        default:
          return;
      }
      if (endInput) endInput.value = end.toISOString().split('T')[0];
    };

    startInput?.addEventListener('change', updateEndDate);
    periodInput?.addEventListener('change', updateEndDate);

    $('#close-budget-modal')?.addEventListener('click', () => this.hideBudgetModal());
    $('#cancel-budget')?.addEventListener('click', () => this.hideBudgetModal());
  }

  handleEdit(id: number | string): void {
    const b = this.app.state.budgets.find((item) => item.id == id);
    if (!b) return;

    this.editingBudgetId = typeof id === 'string' ? parseInt(id) : id;
    this.showBudgetModal(b.category, b.amount.toString(), b.period, b.start_date, b.end_date);

    const h2 = $('#budget-modal h2');
    if (h2) h2.innerText = 'Edit Budget';
  }

  showBudgetModal(
    category: string = '',
    amount: string = '',
    period: string = 'monthly',
    start: string = '',
    end: string = ''
  ): void {
    const catInput = $('#budget-category') as HTMLSelectElement;
    const amtInput = $('#budget-limit') as HTMLInputElement;
    const perInput = $('#budget-period') as HTMLSelectElement;
    const startInput = $('#budget-start') as HTMLInputElement;
    const endInput = $('#budget-end') as HTMLInputElement;

    // Populate category dropdown if needed
    if (catInput && catInput.options.length <= 1) {
      catInput.innerHTML =
        '<option value="" disabled selected>Select Category</option>' +
        this.app.state.categories
          .filter((c) => c.type === 'expense')
          .map((c) => `<option value="${c.name}">${c.name}</option>`)
          .join('');
    }

    if (catInput) catInput.value = category;
    if (amtInput) amtInput.value = amount;
    if (perInput) perInput.value = period;

    if (!this.editingBudgetId) {
      const h2 = $('#budget-modal h2');
      if (h2) h2.innerText = 'Set New Budget';
      const now = new Date();
      if (startInput) startInput.value = start || now.toISOString().split('T')[0];
      if (endInput) {
        if (end) endInput.value = end;
        else {
          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          endInput.value = lastDay.toISOString().split('T')[0];
        }
      }
    } else {
      if (startInput) startInput.value = start;
      if (endInput) endInput.value = end;
    }

    UIUtils.setHidden('#budget-modal', false);
  }

  hideBudgetModal(): void {
    this.editingBudgetId = null;
    UIUtils.setHidden('#budget-modal', true);
  }

  async handleDeleteBudget(id: number | string): Promise<void> {
    if (await this.app.notifications.confirm('Delete Budget', 'Remove this budget limit?')) {
      await window.api.deleteBudget(Number(id));
      await this.render();
      this.app.notifications.toast('Budget Removed', 'Budget limit has been cleared', 'success');
    }
  }
}
