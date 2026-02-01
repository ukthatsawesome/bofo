import { $ } from '../../../lib/dom';
import { FormGroup } from '../../../components/ui/FormGroup';
import type { SettingsView } from '../SettingsView';

import type { ExchangeRate } from '../../../../shared/types';

export const ExchangeRatesSettingsMixin = {
  // Exchange rates rendering
  async renderExchangeRates(this: SettingsView) {
    const settings = await window.api.getSettings();
    const baseCurrency = settings.currency_base || 'USD';

    // Update base currency display
    const baseDisplay = $('#base-currency-display');
    if (baseDisplay) baseDisplay.textContent = baseCurrency;

    // Provider dropdown handler
    const providerSelect = $('#currency-api-provider') as HTMLSelectElement;
    const customUrlGroup = $('#custom-api-url-group');

    if (providerSelect) {
      providerSelect.value = settings.currency_api_provider || 'frankfurter';
      providerSelect.addEventListener('change', () => {
        if (customUrlGroup) {
          customUrlGroup.style.display = providerSelect.value === 'custom' ? 'block' : 'none';
        }
      });
      // Trigger initial state
      if (customUrlGroup) {
        customUrlGroup.style.display = providerSelect.value === 'custom' ? 'block' : 'none';
      }
    }

    if ($('#currency-custom-url')) {
      ($('#currency-custom-url') as HTMLInputElement).value = settings.currency_custom_url || '';
    }

    // Auto-sync toggle state
    const autoSyncToggle = $('#exchange-rate-auto-sync') as HTMLInputElement;
    if (autoSyncToggle) {
      autoSyncToggle.checked = settings.exchange_rate_sync_on_startup === 'true';
    }

    // Display sync status with staleness warning
    await this.renderSyncStatus();
    await this.renderExchangeRatesTable();
    this.refreshIcons();
  },

  async handleAutoSyncToggle(this: SettingsView) {
    const toggle = $('#exchange-rate-auto-sync') as HTMLInputElement;
    const enabled = toggle?.checked ? 'true' : 'false';

    await window.api.updateSetting({ key: 'exchange_rate_sync_on_startup', value: enabled });
    this.app.notifications.toast(
      toggle?.checked ? 'Enabled' : 'Disabled',
      toggle?.checked ? 'Rates will sync on startup when stale' : 'Auto-sync on startup disabled',
      'success'
    );
  },

  async renderSyncStatus(this: SettingsView) {
    const statusDiv = $('#exchange-rate-sync-status');
    if (!statusDiv) return;

    try {
      const syncStatus = await window.api.getRateSyncStatus();
      const lastSyncDate = syncStatus.lastSync
        ? new Date(syncStatus.lastSync).toLocaleString()
        : 'Never';

      if (syncStatus.isStale) {
        statusDiv.innerHTML = `
                    <div class="flex-row align-center gap-2 p-3 rounded-lg bg-warning/10">
                        <i data-lucide="alert-triangle" class="w-4 h-4 text-warning"></i>
                        <div class="flex-1">
                            <span class="text-warning font-medium">Exchange rates are stale</span>
                            <div class="text-muted text-sm">Last sync: ${lastSyncDate} (${Math.round(syncStatus.hoursSinceSync)}h ago)</div>
                        </div>
                    </div>
                `;
      } else {
        statusDiv.innerHTML = `
                    <div class="flex-row align-center gap-2 p-3 rounded-lg bg-success/10">
                        <i data-lucide="check-circle" class="w-4 h-4 text-success"></i>
                        <div class="flex-1">
                            <span class="text-success">Rates are up to date</span>
                            <div class="text-muted text-sm">Last sync: ${lastSyncDate} · ${syncStatus.rateCount} rates</div>
                        </div>
                    </div>
                `;
      }
      this.refreshIcons();
    } catch (error) {
      console.error('Failed to get sync status:', error);
    }
  },

  async renderExchangeRatesTable(this: SettingsView) {
    const tbody = $('#exchange-rates-table-body');
    if (!tbody) return;

    try {
      const rates: ExchangeRate[] = await window.api.getExchangeRates();

      if (!rates || rates.length === 0) {
        tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-muted py-8">
                            No exchange rates configured. Use "Sync Rates Now" to fetch rates automatically.
                        </td>
                    </tr>
                `;
        return;
      }

      tbody.innerHTML = rates
        .map(
          (rate) => `
                <tr>
                    <td><strong>${rate.from_currency}</strong></td>
                    <td><strong>${rate.to_currency}</strong></td>
                    <td>${rate.rate.toFixed(6)}</td>
                    <td>
                        <span class="status-badge ${rate.source === 'api' ? 'info' : 'muted'}">
                            ${rate.source === 'api' ? 'API' : 'Manual'}
                        </span>
                    </td>
                    <td class="text-muted text-sm">${new Date(rate.last_updated).toLocaleDateString()}</td>
                    <td class="text-right">
                        <div class="row-actions justify-end">
                            <button class="action-btn" onclick="app.views.settings.handleEditExchangeRate(${rate.id})" title="Edit">
                                <i data-lucide="edit-3"></i>
                            </button>
                            <button class="action-btn danger" onclick="app.views.settings.handleDeleteExchangeRate(${rate.id})" title="Delete">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `
        )
        .join('');

      this.refreshIcons();
    } catch (error) {
      console.error('Failed to load exchange rates:', error);
      tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger py-8">
                        Failed to load exchange rates
                    </td>
                </tr>
            `;
    }
  },

  async handleSyncExchangeRates(this: SettingsView) {
    const { notifications } = this.app;
    const statusDiv = $('#exchange-rate-sync-status');
    const providerSelect = $('#currency-api-provider') as HTMLSelectElement;
    const customUrlInput = $('#currency-custom-url') as HTMLInputElement;

    const provider = providerSelect?.value || 'frankfurter';
    const customUrl = customUrlInput?.value || '';

    // Save provider preference
    await window.api.updateSetting({ key: 'currency_api_provider', value: provider });
    if (provider === 'custom') {
      await window.api.updateSetting({ key: 'currency_custom_url', value: customUrl });
    }

    if (statusDiv) {
      statusDiv.innerHTML = `
                <div class="flex-row align-center gap-2 p-3 rounded-lg bg-info/10">
                    <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>
                    <span class="text-info">Syncing exchange rates...</span>
                </div>
            `;
      this.refreshIcons();
    }

    try {
      const settings = await window.api.getSettings();
      const baseCurrency = settings.currency_base || 'USD';
      const result = await window.api.syncExchangeRates({ provider, baseCurrency, customUrl });

      if (result.success) {
        await this.renderSyncStatus();
        await this.renderExchangeRatesTable();
        notifications.toast(
          'Synced',
          `Updated ${result.ratesUpdated || 0} exchange rates`,
          'success'
        );
      } else {
        throw new Error(result.message || 'Sync failed');
      }
    } catch (error: any) {
      console.error('Sync failed:', error);
      if (statusDiv) {
        statusDiv.innerHTML = `
                    <div class="flex-row align-center gap-2 p-3 rounded-lg bg-danger/10">
                        <i data-lucide="alert-circle" class="w-4 h-4 text-danger"></i>
                        <span class="text-danger">Sync failed: ${error.message}</span>
                    </div>
                `;
        this.refreshIcons();
      }
      notifications.toast('Error', error.message, 'error');
    }
  },

  async handleTestCurrencyAPI(this: SettingsView) {
    const { notifications } = this.app;
    const statusDiv = $('#exchange-rate-sync-status');
    const providerSelect = $('#currency-api-provider') as HTMLSelectElement;
    const customUrlInput = $('#currency-custom-url') as HTMLInputElement;

    const provider = providerSelect?.value || 'frankfurter';
    const customUrl = customUrlInput?.value || '';

    if (statusDiv) {
      statusDiv.innerHTML = `
                <div class="flex-row align-center gap-2 p-3 rounded-lg bg-info/10">
                    <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>
                    <span class="text-info">Testing connection...</span>
                </div>
            `;
      this.refreshIcons();
    }

    try {
      const settings = await window.api.getSettings();
      const baseCurrency = settings.currency_base || 'USD';
      const result = await window.api.testCurrencyAPI({ provider, baseCurrency, customUrl });
      if (!result.success) throw new Error(result.message);

      if (statusDiv) {
        statusDiv.innerHTML = `
                    <div class="flex-row align-center gap-2 p-3 rounded-lg bg-success/10">
                        <i data-lucide="check-circle" class="w-4 h-4 text-success"></i>
                        <span class="text-success">Connection successful! API is reachable.</span>
                    </div>
                `;
        this.refreshIcons();
      }
      notifications.toast('Success', 'API connection test passed', 'success');
    } catch (error: any) {
      if (statusDiv) {
        statusDiv.innerHTML = `
                    <div class="flex-row align-center gap-2 p-3 rounded-lg bg-danger/10">
                        <i data-lucide="alert-circle" class="w-4 h-4 text-danger"></i>
                        <span class="text-danger">Connection failed: ${error.message}</span>
                    </div>
                `;
        this.refreshIcons();
      }
      notifications.toast('Error', error.message, 'error');
    }
  },

  handleNewExchangeRate(this: SettingsView) {
    this.showExchangeRateModal();
  },

  async handleEditExchangeRate(this: SettingsView, id: number) {
    const rates = await window.api.getExchangeRates();
    const rate = rates.find((r: ExchangeRate) => r.id === id);
    if (rate) this.showExchangeRateModal(rate);
  },

  showExchangeRateModal(this: SettingsView, rate: ExchangeRate | null = null) {
    const isEdit = !!rate;
    const { notifications } = this.app;

    const currencies = [
      'USD',
      'EUR',
      'GBP',
      'JPY',
      'CNY',
      'INR',
      'NPR',
      'AUD',
      'CAD',
      'CHF',
      'SGD',
      'HKD',
      'KRW',
      'MXN',
      'BRL',
    ];

    notifications.modal({
      title: isEdit ? 'Edit Exchange Rate' : 'Add Exchange Rate',
      content: `
                <div class="form-grid">
                    ${FormGroup({
        label: 'From Currency',
        forId: 'rate-from',
        content: `
                        <select id="rate-from" class="form-control" ${isEdit ? 'disabled' : ''}>
                            ${currencies.map((c) => `<option value="${c}" ${rate?.from_currency === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>`
      })}
                    ${FormGroup({
        label: 'To Currency',
        forId: 'rate-to',
        content: `
                        <select id="rate-to" class="form-control" ${isEdit ? 'disabled' : ''}>
                            ${currencies.map((c) => `<option value="${c}" ${rate?.to_currency === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>`
      })}
                    ${FormGroup({
        label: 'Exchange Rate',
        forId: 'rate-value',
        content: `
                        <input type="number" id="rate-value" class="form-control" step="0.000001" value="${rate?.rate || 1}">
                        <small class="text-muted">1 [From] = [Rate] [To]</small>`
      })}
                </div>
            `,
      confirmText: isEdit ? 'Save Rate' : 'Add Rate',
      onConfirm: async () => {
        const from = ($('#rate-from') as HTMLSelectElement)?.value;
        const to = ($('#rate-to') as HTMLSelectElement)?.value;
        const rateValue = parseFloat(($('#rate-value') as HTMLInputElement)?.value) || 1;

        if (from === to) {
          notifications.toast('Error', 'From and To currencies must be different', 'error');
          return false;
        }

        try {
          await window.api.setExchangeRate({ from, to, rate: rateValue, source: 'manual' });
          await this.renderExchangeRatesTable();
          notifications.toast('Success', isEdit ? 'Rate updated' : 'Rate added', 'success');
        } catch (error: any) {
          notifications.toast('Error', error.message, 'error');
          return false;
        }
      },
    });
  },

  async handleDeleteExchangeRate(this: SettingsView, id: number) {
    const { notifications } = this.app;

    if (await notifications.confirm('Delete Rate', 'Remove this exchange rate?')) {
      try {
        await window.api.deleteExchangeRate(id);
        await this.renderExchangeRatesTable();
        notifications.toast('Deleted', 'Exchange rate removed', 'success');
      } catch (error: any) {
        notifications.toast('Error', error.message, 'error');
      }
    }
  },
};
