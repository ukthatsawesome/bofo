import { SortableHeader } from '../../components/tables/SortableHeader';
import { FormGroup } from '../../components/common/FormGroup';
import type { SettingsView } from '../SettingsView';

export const AccountsSettingsMixin = {
  // State
  accountSortField: 'name',
  accountSortDir: 'asc' as 'asc' | 'desc',

  // Table rendering
  renderAccountsTable(this: SettingsView) {
    const { state, formatter } = this.app;
    const tbody = document.getElementById('accounts-table-body');
    const thead = document.getElementById('accounts-table-head');
    if (!tbody || !thead) return;

    // Render sortable headers
    thead.innerHTML = `<tr>
            ${SortableHeader({ label: 'Name', field: 'name', currentSort: this.accountSortField, direction: this.accountSortDir, onclick: `app.views.settings.sortAccounts('name')` })}
            ${SortableHeader({ label: 'Type', field: 'type', currentSort: this.accountSortField, direction: this.accountSortDir, onclick: `app.views.settings.sortAccounts('type')` })}
            ${SortableHeader({ label: 'Starting', field: 'initial_balance', currentSort: this.accountSortField, direction: this.accountSortDir, onclick: `app.views.settings.sortAccounts('initial_balance')` })}
            ${SortableHeader({ label: 'Current', field: 'balance', currentSort: this.accountSortField, direction: this.accountSortDir, onclick: `app.views.settings.sortAccounts('balance')` })}
            ${SortableHeader({ label: 'Status', field: 'status', currentSort: this.accountSortField, direction: this.accountSortDir, onclick: `app.views.settings.sortAccounts('status')` })}
            <th class="text-right">Actions</th>
        </tr>`;

    // Sort accounts
    const sorted = [...(state.accounts || [])].sort((a: any, b: any) => {
      const dir = this.accountSortDir === 'asc' ? 1 : -1;
      if (typeof a[this.accountSortField] === 'string') {
        return a[this.accountSortField].localeCompare(b[this.accountSortField]) * dir;
      }
      return (a[this.accountSortField] - b[this.accountSortField]) * dir;
    });

    const typeLabels: Record<string, string> = {
      bank: 'Bank Account',
      wallet: 'Wallet',
      credit_card: 'Credit Card',
      loan: 'Loan',
      investment: 'Investment',
    };

    tbody.innerHTML = sorted
      .map(
        (acc) => `
            <tr class="${acc.status === 'archived' ? 'opacity-50' : ''}">
                <td><strong>${acc.name}</strong></td>
                <td>${typeLabels[acc.type] || acc.type}</td>
                <td>${formatter.formatCurrency(acc.initial_balance || 0)}</td>
                <td class="${acc.balance >= 0 ? 'text-success' : 'text-danger'}">${formatter.formatCurrency(acc.balance)}</td>
                <td>
                    <span class="status-badge ${acc.status === 'archived' ? 'muted' : 'success'}">
                        ${acc.status === 'archived' ? 'Archived' : 'Active'}
                    </span>
                </td>
                <td class="text-right">
                    <div class="row-actions justify-end">
                        <button class="action-btn" onclick="app.views.settings.handleEditAccount(${acc.id})" title="Edit">
                            <i data-lucide="edit-3"></i>
                        </button>
                        ${acc.status === 'archived'
            ? `<button class="action-btn success" onclick="app.views.settings.handleUnarchiveAccount(${acc.id})" title="Restore">
                                <i data-lucide="archive-restore"></i>
                               </button>`
            : `<button class="action-btn warning" onclick="app.views.settings.handleArchiveAccount(${acc.id})" title="Archive">
                                <i data-lucide="archive"></i>
                               </button>`
          }
                        <button class="action-btn danger" onclick="app.views.settings.handleDeleteAccount(${acc.id})" title="Delete">
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

  sortAccounts(this: SettingsView, field: string) {
    if (this.accountSortField === field) {
      this.accountSortDir = this.accountSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.accountSortField = field;
      this.accountSortDir = 'asc';
    }
    this.renderAccountsTable();
  },

  // CRUD handlers
  handleNewAccount(this: SettingsView) {
    this.showAccountModal();
  },

  async handleEditAccount(this: SettingsView, id: number) {
    const account = this.app.state.accounts.find((a) => a.id === id);
    if (account) this.showAccountModal(account);
  },

  showAccountModal(this: SettingsView, account: any = null) {
    const isEdit = !!account;
    const { notifications } = this.app;

    notifications.modal({
      title: isEdit ? 'Edit Account' : 'New Account',
      content: `
                ${FormGroup({
        label: 'Account Name',
        forId: 'setting-acc-name',
        content: `<input type="text" id="setting-acc-name" class="form-control" value="${account?.name || ''}" placeholder="e.g. Main Bank">`
      })}
                ${FormGroup({
        label: 'Account Type',
        forId: 'setting-acc-type',
        content: `
                    <select id="setting-acc-type" class="form-control">
                        <option value="bank" ${account?.type === 'bank' ? 'selected' : ''}>Bank Account</option>
                        <option value="wallet" ${account?.type === 'wallet' ? 'selected' : ''}>Wallet</option>
                        <option value="credit_card" ${account?.type === 'credit_card' ? 'selected' : ''}>Credit Card</option>
                        <option value="loan" ${account?.type === 'loan' ? 'selected' : ''}>Loan</option>
                        <option value="investment" ${account?.type === 'investment' ? 'selected' : ''}>Investment</option>
                    </select>`
      })}
                ${FormGroup({
        label: isEdit ? 'Starting Balance' : 'Initial Balance',
        forId: 'setting-acc-balance',
        content: `<input type="number" id="setting-acc-balance" class="form-control" step="0.01" value="${account?.initial_balance || 0}">`
      })}
                ${FormGroup({
        label: 'Currency',
        forId: 'setting-acc-currency',
        content: `
                    <select id="setting-acc-currency" class="form-control currency-select">
                        ${this.getCurrencyOptions(account?.currency)}
                    </select>`
      })}
            `,
      confirmText: isEdit ? 'Save Changes' : 'Create Account',
      onConfirm: async () => {
        const name = (document.getElementById('setting-acc-name') as HTMLInputElement).value.trim();
        const type = (document.getElementById('setting-acc-type') as HTMLSelectElement).value;
        const balance =
          parseFloat((document.getElementById('setting-acc-balance') as HTMLInputElement).value) ||
          0;
        const currency = (document.getElementById('setting-acc-currency') as HTMLSelectElement)
          .value;

        if (!name) {
          notifications.toast('Error', 'Account name is required', 'error');
          return false;
        }

        try {
          if (isEdit) {
            await window.api.updateAccount({
              id: account.id,
              name,
              type: type as any,
              initial_balance: balance,
              currency,
            });
          } else {
            await window.api.addAccount({ name, type: type as any, balance, currency });
          }
          await this.app.loadData();
          this.renderAccountsTable();
          notifications.toast('Success', isEdit ? 'Account updated' : 'Account created', 'success');
        } catch (error: any) {
          notifications.toast('Error', error.message, 'error');
          return false;
        }
      },
    });
  },

  async handleDeleteAccount(this: SettingsView, id: number) {
    if (
      await this.app.notifications.confirm(
        'Delete Account',
        'Delete this account? Associated transactions will be preserved but unlinked.'
      )
    ) {
      try {
        await window.api.deleteAccount(id);
        await this.app.loadData();
        this.renderAccountsTable();
        this.app.notifications.toast('Deleted', 'Account deleted', 'success');
      } catch (error: any) {
        this.app.notifications.toast('Error', error.message, 'error');
      }
    }
  },

  async handleArchiveAccount(this: SettingsView, id: number) {
    try {
      await window.api.archiveAccount(id);
      await this.app.loadData();
      this.renderAccountsTable();
      this.app.notifications.toast('Archived', 'Account archived', 'success');
    } catch (error: any) {
      this.app.notifications.toast('Error', error.message, 'error');
    }
  },

  async handleUnarchiveAccount(this: SettingsView, id: number) {
    try {
      await window.api.unarchiveAccount(id);
      await this.app.loadData();
      this.renderAccountsTable();
      this.app.notifications.toast('Restored', 'Account restored', 'success');
    } catch (error: any) {
      this.app.notifications.toast('Error', error.message, 'error');
    }
  },

  getCurrencyOptions(this: SettingsView, selected: string = 'USD') {
    const currencies = this.app?.currencies || [
      { code: 'USD', name: 'US Dollar', symbol: '$' },
      { code: 'EUR', name: 'Euro', symbol: '€' },
      { code: 'GBP', name: 'British Pound', symbol: '£' },
    ];

    return currencies
      .map(
        (c: any) =>
          `<option value="${c.code}" ${c.code === selected ? 'selected' : ''}>${c.code} - ${c.name || ''}</option>`
      )
      .join('');
  },
};
