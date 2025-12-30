import { BaseView } from './BaseView.js';
import { $, UIUtils } from '../core/dom.js';
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
                    <div class="card clickable-card" onclick="app.views.settings.showSubView('ai-settings')">
                        <div class="card-body flex-row align-center gap-4">
                            <div class="icon-box warning"><i data-lucide="sparkles"></i></div>
                            <div>
                                <h3>AI Configuration</h3>
                                <p class="text-muted">Set up Ollama and intelligence prompts</p>
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
                                <label class="toggle-container">
                                    <div class="toggle-switch">
                                        <input type="checkbox" id="set-ai-enabled">
                                        <span class="toggle-slider"></span>
                                    </div>
                                    <span class="text-sm font-medium">Enable AI Insights & Categorization</span>
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

            // Apply theme properly
            this.applyTheme(theme);

            this.app.notifications.toast('Settings Saved', 'App preferences updated', 'success');
        } catch (err) {
            this.app.notifications.alert('Error', err.message, 'error');
        }
    }

    applyTheme(theme) {
        // Store theme preference
        localStorage.setItem('bofo-theme', theme);

        // Resolve system theme
        let resolvedTheme = theme;
        if (theme === 'system') {
            resolvedTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }

        // Apply to HTML element
        document.documentElement.setAttribute('data-theme', resolvedTheme);

        // Update meta theme-color for browser
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.content = resolvedTheme === 'light' ? '#f8fafc' : '#09090b';
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
        else this.populateInputs(subViewId);
    }

    async renderAISettings() {
        try {
            const settings = await window.api.getAISettings();
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

                btnRefresh.classList.add('spinning');
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
                    notifications.toast('Error', 'Failed to fetch models', 'error');
                    updateStatusBadge(false);
                } finally {
                    btnRefresh.classList.remove('spinning');
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

                    if (!url || !model) return notifications.toast('Validation Error', 'URL and Model required', 'error');

                    newBtn.disabled = true;
                    const originalText = newBtn.innerHTML;
                    newBtn.innerHTML = '<i data-lucide="loader-2" class="spinning"></i> Testing Connection...';
                    this.refreshIcons();
                    this.app.setLoading(true);

                    try {
                        await window.api.saveAISettings({ url, model, enabled, promptTx: pTx, promptInsight: pIn, promptChat: pChat });
                        if (enabled) {
                            const success = await window.api.checkAIConnection();
                            updateStatusBadge(success);
                            notifications.toast(success ? 'Success' : 'Connection Failed', success ? 'AI Connected!' : 'Could not connect to Ollama', success ? 'success' : 'warning');
                        } else {
                            updateStatusBadge(false);
                            notifications.toast('Saved', 'AI Settings Saved (Disabled)');
                        }
                    } catch (err) {
                        notifications.toast('Error', 'Failed to save settings', 'error');
                    } finally {
                        this.app.setLoading(false);
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
                    <th class="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Status</th>
                    <th class="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Actions</th>
                </tr>
            `;
        }

        UIUtils.renderList('accounts-table-body', sorted, acc => `
            <tr>
                <td><strong>${acc.name}</strong></td>
                <td>${TypePill(acc.type.replace('_', ' '), acc.type)}</td>
                <td class="text-secondary">${formatter.formatCurrency(acc.initial_balance || 0, acc.currency)}</td>
                <td class="amount ${acc.type === 'credit_card' || acc.type === 'loan' ? 'expense' : 'income'} font-bold">
                    ${formatter.formatCurrency(acc.balance, acc.currency)}
                </td>
                <td>${StatusBadge('Active', 'active')}</td>
                <td>
                    <div class="row-actions">
                        <button class="action-btn" onclick="app.views.settings.handleEditAccount(${acc.id})" title="Edit">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button class="action-btn danger" onclick="app.views.settings.handleDeleteAccount(${acc.id})" title="Delete">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `, 'No accounts found.');

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
                        await window.api.updateAccount(this.editingAccountId, name, type, balance, currency);
                        this.app.notifications.toast('Account Updated', `${name} updated successfully`);
                    } else {
                        await window.api.addAccount(name, type, balance, currency);
                        this.app.notifications.toast('Account Added', `${name} created`);
                    }
                    UIUtils.setHidden('#account-modal', true);
                    await this.app.state.loadAccounts();
                    this.renderAccountsTable();
                } catch (err) {
                    this.app.notifications.alert('Error', err.message);
                }
            });
            saveBtn.dataset.bound = 'true';
        }
    }

    async handleDeleteAccount(id) {
        if (await this.app.notifications.confirm('Delete Account', 'Are you sure? This will delete all transactions associated with this account.')) {
            try {
                await window.api.deleteAccount(id);
                await this.app.state.loadAccounts();
                this.renderAccountsTable();
                this.app.notifications.toast('Deleted', 'Account removed');
            } catch (err) {
                this.app.notifications.alert('Error', err.message);
            }
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
                        await window.api.updateCategory(this.editingCategoryId, name, type);
                        this.app.notifications.toast('Category Updated', `${name} updated successfully`, 'success');
                    } else {
                        await window.api.addCategory(name, type);
                        this.app.notifications.toast('Category Created', `${name} added to your workspace`, 'success');
                    }
                    UIUtils.setHidden('#category-modal', true);
                    await this.app.state.loadCategories();
                    this.renderCategoryTable();
                } catch (err) {
                    this.app.notifications.alert('Error', err.message, 'error');
                }
            });
            saveBtn.dataset.bound = 'true';
        }
    }

    async handleDeleteCategory(id) {
        if (await this.app.notifications.confirm('Delete Category', 'Are you sure? This will affect transactions using this category.')) {
            try {
                await window.api.deleteCategory(id);
                await this.app.state.loadCategories();
                this.renderCategoryTable();
                this.app.notifications.toast('Deleted', 'Category removed successfully');
            } catch (err) {
                this.app.notifications.alert('Error', err.message, 'error');
            }
        }
    }

    async handleArchiveCategory(id) {
        await window.api.updateCategoryStatus(id, 'archived');
        await this.app.state.loadCategories();
        this.renderCategoryTable();
    }

    async handleUnarchiveCategory(id) {
        await window.api.updateCategoryStatus(id, 'active');
        await this.app.state.loadCategories();
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
                    <th class="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-text-muted">Action</th>
                </tr>
            `;
        }

        // Apply filtering
        let filtered = state.categoryTableFilter === 'all'
            ? sorted
            : sorted.filter(c => c.type === state.categoryTableFilter);

        const start = (state.categoryTablePage - 1) * state.categoryTablePageSize;
        const pageData = filtered.slice(start, start + state.categoryTablePageSize);

        const tbody = $('#category-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        for (const c of pageData) {
            const inUse = window.api.isCategoryInUse ? await window.api.isCategoryInUse(c.name) : false;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 600;">${c.name}</td>
                <td>${TypePill(c.type, c.type)}</td>
                <td>${StatusBadge(c.status || 'active', c.status || 'active')}</td>
                <td style="text-align: right; padding-right: 25px;">
                    <div class="row-actions" style="justify-content: flex-end;">
                        <button class="action-btn" onclick="app.views.settings.handleEditCategory(${c.id})" title="Edit"><i data-lucide="edit-3"></i></button>
                        ${c.status === 'archived'
                    ? `<button class="action-btn" onclick="app.views.settings.handleUnarchiveCategory(${c.id})" title="Unarchive"><i data-lucide="archive-restore"></i></button>`
                    : `<button class="action-btn" onclick="app.views.settings.handleArchiveCategory(${c.id})" title="Archive"><i data-lucide="archive"></i></button>`}
                        ${!c.is_default && !inUse
                    ? `<button class="action-btn danger" onclick="app.views.settings.handleDeleteCategory(${c.id})" title="Delete"><i data-lucide="trash-2"></i></button>`
                    : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        }

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


}

window.SettingsView = SettingsView;
