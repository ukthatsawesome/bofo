/**
 * Settings - Exchange Rates Section
 * Handles currency exchange rate management and API sync
 */

import { $ } from '../../core/dom.js';
import { SegmentedControl } from '../../components/common/SegmentedControl.js';

export const ExchangeRatesSettingsMixin = {
    // Exchange rates rendering
    async renderExchangeRates() {
        const settings = await window.api.getSettings();
        const baseCurrency = settings.currency_base || 'USD';

        // Update base currency display
        const baseDisplay = $('#base-currency-display');
        if (baseDisplay) baseDisplay.textContent = baseCurrency;

        // Provider dropdown handler
        const providerSelect = $('#currency-api-provider');
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
            $('#currency-custom-url').value = settings.currency_custom_url || '';
        }

        await this.renderExchangeRatesTable();
        this.refreshIcons();
    },

    async renderExchangeRatesTable() {
        const tbody = $('#exchange-rates-table-body');
        if (!tbody) return;

        try {
            const rates = await window.api.getExchangeRates();

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

            tbody.innerHTML = rates.map(rate => `
                <tr>
                    <td><strong>${rate.from_currency}</strong></td>
                    <td><strong>${rate.to_currency}</strong></td>
                    <td>${rate.rate.toFixed(6)}</td>
                    <td>
                        <span class="status-badge ${rate.source === 'api' ? 'info' : 'muted'}">
                            ${rate.source === 'api' ? 'API' : 'Manual'}
                        </span>
                    </td>
                    <td class="text-muted text-sm">${new Date(rate.updated_at).toLocaleDateString()}</td>
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
            `).join('');

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

    async handleSyncExchangeRates() {
        const { notifications } = this.app;
        const statusDiv = $('#exchange-rate-sync-status');
        const providerSelect = $('#currency-api-provider');
        const customUrlInput = $('#currency-custom-url');

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
            const result = await window.api.syncExchangeRates({ provider, customUrl });

            if (statusDiv) {
                statusDiv.innerHTML = `
                    <div class="flex-row align-center gap-2 p-3 rounded-lg bg-success/10">
                        <i data-lucide="check-circle" class="w-4 h-4 text-success"></i>
                        <span class="text-success">Synced ${result.count || 0} exchange rates</span>
                    </div>
                `;
                this.refreshIcons();
            }

            await this.renderExchangeRatesTable();
            notifications.toast('Synced', `Updated ${result.count || 0} exchange rates`, 'success');
        } catch (error) {
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

    async handleTestCurrencyAPI() {
        const { notifications } = this.app;
        const statusDiv = $('#exchange-rate-sync-status');
        const providerSelect = $('#currency-api-provider');
        const customUrlInput = $('#currency-custom-url');

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
            const result = await window.api.testCurrencyAPI({ provider, customUrl });

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
        } catch (error) {
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

    handleNewExchangeRate() {
        this.showExchangeRateModal();
    },

    async handleEditExchangeRate(id) {
        const rates = await window.api.getExchangeRates();
        const rate = rates.find(r => r.id === id);
        if (rate) this.showExchangeRateModal(rate);
    },

    showExchangeRateModal(rate = null) {
        const isEdit = !!rate;
        const { notifications } = this.app;

        const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'NPR', 'AUD', 'CAD', 'CHF', 'SGD', 'HKD', 'KRW', 'MXN', 'BRL'];

        notifications.modal({
            title: isEdit ? 'Edit Exchange Rate' : 'Add Exchange Rate',
            content: `
                <div class="form-grid">
                    <div class="form-group">
                        <label>From Currency</label>
                        <select id="rate-from" class="form-control" ${isEdit ? 'disabled' : ''}>
                            ${currencies.map(c => `<option value="${c}" ${rate?.from_currency === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>To Currency</label>
                        <select id="rate-to" class="form-control" ${isEdit ? 'disabled' : ''}>
                            ${currencies.map(c => `<option value="${c}" ${rate?.to_currency === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group full-width">
                        <label>Exchange Rate</label>
                        <input type="number" id="rate-value" class="form-control" step="0.000001" value="${rate?.rate || 1}">
                        <small class="text-muted">1 [From] = [Rate] [To]</small>
                    </div>
                </div>
            `,
            confirmText: isEdit ? 'Save Rate' : 'Add Rate',
            onConfirm: async () => {
                const from = $('#rate-from')?.value;
                const to = $('#rate-to')?.value;
                const rateValue = parseFloat($('#rate-value')?.value) || 1;

                if (from === to) {
                    notifications.toast('Error', 'From and To currencies must be different', 'error');
                    return false;
                }

                try {
                    await window.api.setExchangeRate({ from, to, rate: rateValue, source: 'manual' });
                    await this.renderExchangeRatesTable();
                    notifications.toast('Success', isEdit ? 'Rate updated' : 'Rate added', 'success');
                } catch (error) {
                    notifications.toast('Error', error.message, 'error');
                    return false;
                }
            }
        });
    },

    async handleDeleteExchangeRate(id) {
        const { notifications } = this.app;

        if (await notifications.confirm('Delete Rate', 'Remove this exchange rate?')) {
            try {
                await window.api.deleteExchangeRate(id);
                await this.renderExchangeRatesTable();
                notifications.toast('Deleted', 'Exchange rate removed', 'success');
            } catch (error) {
                notifications.toast('Error', error.message, 'error');
            }
        }
    }
};
