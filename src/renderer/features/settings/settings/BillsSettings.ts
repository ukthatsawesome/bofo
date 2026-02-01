import { $ } from '../../../lib/dom';
import { FormGroup } from '../../../components/ui/FormGroup';
import type { SettingsView } from '../SettingsView';

export const BillsSettingsMixin = {
  // Table rendering
  renderBillsTable(this: SettingsView) {
    const { state, formatter } = this.app;
    const tbody = document.getElementById('bills-table-body');
    if (!tbody) return;

    if (!state.billTypes || state.billTypes.length === 0) {
      tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-8">
                        No bill types configured. Click "New Bill Type" to add one.
                    </td>
                </tr>
            `;
      return;
    }

    tbody.innerHTML = state.billTypes
      .map(
        (bt) => `
            <tr>
                <td>
                    <div class="flex-row align-center gap-2">
                        <i data-lucide="${bt.icon || 'file-text'}" class="w-4 h-4" style="color: ${bt.color || '#7c3aed'}"></i>
                        <strong>${bt.name}</strong>
                    </div>
                </td>
                <td>${bt.unit_name || 'Units'}</td>
                <td>${formatter.formatCurrency(bt.cost_per_unit || 0)}</td>
                <td>
                    ${bt.category_name ? `<span class="text-sm">${bt.category_name}</span>` : '<span class="text-muted">—</span>'}
                    ${bt.account_id ? ` / ${state.accounts.find((a) => a.id === bt.account_id)?.name || '—'}` : ''}
                </td>
                <td>
                    ${bt.auto_transaction
            ? '<span class="status-badge success">Enabled</span>'
            : '<span class="status-badge muted">Disabled</span>'
          }
                </td>
                <td class="text-right">
                    <div class="row-actions justify-end">
                        <button class="action-btn" data-action="edit-bill-type" data-id="${bt.id}" title="Edit">
                            <i data-lucide="edit-2"></i>
                        </button>
                        <button class="action-btn danger" data-action="delete-bill-type" data-id="${bt.id}" title="Delete">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `
      )
      .join('');

    this.refreshIcons();
  },

  // CRUD handlers
  handleNewBillType(this: SettingsView) {
    this.showBillTypeModal();
  },

  async handleEditBillType(this: SettingsView, id: number) {
    const bt = this.app.state.billTypes.find((b) => b.id === id);
    if (bt) this.showBillTypeModal(bt);
  },

  async handleDeleteBillType(this: SettingsView, id: number) {
    const { notifications } = this.app;
    const bt = this.app.state.billTypes.find((b) => b.id === id);
    if (!bt) return;

    if (
      await notifications.confirm(
        'Delete Bill Type',
        `Delete "${bt.name}"? All related readings will be orphaned.`
      )
    ) {
      try {
        await window.api.deleteBillType(id);
        await this.app.loadData();
        this.renderBillsTable();
        notifications.toast('Deleted', 'Bill type removed', 'success');
      } catch (error: any) {
        notifications.toast('Error', error.message, 'error');
      }
    }
  },

  showBillTypeModal(this: SettingsView, bt: any = null) {
    const isEdit = !!bt;
    const { notifications, state } = this.app;

    const expenseCategories = state.categories.filter(
      (c) => c.type === 'expense' && c.status !== 'archived'
    );
    const activeAccounts = state.accounts.filter((a) => a.status !== 'archived');

    notifications.modal({
      title: isEdit ? 'Edit Bill Type' : 'New Bill Type',
      content: `
                <div class="form-grid">
                    ${FormGroup({
        label: 'Bill Name',
        forId: 'bt-name',
        content: `<input type="text" id="bt-name" class="form-control" value="${bt?.name || ''}" placeholder="e.g. Electricity">`
      })}
                    ${FormGroup({
        label: 'Unit Name',
        forId: 'bt-unit',
        content: `<input type="text" id="bt-unit" class="form-control" value="${bt?.unit_name || 'kWh'}" placeholder="e.g. kWh, m³">`
      })}
                    ${FormGroup({
        label: 'Cost per Unit',
        forId: 'bt-cost',
        content: `<input type="number" id="bt-cost" class="form-control" step="0.01" value="${bt?.cost_per_unit || 0}">`
      })}
                    ${FormGroup({
        label: 'Icon',
        forId: 'bt-icon',
        content: `
                        <select id="bt-icon" class="form-control">
                            <option value="zap" ${bt?.icon === 'zap' ? 'selected' : ''}>⚡ Electricity</option>
                            <option value="droplet" ${bt?.icon === 'droplet' ? 'selected' : ''}>💧 Water</option>
                            <option value="flame" ${bt?.icon === 'flame' ? 'selected' : ''}>🔥 Gas</option>
                            <option value="wifi" ${bt?.icon === 'wifi' ? 'selected' : ''}>📶 Internet</option>
                            <option value="phone" ${bt?.icon === 'phone' ? 'selected' : ''}>📱 Phone</option>
                            <option value="file-text" ${!bt?.icon || bt?.icon === 'file-text' ? 'selected' : ''}>📄 Other</option>
                        </select>`
      })}
                    <div class="form-group full-width">
                        <label for="bt-category">Expense Category (for auto-transactions)</label>
                        <select id="bt-category" class="form-control">
                            <option value="">— None —</option>
                            ${expenseCategories
          .map(
            (c) =>
              `<option value="${c.name}" ${bt?.category_name === c.name ? 'selected' : ''}>${c.name}</option>`
          )
          .join('')}
                        </select>
                    </div>
                    <div class="form-group full-width">
                        <label for="bt-account">Default Account</label>
                        <select id="bt-account" class="form-control">
                            <option value="">— Default Active Account —</option>
                            ${activeAccounts
          .map(
            (a) =>
              `<option value="${a.id}" ${bt?.account_id === a.id ? 'selected' : ''}>${a.name}</option>`
          )
          .join('')}
                        </select>
                    </div>
                    <div class="form-group full-width">
                        <label class="toggle-row" for="bt-auto">
                            <span class="text-sm font-medium">Auto-create transaction on new reading</span>
                            <div class="toggle-switch">
                                <input type="checkbox" id="bt-auto" ${bt?.auto_transaction ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </div>
                        </label>
                    </div>
                </div>
            `,
      confirmText: isEdit ? 'Save Changes' : 'Create Bill Type',
      onConfirm: async () => {
        const name = ($('#bt-name') as HTMLInputElement)?.value.trim();
        const unit_name = ($('#bt-unit') as HTMLInputElement)?.value.trim() || 'Units';
        const cost_per_unit = parseFloat(($('#bt-cost') as HTMLInputElement)?.value) || 0;
        const icon = ($('#bt-icon') as HTMLSelectElement)?.value || 'file-text';
        const category_name = ($('#bt-category') as HTMLSelectElement)?.value || undefined;
        const account_id = parseInt(($('#bt-account') as HTMLSelectElement)?.value) || undefined;
        const auto_transaction = ($('#bt-auto') as HTMLInputElement)?.checked ? 1 : 0;

        if (!name) {
          notifications.toast('Error', 'Bill name is required', 'error');
          return false;
        }

        try {
          const data = {
            name,
            unit_name,
            cost_per_unit,
            icon,
            category_name,
            account_id,
            auto_transaction,
          };
          if (isEdit) {
            await window.api.updateBillType({ id: bt.id, data });
          } else {
            await window.api.addBillType(data);
          }
          await this.app.loadData();
          this.renderBillsTable();
          notifications.toast(
            'Success',
            isEdit ? 'Bill type updated' : 'Bill type created',
            'success'
          );
        } catch (error: any) {
          notifications.toast('Error', error.message, 'error');
          return false;
        }
      },
    });
  },
};
