/**
 * SettingsView - Refactored with Mixin Pattern
 * 
 * This view manages all application settings through a modular sub-view architecture.
 * Business logic for each settings section is extracted into separate mixin modules.
 */

import { BaseView } from './BaseView.js';
import { $, $$, UIUtils } from '../core/dom.js';
import { ViewHeader } from '../components/common/ViewHeader.js';
import { applySettingsMixins } from './settings/index.js';

export class SettingsView extends BaseView {
    constructor(app) {
        super(app, 'settings');

        // Apply all settings section mixins
        applySettingsMixins(this);
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
            ${ViewHeader({
            title: 'Settings',
            subtitle: 'Configure your app preferences and data'
        })}

            <!-- Settings Home -->
            <div id="settings-home" class="settings-sub-view">
                <div class="settings-grid">
                    ${this.renderSettingsCard('accounts-mgmt', 'wallet', 'primary', 'Accounts', 'Manage your bank accounts and cards')}
                    ${this.renderSettingsCard('categories-mgmt', 'tag', 'success', 'Categories', 'Organize your transaction labels')}
                    ${this.renderSettingsCard('forecast-settings', 'trending-up', 'danger', 'Forecast Engine', 'Tune your wealth projection parameters')}
                    ${this.renderSettingsCard('preferences-settings', 'settings-2', 'info', 'Preferences', 'Currency, theme, and display options')}
                    ${this.renderSettingsCard('exchange-rates', 'refresh-cw', 'success', 'Exchange Rates', 'Multi-currency conversion rates')}
                    ${this.renderSettingsCard('bills-mgmt', 'receipt', 'primary', 'Manage Bills', 'Configure bill types and cost per unit')}
                    ${this.renderSettingsCard('backup-restore', 'hard-drive-download', 'warning', 'Backup & Restore', 'Export and import your data')}
                    ${this.renderSettingsCard('remote-access', 'globe', 'info', 'Remote Access', 'Use Bofo from other devices in your network')}
                </div>
            </div>

            <!-- Accounts Sub-view -->
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
                            <thead id="accounts-table-head"><tr><th>Name</th><th>Type</th><th>Starting</th><th>Current Balance</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody id="accounts-table-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Categories Sub-view -->
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

            <!-- Forecast Settings Sub-view -->
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

            <!-- Preferences Sub-view -->
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

            <!-- Exchange Rates Sub-view -->
            <div id="exchange-rates" class="settings-sub-view hidden">
                <div class="card">
                    <div class="card-header flex-row justify-between align-center">
                        <div class="flex-row align-center gap-2">
                            <button class="btn icon" onclick="app.views.settings.showHome()"><i data-lucide="arrow-left"></i></button>
                            <h3>Exchange Rates</h3>
                        </div>
                        <button class="btn primary" onclick="app.views.settings.handleNewExchangeRate()"><i data-lucide="plus"></i> Add Rate</button>
                    </div>
                    <div class="card-body">
                        <p class="text-muted mb-6">Configure exchange rates for multi-currency support.</p>
                        
                        <!-- API Sync Section -->
                        <div class="card card-glass mb-6">
                            <div class="card-body">
                                <div class="flex-row align-center gap-3 mb-4">
                                    <div class="icon-box primary"><i data-lucide="cloud-download"></i></div>
                                    <div>
                                        <h4>Automatic Rate Sync</h4>
                                        <p class="text-muted text-sm">Fetch latest rates from open-source APIs</p>
                                    </div>
                                </div>
                                
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label>API Provider</label>
                                        <select id="currency-api-provider" class="form-control">
                                            <option value="frankfurter">Frankfurter (ECB) - MIT License</option>
                                            <option value="exchangerate-api">ExchangeRate-API (Free)</option>
                                            <option value="custom">Custom API URL</option>
                                        </select>
                                    </div>
                                    <div class="form-group" id="custom-api-url-group" style="display: none;">
                                        <label>Custom API URL</label>
                                        <input type="text" id="currency-custom-url" class="form-control" placeholder="https://api.example.com/rates?base={base}">
                                    </div>
                                </div>
                                
                                <div class="flex-row gap-3 mt-4">
                                    <button class="btn primary" onclick="app.views.settings.handleSyncExchangeRates()">
                                        <i data-lucide="refresh-cw"></i> Sync Rates Now
                                    </button>
                                    <button class="btn secondary" onclick="app.views.settings.handleTestCurrencyAPI()">
                                        <i data-lucide="check-circle"></i> Test Connection
                                    </button>
                                </div>
                                
                                <div id="exchange-rate-sync-status" class="mt-4"></div>
                            </div>
                        </div>
                        
                        <h4 class="mb-4">Current Exchange Rates</h4>
                        <p class="text-muted text-sm mb-4">Rates are relative to your base currency: <strong id="base-currency-display">USD</strong></p>
                        
                        <div class="overflow-auto">
                            <table class="data-table">
                                <thead>
                                    <tr><th>From</th><th>To</th><th>Rate</th><th>Source</th><th>Last Updated</th><th class="text-right">Actions</th></tr>
                                </thead>
                                <tbody id="exchange-rates-table-body"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Bills Management Sub-view -->
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
                                <tr><th>Name</th><th>Unit</th><th>Cost per Unit</th><th>Linkage</th><th>Auto-Sync</th><th class="text-right">Actions</th></tr>
                            </thead>
                            <tbody id="bills-table-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Backup & Restore Sub-view -->
            <div id="backup-restore" class="settings-sub-view hidden">
                <div class="card">
                    <div class="card-header flex-row align-center gap-2">
                        <button class="btn icon" onclick="app.views.settings.showHome()"><i data-lucide="arrow-left"></i></button>
                        <h3>Backup & Restore</h3>
                    </div>
                    <div class="card-body">
                        <p class="text-muted mb-6">Manage your data by exporting backups or importing from a previous backup file.</p>
                        
                        <div class="settings-grid" style="gap: 1.5rem;">
                            <!-- Export Full Backup -->
                            <div class="card card-glass">
                                <div class="card-body">
                                    <div class="flex-row align-center gap-3 mb-4">
                                        <div class="icon-box success"><i data-lucide="download"></i></div>
                                        <div>
                                            <h4>Export Full Backup</h4>
                                            <p class="text-muted text-sm">Download all your data as a JSON file</p>
                                        </div>
                                    </div>
                                    <p class="text-sm text-muted mb-4">Includes all accounts, transactions, categories, budgets, goals, and settings.</p>
                                    <button class="btn primary w-full" onclick="app.views.settings.handleExportData()">
                                        <i data-lucide="hard-drive-download"></i> Export Backup
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Export to Excel -->
                            <div class="card card-glass">
                                <div class="card-body">
                                    <div class="flex-row align-center gap-3 mb-4">
                                        <div class="icon-box info"><i data-lucide="file-spreadsheet"></i></div>
                                        <div>
                                            <h4>Export to Excel</h4>
                                            <p class="text-muted text-sm">Multi-sheet Excel workbook</p>
                                        </div>
                                    </div>
                                    <p class="text-sm text-muted mb-4">Each data type in a separate sheet. Perfect for analysis.</p>
                                    <button class="btn secondary w-full" onclick="app.views.settings.handleExportExcel()">
                                        <i data-lucide="table"></i> Export Excel (.xlsx)
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Import Backup -->
                            <div class="card card-glass" style="grid-column: 1 / -1;">
                                <div class="card-body">
                                    <div class="flex-row align-center gap-3 mb-4">
                                        <div class="icon-box warning"><i data-lucide="upload"></i></div>
                                        <div>
                                            <h4>Import Backup</h4>
                                            <p class="text-muted text-sm">Restore data from a previous backup file</p>
                                        </div>
                                    </div>
                                    <div class="p-4 rounded-lg bg-warning/10 border border-warning/20 mb-4">
                                        <p class="text-sm text-warning"><strong>⚠️ Warning:</strong> Importing will replace ALL existing data. This cannot be undone.</p>
                                    </div>
                                    <button class="btn danger w-full" onclick="app.views.settings.handleImportData()">
                                        <i data-lucide="hard-drive-upload"></i> Import Backup File
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Auto-Backup Section -->
                        <div class="mt-8 pt-6 border-t border-border">
                            <div class="flex-row align-center gap-3 mb-6">
                                <div class="icon-box primary"><i data-lucide="clock"></i></div>
                                <div>
                                    <h4>Automatic Daily Backup</h4>
                                    <p class="text-muted text-sm">Automatically save a backup when you close the app</p>
                                </div>
                            </div>
                            
                            <div class="form-grid">
                                <div class="form-group full-width">
                                    <label class="toggle-row">
                                        <span class="text-sm font-medium">Enable Daily Auto-Backup</span>
                                        <div class="toggle-switch">
                                            <input type="checkbox" id="auto-backup-enabled" onchange="app.views.settings.handleAutoBackupToggle()">
                                            <span class="toggle-slider"></span>
                                        </div>
                                    </label>
                                </div>
                                
                                <div class="form-group full-width" id="auto-backup-dir-group">
                                    <label>Backup Directory</label>
                                    <div class="flex-row gap-2">
                                        <input type="text" id="auto-backup-directory" class="form-control" readonly placeholder="Select a folder...">
                                        <button class="btn secondary" onclick="app.views.settings.handlePickBackupDirectory()">
                                            <i data-lucide="folder-open"></i> Browse
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="form-group full-width" id="auto-backup-status">
                                    <div class="flex-row justify-between align-center p-4 rounded-lg bg-surface-elevated">
                                        <div>
                                            <p class="text-sm font-medium">Last Backup</p>
                                            <p class="text-muted text-sm" id="last-backup-time">Never</p>
                                        </div>
                                        <button class="btn primary" onclick="app.views.settings.handleRunBackupNow()">
                                            <i data-lucide="save"></i> Backup Now
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Remote Access Sub-view -->
            <div id="remote-access" class="settings-sub-view hidden">
                <div class="card">
                    <div class="card-header flex-row align-center gap-2">
                        <button class="btn icon" onclick="app.views.settings.showHome()"><i data-lucide="arrow-left"></i></button>
                        <h3>Remote Access Configuration</h3>
                    </div>
                    <div class="card-body">
                        <div class="p-6 rounded-lg bg-info/10 border border-info/20 mb-6">
                            <div class="flex-row gap-4">
                                <div class="icon-box info"><i data-lucide="info"></i></div>
                                <div>
                                    <h4 class="text-info">Host Bofo on your local network</h4>
                                    <p class="text-sm opacity-80 mt-1">
                                        Enable this to access your financial data from a smartphone, tablet, or another computer.
                                        Only use this on trusted private networks (like your home Wi-Fi).
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div class="form-grid">
                            <div class="form-group full-width">
                                <label class="toggle-row">
                                    <span class="text-sm font-medium">Enable Remote Web Server</span>
                                    <div class="toggle-switch">
                                        <input type="checkbox" id="set-remote-access-enabled">
                                        <span class="toggle-slider"></span>
                                    </div>
                                </label>
                            </div>

                            <div class="form-group">
                                <label>Port</label>
                                <input type="number" id="set-remote-access-port" class="form-control" placeholder="5174">
                            </div>

                            <div class="form-group">
                                <label>Access Key (API Key)</label>
                                <div class="flex-row gap-2">
                                    <input type="text" id="set-remote-access-key" class="form-control" placeholder="Enter a secret key...">
                                    <button class="btn secondary" id="btn-remote-gen-key" title="Generate Random Key">
                                        <i data-lucide="refresh-cw"></i>
                                    </button>
                                </div>
                                <small class="text-muted">Required to authenticate from other devices</small>
                            </div>
                        </div>

                        <!-- Connection Info (Only if enabled) -->
                        <div id="remote-connection-info" class="mt-8 p-4 rounded-lg bg-surface-elevated border border-border hidden">
                            <h4 class="mb-4 flex-row align-center gap-2">
                                <i data-lucide="wifi" class="text-success"></i>
                                How to Connect
                            </h4>
                            <div class="space-y-3">
                                <div class="p-3 rounded bg-black/20 font-mono text-sm">
                                    <span class="text-muted">Address:</span> <span id="remote-host-address" class="text-primary"></span>
                                </div>
                                <div class="p-3 rounded bg-black/20 font-mono text-sm">
                                    <span class="text-muted">Status:</span> <span class="text-success">● Server Running</span>
                                </div>
                            </div>
                            <p class="text-xs text-muted mt-4">
                                Open this address in a browser on any device connected to the same Wi-Fi.
                            </p>
                        </div>

                        <div class="card-footer mt-8">
                            <button class="btn primary" onclick="app.views.settings.handleSaveRemoteSettings()">
                                <i data-lucide="save"></i> Save and Update Server
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.refreshIcons();
    }

    // Helper to render settings cards on home screen
    renderSettingsCard(id, icon, color, title, description) {
        return `
            <div class="card clickable-card" onclick="app.views.settings.showSubView('${id}')">
                <div class="card-body flex-row align-center gap-4">
                    <div class="icon-box ${color}"><i data-lucide="${icon}"></i></div>
                    <div>
                        <h3>${title}</h3>
                        <p class="text-muted">${description}</p>
                    </div>
                </div>
            </div>
        `;
    }

    // Navigation
    showHome() {
        $$('.settings-sub-view').forEach(s => s.classList.add('hidden'));
        UIUtils.setHidden('#settings-home', false);
    }

    async showSubView(subViewId) {
        UIUtils.setHidden('#settings-home', true);
        UIUtils.setHidden(`#${subViewId}`, false);

        // Load data for specific sub-views
        switch (subViewId) {
            case 'accounts-mgmt': this.renderAccountsTable(); break;
            case 'categories-mgmt': this.renderCategoryTable(); break;
            case 'bills-mgmt': this.renderBillsTable(); break;
            case 'exchange-rates': await this.renderExchangeRates(); break;
            case 'backup-restore': await this.populateAutoBackupSettings(); break;
            case 'remote-access': await this.populateRemoteSettings(); break;
            default: this.populateInputs(subViewId);
        }

        this.refreshIcons();
    }

    // Form population for simple settings views
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
            this.app.populateCurrencyDropdowns();
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

    // Save methods for simple settings
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
            this.app.notifications.toast('Saved', 'Forecast parameters updated', 'success');
        } catch (err) {
            this.app.notifications.toast('Error', err.message, 'error');
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
            this.app.notifications.toast('Saved', 'App preferences updated', 'success');
        } catch (err) {
            this.app.notifications.toast('Error', err.message, 'error');
        }
    }
}

window.SettingsView = SettingsView;
