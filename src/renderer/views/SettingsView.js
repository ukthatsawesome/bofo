import { BaseView } from './BaseView.js';
import { $, $$, UIUtils } from '../core/dom.js';
import { eventBus } from '../core/eventBus.js';
import { Card } from '../components/common/Card.js';
import { FormGroup } from '../components/common/FormGroup.js';
import { StatusBadge } from '../components/common/StatusBadge.js';
import { TypePill } from '../components/common/TypePill.js';
import { SegmentedControl } from '../components/common/SegmentedControl.js';
import { SortableHeader } from '../components/tables/SortableHeader.js';

export class SettingsView extends BaseView {
    constructor(app) {
        super(app, 'settings');
    }

    async onShow() {
        if (!this.isInitialized) {
            this.renderBaseTemplate();
            this.isInitialized = true;
        }
        this.showHome();
    }

    renderBaseTemplate() {
        this.element.innerHTML = `
            <div class="view-header">
                <div class="header-main">
                    <h1>Settings</h1>
                    <p class="text-muted">Configure your app preferences and data</p>
                </div>
            </div>

            <!-- Settings Home -->
            <div id="settings-home" class="settings-sub-view">
                <div class="settings-grid">
                    <div class="card clickable-card" onclick="app.views.settings.showSubView('accounts-mgmt')">
                        <div class="card-body flex-row align-center gap-4">
                            <div class="icon-box primary"><i data-lucide="wallet"></i></div>
                            <div>
                                <h3>Accounts</h3>
                                <p class="text-muted">Manage your bank accounts and cards</p>
                            </div>
                        </div>
                    </div>
                    <div class="card clickable-card" onclick="app.views.settings.showSubView('categories-mgmt')">
                        <div class="card-body flex-row align-center gap-4">
                            <div class="icon-box success"><i data-lucide="tag"></i></div>
                            <div>
                                <h3>Categories</h3>
                                <p class="text-muted">Organize your transaction labels</p>
                            </div>
                        </div>
                    </div>
                    <div class="card clickable-card" onclick="app.views.settings.showSubView('forecast-settings')">
                        <div class="card-body flex-row align-center gap-4">
                            <div class="icon-box danger"><i data-lucide="trending-up"></i></div>
                            <div>
                                <h3>Forecast Engine</h3>
                                <p class="text-muted">Tune your wealth projection parameters</p>
                            </div>
                        </div>
                    </div>
                    <div class="card clickable-card" onclick="app.views.settings.showSubView('preferences-settings')">
                        <div class="card-body flex-row align-center gap-4">
                            <div class="icon-box info"><i data-lucide="settings-2"></i></div>
                            <div>
                                <h3>Preferences</h3>
                                <p class="text-muted">Currency, theme, and display options</p>
                            </div>
                        </div>
                    </div>
                    <div class="card clickable-card" onclick="app.views.settings.showSubView('bills-mgmt')">
                        <div class="card-body flex-row align-center gap-4">
                            <div class="icon-box primary"><i data-lucide="receipt"></i></div>
                            <div>
                                <h3>Manage Bills</h3>
                                <p class="text-muted">Configure bill types and cost per unit</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Subviews -->
            <div id="accounts-mgmt" class="settings-sub-view hidden">
                <div class="card">
                    <div class="card-header flex-row justify-between align-center">
                        <div class="flex-row align-center gap-2">
                            <button class="btn icon" onclick="app.views.settings.showHome()"><i data-lucide="arrow-left"></i></button>
                            <h3>Manage Accounts</h3>
                        </div>
                        <button class="btn primary" onclick="app.views.settings.handleNewAccount()"><i data-lucide="plus"></i> New Account</button>
                    </div>
                    <div class="card-body no-padding">
                        <table class="data-table">
                            <thead id="accounts-table-head">
                                <tr>
                                    <th>Name</th>
                                    <th>Type</th>
                                    <th>Starting</th>
                                    <th>Current Balance</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="accounts-table-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div id="categories-mgmt" class="settings-sub-view hidden">
                <div class="card">
                    <div class="card-header flex-row justify-between align-center">
                        <div class="flex-row align-center gap-2">
                            <button class="btn icon" onclick="app.views.settings.showHome()"><i data-lucide="arrow-left"></i></button>
                            <h3>Manage Categories</h3>
                        </div>
                        <div id="category-filter-container"></div>
                        <button class="btn primary" onclick="app.views.settings.handleNewCategory()"><i data-lucide="plus"></i> New Category</button>
                    </div>
                    <div class="card-body no-padding">
                        <table class="data-table">
                            <thead id="category-table-head"></thead>
                            <tbody id="category-table-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div id="ai-settings" class="settings-sub-view hidden">
                <div class="card">
                    <div class="card-header flex-row align-center gap-2">
                        <button class="btn icon" onclick="app.views.settings.showHome()"><i data-lucide="arrow-left"></i></button>
                        <h3>AI Engine Configuration</h3>
                    </div>
                    <div class="card-body">
                        <div id="ai-status-container" class="mb-6"></div>
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Ollama Server URL</label>
                                <div class="flex-row gap-2">
                                    <input type="text" id="set-ai-url" class="form-control" placeholder="http://localhost:11434">
                                    <button class="btn" id="btn-refresh-models" title="Fetch Models">
                                        <i data-lucide="refresh-cw"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Selected Model</label>
                                <select id="set-ai-model" class="form-control"></select>
                            </div>
                            <div class="form-group full-width">
                                <label class="toggle-row">
                                    <span class="text-sm font-medium">Enable AI Insights & Categorization</span>
                                    <div class="toggle-switch">
                                        <input type="checkbox" id="set-ai-enabled">
                                        <span class="toggle-slider"></span>
                                    </div>
                                </label>
                            </div>
                            <div class="form-group full-width">
                                <div class="flex-row justify-between align-center mb-2">
                                    <label>Transaction Prompt</label>
                                    <button class="btn link sm" id="reset-prompt-tx">Reset to Default</button>
                                </div>
                                <textarea id="set-ai-prompt-tx" class="form-control" rows="3"></textarea>
                            </div>
                            <div class="form-group full-width">
                                <div class="flex-row justify-between align-center mb-2">
                                    <label>Insights Prompt</label>
                                    <button class="btn link sm" id="reset-prompt-insight">Reset to Default</button>
                                </div>
                                <textarea id="set-ai-prompt-insight" class="form-control" rows="3"></textarea>
                            </div>
                            <div class="form-group full-width">
                                <div class="flex-row justify-between align-center mb-2">
                                    <label>Chat/Sandbox Prompt</label>
                                    <button class="btn link sm" id="reset-prompt-chat">Reset to Default</button>
                                </div>
                                <textarea id="set-ai-prompt-chat" class="form-control" rows="3"></textarea>
                            </div>
                        </div>
                        <div class="card-footer mt-6">
                            <button class="btn primary" id="btn-save-ai">Save AI Configuration</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="forecast-settings" class="settings-sub-view hidden">
                <div class="card">
                    <div class="card-header flex-row align-center gap-2">
                        <button class="btn icon" onclick="app.views.settings.showHome()"><i data-lucide="arrow-left"></i></button>
                        <h3>Forecast Parameters</h3>
                    </div>
                    <div class="card-body">
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Projection Horizon (Months)</label>
                                <input type="number" id="set-forecast-horizon" class="form-control" min="1" max="120">
                            </div>
                            <div class="form-group">
                                <label class="toggle-container">
                                    <div class="toggle-switch">
                                        <input type="checkbox" id="set-forecast-inflation-enabled">
                                        <span class="toggle-slider"></span>
                                    </div>
                                    <span class="text-sm font-medium">Apply Inflation to Expenses</span>
                                </label>
                            </div>
                            <div class="form-group" id="inflation-rate-group">
                                <label>Annual Inflation Rate (%)</label>
                                <input type="number" id="set-forecast-inflation-rate" class="form-control" step="0.1" min="0">
                            </div>
                        </div>
                        <div class="card-footer mt-6">
                            <button class="btn primary" onclick="app.views.settings.saveForecastSettings()">Save Parameters</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="preferences-settings" class="settings-sub-view hidden">
                <div class="card">
                    <div class="card-header flex-row align-center gap-2">
                        <button class="btn icon" onclick="app.views.settings.showHome()"><i data-lucide="arrow-left"></i></button>
                        <h3>App Preferences</h3>
                    </div>
                    <div class="card-body">
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Base Currency</label>
                                <select id="set-currency-base" class="form-control currency-select"></select>
                            </div>
                            <div class="form-group">
                                <label>Decimal Precision</label>
                                <select id="set-currency-precision" class="form-control">
                                    <option value="0">0 (e.g. $1,234)</option>
                                    <option value="2">2 (e.g. $1,234.56)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Theme</label>
                                <select id="set-theme" class="form-control">
                                    <option value="dark">Onyx Dark (Default)</option>
                                    <option value="light">Crisp Light</option>
                                    <option value="system">System Default</option>
                                </select>
                            </div>
                        </div>
                        <div class="card-footer mt-6">
                            <button class="btn primary" onclick="app.views.settings.savePreferences()">Save Preferences</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="bills-mgmt" class="settings-sub-view hidden">
                <div class="card">
                    <div class="card-header flex-row justify-between align-center">
                        <div class="flex-row align-center gap-2">
                            <button class="btn icon" onclick="app.views.settings.showHome()"><i data-lucide="arrow-left"></i></button>
                            <h3>Manage Bills</h3>
                        </div>
                        <button class="btn primary" onclick="app.views.settings.handleNewBillType()"><i data-lucide="plus"></i> New Bill Type</button>
                    </div>
                    <div class="card-body no-padding">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Unit</th>
                                    <th>Cost per Unit</th>
                                    <th>Linkage (Cat / Acc)</th>
                                    <th>Auto-Sync</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="bills-table-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        this.refreshIcons();
    }

    async saveForecastSettings() {
        const horizon = parseInt($('#set-forecast-horizon').value);
        const inflationEnabled = $('#set-forecast-inflation-enabled').checked;
        const inflationRate = parseFloat($('#set-forecast-inflation-rate').value);

        try {
            await window.api.saveSettings({
                forecast_horizon: horizon,
                forecast_inflation_enabled: inflationEnabled.toString(),
                forecast_inflation_rate: inflationRate
            });
            await this.app.state.loadSettings();
            this.app.notifications.toast('Settings Saved', 'Forecast parameters updated', 'success');
        } catch (err) {
            this.app.notifications.alert('Error', err.message, 'error');
        }
    }

    async savePreferences() {
        const currency = $('#set-currency-base').value;
        const precision = $('#set-currency-precision').value;
        const theme = $('#set-theme').value;

        try {
            await window.api.saveSettings({
                currency_base: currency,
                currency_precision: precision,
                theme: theme
            });
            await this.app.state.loadSettings();
            this.app.notifications.toast('Settings Saved', 'App preferences updated', 'success');
        } catch (err) {
            this.app.notifications.alert('Error', err.message, 'error');
        }
    }

    showHome() {
        $$('.settings-sub-view').forEach(s => s.classList.add('hidden'));
        UIUtils.setHidden('#settings-home', false);
    }

    async showSubView(subViewId) {
        UIUtils.setHidden('#settings-home', true);
        UIUtils.setHidden(`#${subViewId}`, false);

        if (subViewId === 'categories-mgmt') await this.renderCategoryTable();
        else if (subViewId === 'accounts-mgmt') this.renderAccountsTable();
        else if (subViewId === 'ai-settings') await this.renderAISettings();
        else if (subViewId === 'recurring-charges') await this.renderRecurringCharges();
        else if (subViewId === 'bills-mgmt') await this.renderBillsTable();
        else this.populateInputs(subViewId);
    }

    async renderAISettings() {
        try {
            const settings = this.app.state.aiSettings;
            const defaults = await window.api.getAIDefaults();

            const urlInput = $('#set-ai-url');
            if (urlInput) urlInput.value = settings.url;

            const enabledCheck = $('#set-ai-enabled');
            if (enabledCheck) enabledCheck.checked = settings.enabled;

            const promptTxEl = $('#set-ai-prompt-tx');
            const promptInsightEl = $('#set-ai-prompt-insight');
            const promptChatEl = $('#set-ai-prompt-chat');

            if (promptTxEl) promptTxEl.value = settings.promptTx || defaults.promptTx;
            if (promptInsightEl) promptInsightEl.value = settings.promptInsight || defaults.promptInsight;
            if (promptChatEl) promptChatEl.value = settings.promptChat || defaults.promptChat;

            $('#reset-prompt-tx') && ($('#reset-prompt-tx').onclick = () => promptTxEl && (promptTxEl.value = defaults.promptTx));
            $('#reset-prompt-insight') && ($('#reset-prompt-insight').onclick = () => promptInsightEl && (promptInsightEl.value = defaults.promptInsight));
            $('#reset-prompt-chat') && ($('#reset-prompt-chat').onclick = () => promptChatEl && (promptChatEl.value = defaults.promptChat));

            const modelSelect = $('#set-ai-model');
            const btnRefresh = $('#btn-refresh-models');
            const statusBadge = $('#ai-status-badge');

            const updateStatusBadge = (connected) => {
                const badgeContainer = $('#ai-status-container');
                if (!badgeContainer) return;
                badgeContainer.innerHTML = StatusBadge(
                    `AI ${connected ? 'Online' : 'Offline'}`,
                    connected ? 'success' : 'warning',
                    'ai-status-badge'
                );
            };

            const refreshModels = async () => {
                const url = $('#set-ai-url')?.value.trim();
                if (!url || !modelSelect || !btnRefresh) return;

                const spinIcon = btnRefresh.querySelector('i, svg');
                if (spinIcon) spinIcon.classList.add('spinning');

                try {
                    const models = await window.api.getAIModels(url);
                    modelSelect.innerHTML = '';
                    if (models.length === 0) {
                        modelSelect.innerHTML = '<option value="" disabled selected>No models found</option>';
                        updateStatusBadge(false);
                    } else {
                        models.forEach(m => {
                            const opt = document.createElement('option');
                            opt.value = m.name;
                            opt.innerText = m.name;
                            if (m.name === settings.model) opt.selected = true;
                            modelSelect.appendChild(opt);
                        });
                        if (settings.model && !models.find(m => m.name === settings.model)) {
                            const opt = document.createElement('option');
                            opt.value = settings.model;
                            opt.innerText = `${settings.model} (Not installed)`;
                            opt.selected = true;
                            modelSelect.appendChild(opt);
                        }
                        updateStatusBadge(true);
                    }
                } catch (err) {
                    this.app.notifications.toast('Error', 'Failed to fetch models', 'error');
                    updateStatusBadge(false);
                } finally {
                    if (spinIcon) spinIcon.classList.remove('spinning');
                    this.refreshIcons();
                }
            };

            if (settings.url) refreshModels();

            if (btnRefresh) {
                const newBtnRefresh = btnRefresh.cloneNode(true);
                btnRefresh.parentNode.replaceChild(newBtnRefresh, btnRefresh);
                newBtnRefresh.onclick = refreshModels;
            }

            const btnSave = $('#btn-save-ai');
            if (btnSave) {
                const newBtn = btnSave.cloneNode(true);
                btnSave.parentNode.replaceChild(newBtn, btnSave);

                newBtn.addEventListener('click', async () => {
                    const url = $('#set-ai-url')?.value.trim();
                    const model = $('#set-ai-model')?.value;
                    const enabled = $('#set-ai-enabled')?.checked;
                    const pTx = $('#set-ai-prompt-tx')?.value;
                    const pIn = $('#set-ai-prompt-insight')?.value;
                    const pChat = $('#set-ai-prompt-chat')?.value;

                    if (!url || !model) return this.app.notifications.toast('Validation Error', 'URL and Model required', 'error');

                    newBtn.disabled = true;
                    const originalText = newBtn.innerHTML;
                    newBtn.innerHTML = '<i data-lucide="loader-2" class="spinning"></i> Testing Connection...';
                    this.refreshIcons();
                    try {
                        await window.api.saveAISettings({ url, model, enabled, promptTx: pTx, promptInsight: pIn, promptChat: pChat });
                        await this.app.state.loadSettings();

                        // Emit event to update AI status indicator and invalidate cache
                        eventBus.emit('ai:settings-changed');

                        if (enabled) {
                            const success = await window.api.checkAIConnection();
                            updateStatusBadge(success);
                            this.app.notifications.toast(success ? 'Success' : 'Connection Failed', success ? 'AI Connected!' : 'Could not connect to Ollama', success ? 'success' : 'warning');
                        } else {
                            updateStatusBadge(false);
                            this.app.notifications.toast('Saved', 'AI Settings Saved (Disabled)');
                        }
                    } catch (err) {
                        this.app.notifications.toast('Error', 'Failed to save settings', 'error');
                    } finally {
                        newBtn.disabled = false;
                        newBtn.innerHTML = originalText;
                        this.refreshIcons();
                    }
                });
            }
            this.refreshIcons();
        } catch (err) {
            console.error(err);
        }
    }

    populateInputs(subViewId) {
        const fields = {
            'forecast-settings': ['set-forecast-horizon', 'set-forecast-inflation-enabled', 'set-forecast-inflation-rate'],
            'preferences-settings': ['set-currency-base', 'set-currency-precision', 'set-theme']
        };

        const { state } = this.app;
        if (fields[subViewId]) {
            fields[subViewId].forEach(id => {
                const el = $(`#${id}`);
                if (!el) return;
                const key = id.replace('set-', '').replace(/-/g, '_');
                if (el.type === 'checkbox') {
                    el.checked = state.settings[key] === 'true';
                } else {
                    el.value = state.settings[key] || '';
                }
            });
        }

        if (subViewId === 'preferences-settings') {
            this.app.populateCurrencyDropdowns(); // Ensure currency selects are populated
        }

        if (subViewId === 'forecast-settings') {
            this.toggleInflationGroup();
            $('#set-forecast-inflation-enabled')?.addEventListener('change', () => this.toggleInflationGroup());
        }
    }

    toggleInflationGroup() {
        const isEnabled = $('#set-forecast-inflation-enabled')?.checked;
        UIUtils.setHidden('#inflation-rate-group', !isEnabled);
    }

    async renderAccountsTable() {
        const { state, formatter } = this.app;

        // Apply sorting
        const field = state.accountSortField || 'name';
        const direction = state.accountSortDirection || 'asc';
        const sorted = [...state.accounts].sort((a, b) => {
            let A = a[field];
            let B = b[field];

            if (field === 'initial_balance' || field === 'balance') {
                A = parseFloat(A) || 0;
                B = parseFloat(B) || 0;
            } else {
                A = (A || '').toString().toLowerCase();
                B = (B || '').toString().toLowerCase();
            }

            if (A === B) return 0;
            return direction === 'asc'
                ? (A < B ? -1 : 1)
                : (A > B ? -1 : 1);
        });

        // Render sortable header
        const thead = $('#accounts-table-head');
        if (thead) {
            thead.innerHTML = `
                <tr>
                    ${SortableHeader('Name', 'name', field, direction, 'app.views.settings.sortAccounts')}
                    ${SortableHeader('Type', 'type', field, direction, 'app.views.settings.sortAccounts')}
                    ${SortableHeader('Starting', 'initial_balance', field, direction, 'app.views.settings.sortAccounts')}
                    ${SortableHeader('Current Balance', 'balance', field, direction, 'app.views.settings.sortAccounts')}
                    ${SortableHeader('Status', 'status', field, direction, 'app.views.settings.sortAccounts')}
                    <th class="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-text-secondary">Actions</th>
                </tr>
            `;
        }

        UIUtils.renderList('accounts-table-body', sorted, acc => {
            const isArchived = acc.status === 'archived';

            return `
                <tr class="hover:bg-brand-primary/5 transition-colors border-b border-border last:border-0 ${isArchived ? 'opacity-60' : ''}">
                    <td class="px-5 py-4 text-sm text-text-primary"><strong>${acc.name}</strong></td>
                    <td class="px-5 py-4 text-sm text-text-secondary">${TypePill(acc.type.replace('_', ' '), acc.type)}</td>
                    <td class="px-5 py-4 text-sm text-text-secondary">${formatter.formatCurrency(acc.initial_balance || 0, acc.currency)}</td>
                    <td class="px-5 py-4 text-sm amount ${acc.type === 'credit_card' || acc.type === 'loan' ? 'expense' : 'income'} font-bold">
                        ${formatter.formatCurrency(acc.balance, acc.currency)}
                    </td>
                    <td class="px-5 py-4 text-sm">${StatusBadge(acc.status || 'Active', acc.status || 'active')}</td>
                    <td class="px-5 py-4 text-right">
                        <div class="row-actions flex justify-end gap-2">
                            <button class="action-btn p-2 hover:text-brand-primary transition-colors" onclick="app.views.settings.handleEditAccount('${acc.id}')" title="Edit">
                                <i data-lucide="edit-3" class="w-4 h-4"></i>
                            </button>
                            ${isArchived
                    ? `<button class="action-btn p-2 hover:text-success transition-colors" onclick="app.views.settings.handleUnarchiveAccount('${acc.id}')" title="Unarchive">
                                        <i data-lucide="archive-restore" class="w-4 h-4"></i>
                                   </button>`
                    : `<button class="action-btn p-2 hover:text-warning transition-colors" onclick="app.views.settings.handleArchiveAccount('${acc.id}')" title="Archive">
                                        <i data-lucide="archive" class="w-4 h-4"></i>
                                   </button>`
                }
                            <button class="action-btn p-2 hover:text-danger transition-colors" onclick="app.views.settings.handleDeleteAccount('${acc.id}')" title="Delete">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }, 'No accounts found.');

        this.refreshIcons();
    }

    sortAccounts(field) {
        const { state } = this.app;
        if (state.accountSortField === field) {
            state.accountSortDirection = state.accountSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            state.accountSortField = field;
            state.accountSortDirection = 'asc';
        }
        this.renderAccountsTable();
    }

    // --- Account Management ---

    handleNewAccount() {
        this.editingAccountId = null;
        this.showAccountModal();
    }

    handleEditAccount(id) {
        const acc = this.app.state.accounts.find(a => a.id == id);
        if (!acc) return;
        this.editingAccountId = id;
        this.showAccountModal(acc);
    }

    showAccountModal(account = null) {
        const modal = $('#account-modal');
        if (!modal) return;

        const title = modal.querySelector('h2');
        const saveBtn = $('#save-account');

        if (title) title.innerText = account ? 'Edit Account' : 'Add New Account';
        if (saveBtn) saveBtn.innerText = account ? 'Update Account' : 'Add Account';

        // Set inputs
        $('#acc-name') && ($('#acc-name').value = account ? account.name : '');
        $('#acc-type') && ($('#acc-type').value = account ? account.type : 'checking');
        $('#acc-balance') && ($('#acc-balance').value = account ? (account.initial_balance || 0) : '0');
        $('#acc-currency') && ($('#acc-currency').value = account ? account.currency : this.app.state.settings.currency_base);

        UIUtils.setHidden('#account-modal', false);

        // Save logic
        if (!saveBtn.dataset.bound) {
            saveBtn.addEventListener('click', async () => {
                const name = $('#acc-name').value.trim();
                const type = $('#acc-type').value;
                const balance = parseFloat($('#acc-balance').value) || 0;
                const currency = $('#acc-currency').value;

                if (!name) return this.app.notifications.toast('Validation Error', 'Account name required', 'error');

                try {
                    if (this.editingAccountId) {
                        await window.api.updateAccount({ id: this.editingAccountId, name, type, initial_balance: balance, currency });
                        this.app.notifications.toast('Account Updated', `${name} updated successfully`);
                    } else {
                        await window.api.addAccount({ name, type, balance, initial_balance: balance, currency });
                        this.app.notifications.toast('Account Added', `${name} created`);
                    }
                    UIUtils.setHidden('#account-modal', true);
                    await this.app.state.loadAccounts();
                    this.app.updateAccountDropdowns();
                    this.renderAccountsTable();
                } catch (err) {
                    this.app.notifications.alert('Error', err.message);
                }
            });
            saveBtn.dataset.bound = 'true';
        }
    }

    async handleDeleteAccount(id) {
        const acc = this.app.state.accounts.find(a => a.id == id);
        if (!acc) return;

        // Check for usage
        const inUse = await window.api.isAccountInUse(id);
        if (inUse) {
            return this.app.notifications.toast('Cannot Delete', 'This account has transaction history. Please archive it instead.', 'warning');
        }

        if (await this.app.notifications.confirm('Delete Account', `Are you sure you want to delete "${acc.name}"? This action cannot be undone.`)) {
            try {
                await window.api.deleteAccount(id);
                await this.app.state.loadAccounts();
                this.app.updateAccountDropdowns();
                this.renderAccountsTable();
                this.app.notifications.toast('Deleted', 'Account removed successfully');
            } catch (err) {
                this.app.notifications.alert('Error', err.message);
            }
        }
    }

    async handleArchiveAccount(id) {
        try {
            await window.api.archiveAccount(id);
            await this.app.state.loadAccounts();
            this.app.updateAccountDropdowns();
            this.renderAccountsTable();
            this.app.notifications.toast('Account Archived', 'Account will no longer appear in active lists.');
        } catch (err) {
            this.app.notifications.alert('Error', err.message);
        }
    }

    async handleUnarchiveAccount(id) {
        try {
            await window.api.unarchiveAccount(id);
            await this.app.state.loadAccounts();
            this.app.updateAccountDropdowns();
            this.renderAccountsTable();
            this.app.notifications.toast('Account Restored', 'Account is now active.');
        } catch (err) {
            this.app.notifications.alert('Error', err.message);
        }
    }

    // --- Category Management ---

    async handleNewCategory() {
        this.editingCategoryId = null;
        this.showCategoryModal();
    }

    async handleEditCategory(id) {
        const cat = this.app.state.categories.find(c => c.id == id);
        if (!cat) return;
        this.editingCategoryId = id;
        this.showCategoryModal(cat);
    }

    showCategoryModal(category = null) {
        const modal = $('#category-modal');
        if (!modal) return;

        const title = modal.querySelector('h2');
        const saveBtn = $('#save-category');
        const nameInput = $('#new-cat-name');
        const typeSelect = $('#new-cat-type');

        if (title) title.innerText = category ? 'Edit Category' : 'Create New Category';
        if (saveBtn) saveBtn.innerText = category ? 'Update Category' : 'Create Category';
        if (nameInput) nameInput.value = category ? category.name : '';
        if (typeSelect) typeSelect.value = category ? category.type : 'expense';

        UIUtils.setHidden('#category-modal', false);

        // Add event listener (once)
        if (!saveBtn.dataset.bound) {
            saveBtn.addEventListener('click', async () => {
                const name = $('#new-cat-name').value.trim();
                const type = $('#new-cat-type').value;

                if (!name) return this.app.notifications.toast('Validation Error', 'Category name is required', 'error');

                try {
                    if (this.editingCategoryId) {
                        await window.api.updateCategory(this.editingCategoryId, { name, type });
                        this.app.notifications.toast('Category Updated', `${name} updated successfully`, 'success');
                    } else {
                        await window.api.addCategory({ name, type });
                        this.app.notifications.toast('Category Created', `${name} added to your workspace`, 'success');
                    }
                    UIUtils.setHidden('#category-modal', true);
                    await this.app.state.loadCategories();
                    this.app.updateCategoryDropdowns();
                    this.renderCategoryTable();
                } catch (err) {
                    this.app.notifications.alert('Error', err.message, 'error');
                }
            });
            saveBtn.dataset.bound = 'true';
        }
    }

    async handleDeleteCategory(id) {
        const cat = this.app.state.categories.find(c => c.id == id);
        if (!cat) return;

        // Check if in use
        const inUse = await window.api.isCategoryInUse(cat.name);
        if (inUse) {
            return this.app.notifications.toast('Cannot Delete', 'This category is used in existing transactions. Please archive it instead.', 'warning');
        }

        if (await this.app.notifications.confirm('Delete Category', `Are you sure you want to delete "${cat.name}"? This action cannot be undone.`)) {
            try {
                await window.api.deleteCategory(id);
                await this.app.state.loadCategories();
                this.app.updateCategoryDropdowns();
                this.renderCategoryTable();
                this.app.notifications.toast('Deleted', 'Category removed successfully');
            } catch (err) {
                this.app.notifications.alert('Error', err.message, 'error');
            }
        }
    }

    async handleArchiveCategory(id) {
        await window.api.archiveCategory(id);
        await this.app.state.loadCategories();
        this.app.updateCategoryDropdowns();
        this.renderCategoryTable();
    }

    async handleUnarchiveCategory(id) {
        await window.api.unarchiveCategory(id);
        await this.app.state.loadCategories();
        this.app.updateCategoryDropdowns();
        this.renderCategoryTable();
    }

    filterCategoryTable(type) {
        this.app.state.categoryTableFilter = type;
        this.renderCategoryTable();
    }

    async renderCategoryTable() {
        const { state } = this.app;

        // Render Toggle Component
        const filterContainer = $('#category-filter-container');
        if (filterContainer) {
            filterContainer.innerHTML = SegmentedControl({
                id: 'category-type-toggle',
                onchange: 'app.views.settings.filterCategoryTable',
                options: [
                    { label: 'All', value: 'all', active: state.categoryTableFilter === 'all' },
                    { label: 'Income', value: 'income', active: state.categoryTableFilter === 'income' },
                    { label: 'Expense', value: 'expense', active: state.categoryTableFilter === 'expense' }
                ]
            });
        }

        // Apply sorting
        let sorted = [...state.categories];
        const field = state.categorySortField || 'name';
        const direction = state.categorySortDirection || 'asc';

        sorted.sort((a, b) => {
            let valA = a[field];
            let valB = b[field];

            valA = (valA || '').toString().toLowerCase();
            valB = (valB || '').toString().toLowerCase();

            if (valA === valB) return 0;
            return direction === 'asc' ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
        });

        // Render Table Header Component
        const thead = $('#category-table-head');
        if (thead) {
            thead.innerHTML = `
                <tr>
                    ${SortableHeader('Name', 'name', field, direction, 'app.views.settings.sortCategories')}
                    ${SortableHeader('Type', 'type', field, direction, 'app.views.settings.sortCategories')}
                    ${SortableHeader('Status', 'status', field, direction, 'app.views.settings.sortCategories')}
                    <th class="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-text-secondary">Actions</th>
                </tr>
            `;
        }

        // Apply filtering
        let filtered = state.categoryTableFilter === 'all'
            ? sorted
            : sorted.filter(c => c.type === state.categoryTableFilter);

        const start = (state.categoryTablePage - 1) * state.categoryTablePageSize;
        const pageData = filtered.slice(start, start + state.categoryTablePageSize);

        UIUtils.renderList('category-table-body', pageData, c => {
            return `
                <tr class="hover:bg-brand-primary/5 transition-colors border-b border-border last:border-0">
                    <td class="px-5 py-4 text-sm font-bold text-text-primary">
                        ${c.name}
                        ${c.is_default ? '<span class="ml-2 text-xs text-text-muted font-normal">(Default)</span>' : ''}
                    </td>
                    <td class="px-5 py-4 text-sm">${TypePill(c.type, c.type)}</td>
                    <td class="px-5 py-4 text-sm">${StatusBadge(c.status || 'active', c.status || 'active')}</td>
                    <td class="px-5 py-4 text-right">
                        <div class="row-actions flex justify-end gap-2">
                            <button class="action-btn p-2 hover:text-brand-primary transition-colors" onclick="app.views.settings.handleEditCategory('${c.id}')" title="Edit">
                                <i data-lucide="edit-3" class="w-4 h-4"></i>
                            </button>
                            ${c.status === 'archived'
                    ? `<button class="action-btn p-2 hover:text-success transition-colors" onclick="app.views.settings.handleUnarchiveCategory('${c.id}')" title="Unarchive">
                                    <i data-lucide="archive-restore" class="w-4 h-4"></i>
                               </button>`
                    : `<button class="action-btn p-2 hover:text-warning transition-colors" onclick="app.views.settings.handleArchiveCategory('${c.id}')" title="Archive">
                                    <i data-lucide="archive" class="w-4 h-4"></i>
                               </button>`
                }
                            ${!c.is_default
                    ? `<button class="action-btn p-2 hover:text-danger transition-colors" onclick="app.views.settings.handleDeleteCategory('${c.id}')" title="Delete">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                               </button>`
                    : ''
                }
                        </div>
                    </td>
                </tr>
            `;
        }, 'No categories found.');

        this.refreshIcons();
    }

    sortCategories(field) {
        const { state } = this.app;
        if (state.categorySortField === field) {
            state.categorySortDirection = state.categorySortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            state.categorySortField = field;
            state.categorySortDirection = 'asc';
        }
        this.renderCategoryTable();
    }

    // --- Bill Type Management ---

    async renderBillsTable() {
        const { state } = this.app;
        await state.loadBillTypes();

        UIUtils.renderList('bills-table-body', state.billTypes, bt => {
            return `
                <tr class="hover:bg-brand-primary/5 transition-colors border-b border-border last:border-0">
                    <td class="px-5 py-4 text-sm font-bold text-text-primary">
                        <div class="flex-row align-center gap-3">
                            <div class="icon-box sm flex-shrink-0" style="background: ${bt.color}20; color: ${bt.color}">
                                <i data-lucide="${bt.icon || 'file-text'}" class="w-4 h-4"></i>
                            </div>
                            <span>${bt.name}</span>
                        </div>
                    </td>
                    <td class="px-5 py-4 text-sm text-text-secondary">${bt.unit_name}</td>
                    <td class="px-5 py-4 text-sm font-medium">${this.formatter.formatCurrency(bt.cost_per_unit)}/${bt.unit_name}</td>
                    <td class="px-5 py-4">
                        <div class="flex-col gap-1">
                            <span class="text-xs font-bold text-text-primary">Cat: <span class="text-brand-primary">${bt.category_name || 'None'}</span></span>
                            <span class="text-xs text-text-muted">Acc: ${bt.account_name || 'System Default'}</span>
                        </div>
                    </td>
                    <td class="px-5 py-4">
                        ${bt.auto_transaction ?
                    '<span class="badge success xs"><i data-lucide="refresh-cw" class="w-3 h-3 mr-1"></i> Active</span>' :
                    '<span class="badge text-text-muted xs">Off</span>'
                }
                    </td>
                    <td class="px-5 py-4 text-right">
                        <div class="row-actions flex justify-end gap-2">
                            <button class="action-btn p-2 hover:text-brand-primary transition-colors" onclick="app.views.settings.handleEditBillType('${bt.id}')" title="Edit">
                                <i data-lucide="edit-3" class="w-4 h-4"></i>
                            </button>
                            <button class="action-btn p-2 hover:text-danger transition-colors" onclick="app.views.settings.handleDeleteBillType('${bt.id}')" title="Delete">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }, 'No bill types configured yet.');

        this.refreshIcons();
    }

    handleNewBillType() {
        this.editingBillTypeId = null;
        this.showBillTypeModal();
    }

    handleEditBillType(id) {
        const bt = this.app.state.billTypes.find(b => b.id == id);
        if (!bt) return;
        this.editingBillTypeId = id;
        this.showBillTypeModal(bt);
    }

    async handleDeleteBillType(id) {
        const bt = this.app.state.billTypes.find(b => b.id == id);
        if (!bt) return;

        if (await this.app.notifications.confirm('Delete Bill Type', `Are you sure you want to delete "${bt.name}"? All reading history for this bill will also be deleted.`)) {
            try {
                await window.api.deleteBillType(id);
                this.app.notifications.toast('Deleted', 'Bill type removed');
                this.renderBillsTable();
            } catch (err) {
                this.app.notifications.alert('Error', err.message);
            }
        }
    }

    showBillTypeModal(bt = null) {
        const modal = $('#bill-type-modal');
        if (!modal) return;

        const title = modal.querySelector('h2');
        const saveBtn = $('#save-bill-type');

        if (title) title.innerText = bt ? 'Edit Bill Type' : 'Add New Bill Type';
        if (saveBtn) saveBtn.innerText = bt ? 'Update Bill Type' : 'Save Bill Type';

        // Set inputs
        $('#bill-name') && ($('#bill-name').value = bt ? bt.name : '');
        $('#bill-unit') && ($('#bill-unit').value = bt ? bt.unit_name : '');
        $('#bill-cost') && ($('#bill-cost').value = bt ? bt.cost_per_unit : '');
        $('#bill-icon') && ($('#bill-icon').value = bt ? bt.icon : 'zap');
        $('#bill-color') && ($('#bill-color').value = bt ? bt.color : '#7c3aed');

        // Populate Categories
        const catSelect = $('#bill-category');
        if (catSelect) {
            const expenseCats = this.app.state.categories.filter(c => c.type === 'expense');
            catSelect.innerHTML = '<option value="">No linked category</option>' +
                expenseCats.map(c => `<option value="${c.name}" ${bt && bt.category_name === c.name ? 'selected' : ''}>${c.name}</option>`).join('');
        }

        // Populate Accounts
        const accSelect = $('#bill-account');
        if (accSelect) {
            const accounts = this.app.state.accounts.filter(a => a.status === 'active');
            accSelect.innerHTML = '<option value="">Use System Default</option>' +
                accounts.map(a => `<option value="${a.id}" ${bt && bt.account_id == a.id ? 'selected' : ''}>${a.name} (${this.formatter.formatCurrency(a.balance)})</option>`).join('');
        }

        // Set Toggle
        const autoTxToggle = $('#bill-auto-tx');
        if (autoTxToggle) {
            autoTxToggle.checked = bt ? !!bt.auto_transaction : false;
        }

        UIUtils.setHidden('#bill-type-modal', false);

        // Save logic
        if (!saveBtn.dataset.bound) {
            saveBtn.addEventListener('click', async () => {
                const name = $('#bill-name').value.trim();
                const unit_name = $('#bill-unit').value.trim();
                const cost_per_unit = parseFloat($('#bill-cost').value) || 0;
                const icon = $('#bill-icon').value;
                const color = $('#bill-color').value;
                const category_name = $('#bill-category').value;
                const account_id = parseInt($('#bill-account').value) || null;
                const auto_transaction = $('#bill-auto-tx').checked ? 1 : 0;

                if (!name || !unit_name) return this.app.notifications.toast('Validation Error', 'Name and Unit are required', 'error');

                try {
                    const data = { name, unit_name, cost_per_unit, icon, color, category_name, account_id, auto_transaction };
                    if (this.editingBillTypeId) {
                        await window.api.updateBillType({ id: this.editingBillTypeId, data });
                        this.app.notifications.toast('Updated', `${name} updated`);
                    } else {
                        await window.api.addBillType(data);
                        this.app.notifications.toast('Added', `${name} created`);
                    }
                    UIUtils.setHidden('#bill-type-modal', true);
                    this.renderBillsTable();
                } catch (err) {
                    this.app.notifications.alert('Error', err.message);
                }
            });
            saveBtn.dataset.bound = 'true';
        }
    }
}

window.SettingsView = SettingsView;
