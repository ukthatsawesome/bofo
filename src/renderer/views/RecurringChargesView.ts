import { BaseView } from './BaseView';
import { $, UIUtils } from '../core/dom';
import { StatusBadge } from '../components/common/StatusBadge';
import { Badge } from '../components/common/Badge';
import { StatCard } from '../components/common/StatCard';
import { Modal } from '../components/common/Modal';
import { SortableHeader } from '../components/tables/SortableHeader';
import { ViewHeader } from '../components/common/ViewHeader';
import type { App } from '../core/app';

import type { RecurringCharge } from '../../shared/types';

export class RecurringChargesView extends BaseView {
  private recurringCharges: RecurringCharge[] = [];

  constructor(app: App) {
    super(app, 'recurring');
  }

  async onShow(): Promise<void> {
    if (!this.isInitialized) {
      this.renderBaseTemplate();
      this.isInitialized = true;
    }
    await this.app.state.loadRecurringCharges();
    await this.render();
  }

  renderBaseTemplate(): void {
    if (!this.element) return;
    this.element.innerHTML = `
            ${ViewHeader({
      title: 'Recurring Charges',
      subtitle: 'Manage fixed monthly expenses, subscriptions, and regular bills',
      actions: `
                    <button class="btn primary" onclick="app.views.recurring.openRecurringChargeModal()">
                        <i data-lucide="plus"></i> Add Charge
                    </button>
                `,
    })}

            <div id="recurring-summary-card" class="mb-6"></div>

            <div class="card">
                <div class="card-header flex-row justify-between align-center">
                    <h3 class="mb-0"><i data-lucide="repeat" class="w-5 h-5"></i> Active Subscriptions & Bills</h3>
                </div>
                <div class="card-body no-padding overflow-x-auto">
                    <table class="data-table">
                        <thead id="recurring-table-head">
                            <tr>
                                <th>Name</th>
                                <th>Category</th>
                                <th>Frequency</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="recurring-table-body"></tbody>
                    </table>
                </div>
            </div>

            <!-- Shared Modal Component -->
            ${Modal({
      id: 'recurring-charge-modal',
      title: 'Add Recurring Charge',
      content: `
                    <form id="recurring-charge-form" class="mt-0">
                        <input type="hidden" id="recurring-id">
                        
                        <div class="form-group">
                            <label>Name</label>
                            <input type="text" id="recurring-name" class="form-control" placeholder="e.g., Netflix, Rent" required>
                        </div>

                        <div class="form-grid">
                            <div class="form-group">
                                <label>Category</label>
                                <select id="recurring-category" class="form-control">
                                    <option value="Rent">Rent</option>
                                    <option value="Utilities">Utilities</option>
                                    <option value="Subscriptions">Subscriptions</option>
                                    <option value="Insurance">Insurance</option>
                                    <option value="Loan">Loan</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Amount</label>
                                <input type="number" id="recurring-amount" class="form-control" step="0.01" min="0.01" required>
                            </div>
                        </div>

                        <div class="form-grid">
                            <div class="form-group">
                                <label>Frequency</label>
                                <select id="recurring-frequency" class="form-control">
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly" selected>Monthly</option>
                                    <option value="yearly">Yearly</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Due Day (1-31)</label>
                                <input type="number" id="recurring-due-day" class="form-control" min="1" max="31" value="1">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Notes (optional)</label>
                            <input type="text" id="recurring-notes" class="form-control" placeholder="Any notes...">
                        </div>

                        <div class="flex-row justify-end gap-3 mt-6">
                            <button type="button" class="btn secondary" id="btn-cancel-recurring">Cancel</button>
                            <button type="submit" class="btn primary">Save Charge</button>
                        </div>
                    </form>
                `,
    })}
        `;
    this.refreshIcons();

    // Bind cancel button (can't do inline onclick with component)
    const btnCancel = $('#btn-cancel-recurring');
    if (btnCancel) {
      btnCancel.addEventListener('click', () => this.closeRecurringChargeModal());
    }
  }

  async render(): Promise<void> {
    const { state, formatter } = this.app;
    const charges = await window.api.getRecurringCharges();
    this.recurringCharges = charges;
    const monthlyTotal = await window.api.getMonthlyRecurringTotal();

    // Summary Card
    const summaryContainer = $('#recurring-summary-card');
    if (summaryContainer) {
      summaryContainer.innerHTML = StatCard({
        label: 'Monthly Recurring Burden',
        value: formatter.formatCurrency(monthlyTotal),
        icon: 'receipt',
        layout: 'horizontal',
        iconColor: 'danger',
        className: 'text-danger',
        rightContent: `
            <p class="text-lg font-bold">${charges.length} Total</p>
            <p class="text-text-muted text-sm">${charges.filter((c) => c.is_active).length} Active Subscriptions</p>
        `,
      });
    }

    // Table Header
    const field = state.recurringSortField || 'name';
    const direction = state.recurringSortDirection || 'asc';
    const sorted = [...charges].sort((a: any, b: any) => {
      let A = a[field];
      let B = b[field];
      if (field === 'amount') {
        A = parseFloat(A) || 0;
        B = parseFloat(B) || 0;
      } else {
        A = (A || '').toString().toLowerCase();
        B = (B || '').toString().toLowerCase();
      }
      if (A === B) return 0;
      return direction === 'asc' ? (A < B ? -1 : 1) : A > B ? -1 : 1;
    });

    const thead = $('#recurring-table-head');
    if (thead && !thead.innerHTML.trim()) {
      thead.innerHTML = `
            <tr>
                    ${SortableHeader({ label: 'Name', field: 'name', currentSort: field, direction: direction as any, onclick: 'app.views.recurring.sort' })}
                    ${SortableHeader({ label: 'Category', field: 'category', currentSort: field, direction: direction as any, onclick: 'app.views.recurring.sort' })}
                    ${SortableHeader({ label: 'Frequency', field: 'frequency', currentSort: field, direction: direction as any, onclick: 'app.views.recurring.sort' })}
                    ${SortableHeader({ label: 'Amount', field: 'amount', currentSort: field, direction: direction as any, onclick: 'app.views.recurring.sort' })}
                    <th>Status</th>
                    <th>Actions</th>
            </tr>
            `;
    }

    // Table Body
    const tbody = $('#recurring-table-body');
    if (tbody) {
      if (sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-12 text-text-muted opacity-50">No recurring charges found.</td></tr>`;
      } else {
        tbody.innerHTML = sorted
          .map((c) => {
            const freq: Record<string, string> = { once: 'One-time', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
            return `
                        <tr class="${!c.is_active ? 'opacity-40' : ''}">
                            <td><strong>${UIUtils.escapeHTML(c.name)}</strong></td>
                            <td>${Badge({ label: UIUtils.escapeHTML(c.category), variant: 'default' })}</td>
                            <td>${freq[c.frequency]}</td>
                            <td class="amount expense font-bold">${formatter.formatCurrency(c.amount)}</td>
                            <td>${StatusBadge({ label: c.is_active ? 'Active' : 'Paused', variant: c.is_active ? 'active' : 'warning' })}</td>
                            <td>
                                <div class="row-actions">
                                    <button class="action-btn" onclick="app.views.recurring.toggleStatus(${c.id}, ${!c.is_active})">
                                        <i data-lucide="${c.is_active ? 'pause' : 'play'}"></i>
                                    </button>
                                    <button class="action-btn" onclick="app.views.recurring.openRecurringChargeModal(${c.id})">
                                        <i data-lucide="edit-3"></i>
                                    </button>
                                    <button class="action-btn danger" onclick="app.views.recurring.delete(${c.id})">
                                        <i data-lucide="trash-2"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
          })
          .join('');
      }
      this.refreshIcons(tbody);
    }

    const form = $('#recurring-charge-form') as HTMLFormElement;
    if (form && !form.dataset.bound) {
      form.dataset.bound = 'true';
      form.onsubmit = (e) => {
        e.preventDefault();
        this.save();
      };
    }

    this.refreshIcons('#recurring-summary-card');

  }

  sort(field: string): void {
    const { state } = this.app;
    if (state.recurringSortField === field) {
      state.recurringSortDirection = state.recurringSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      state.recurringSortField = field;
      state.recurringSortDirection = 'asc';
    }
    this.render();
  }

  openRecurringChargeModal(id: number | null = null): void {
    const modal = $('#recurring-charge-modal');
    const form = $('#recurring-charge-form') as HTMLFormElement;
    if (id) {
      const c = this.recurringCharges.find((x) => x.id === id);
      if (c) {
        const title = $('#recurring-modal-title');
        if (title) title.textContent = 'Edit Recurring Charge';
        ($('#recurring-id') as HTMLInputElement).value = c.id.toString();
        ($('#recurring-name') as HTMLInputElement).value = c.name;
        ($('#recurring-category') as HTMLSelectElement).value = c.category;
        ($('#recurring-amount') as HTMLInputElement).value = c.amount.toString();
        ($('#recurring-frequency') as HTMLSelectElement).value = c.frequency;
        ($('#recurring-due-day') as HTMLInputElement).value = (c.due_day || 1).toString();
        ($('#recurring-notes') as HTMLInputElement).value = c.notes || '';
      }
    } else {
      const title = $('#recurring-modal-title');
      if (title) title.textContent = 'Add Recurring Charge';
      form?.reset();
      const idInput = $('#recurring-id') as HTMLInputElement;
      if (idInput) idInput.value = '';
    }
    UIUtils.setHidden('#recurring-charge-modal', false);
  }

  closeRecurringChargeModal(): void {
    UIUtils.setHidden('#recurring-charge-modal', true);
  }

  async save(): Promise<void> {
    const id = ($('#recurring-id') as HTMLInputElement).value;
    const name = ($('#recurring-name') as HTMLInputElement).value?.trim();
    const amount = parseFloat(($('#recurring-amount') as HTMLInputElement).value);

    // Validation
    if (!name) {
      this.app.notifications.toast('Error', 'Name is required', 'error');
      return;
    }
    if (!amount || amount <= 0) {
      this.app.notifications.toast('Error', 'Please enter a valid amount', 'error');
      return;
    }

    const data: any = {
      name,
      category: ($('#recurring-category') as HTMLSelectElement).value,
      amount,
      frequency: ($('#recurring-frequency') as HTMLSelectElement).value,
      due_day: parseInt(($('#recurring-due-day') as HTMLInputElement).value) || 1,
      notes: ($('#recurring-notes') as HTMLInputElement).value || null,
    };

    try {
      if (id) {
        await window.api.updateRecurringCharge(parseInt(id), data);
        this.app.notifications.toast('Updated', `"${data.name}" updated`);
      } else {
        await window.api.createRecurringCharge(data);
        this.app.notifications.toast('Saved', `"${data.name}" added`, 'success');
      }
      this.closeRecurringChargeModal();
      this.render();
    } catch (error: any) {
      this.app.notifications.alert('Error', error.message, 'error');
    }
  }

  async toggleStatus(id: number, active: boolean): Promise<void> {
    try {
      await window.api.updateRecurringCharge(id, { is_active: active ? 1 : 0 });
      this.render();
    } catch (e) {
      console.error(e);
    }
  }

  async delete(id: number): Promise<void> {
    if (await this.app.notifications.confirm('Delete Charge?', 'Remove this recurring charge?')) {
      try {
        await window.api.deleteRecurringCharge(id);
        this.render();
      } catch (e) {
        console.error(e);
      }
    }
  }
}
