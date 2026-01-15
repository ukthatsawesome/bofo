import { BaseView } from './BaseView';
import { $, $$, UIUtils } from '../core/dom';
import { ViewHeader } from '../components/common/ViewHeader';
import {
    applySettingsMixins,
    AccountsSettingsMixin,
    CategoriesSettingsMixin,
    BillsSettingsMixin,
    ExchangeRatesSettingsMixin,
    BackupSettingsMixin,
    RemoteSettingsMixin
} from './settings/index';
import type { App } from '../core/app';

// Define the shape of the mixins for TypeScript to know about them
type AccountsSettingsType = typeof AccountsSettingsMixin;
type CategoriesSettingsType = typeof CategoriesSettingsMixin;
type BillsSettingsType = typeof BillsSettingsMixin;
type ExchangeRatesSettingsType = typeof ExchangeRatesSettingsMixin;
type BackupSettingsType = typeof BackupSettingsMixin;
type RemoteSettingsType = typeof RemoteSettingsMixin;

// Since the mixins are objects with methods, we can't just 'implements' them directly if they are values.
// However, we copied methods onto the instance.
// We can use declaration merging or just declare the properties.

export interface SettingsView extends BaseView,
    AccountsSettingsType,
    CategoriesSettingsType,
    BillsSettingsType,
    ExchangeRatesSettingsType,
    BackupSettingsType,
    RemoteSettingsType { }

export class SettingsView extends BaseView {
    constructor(app: App) {
        super(app, 'settings');
        // Apply all settings section mixins
        applySettingsMixins(this);
    }

    async onShow(): Promise<void> {
        if (!this.isInitialized) {
            this.renderBaseTemplate();

            // Set up navigation handling
            this.setupNavigation();

            this.isInitialized = true;
        }

        // Default to first tab (Accounts) if no hash or specific sub-view logic
        this.showSubView('accounts');
    }

    renderBaseTemplate(): void {
        if (!this.element) return;
        this.element.innerHTML = `
            ${ViewHeader({
            title: 'Settings',
            subtitle: 'Manage accounts, categories, and preferences'
        })}

            <div class="settings-layout">
                <div class="settings-sidebar">
                    <nav class="settings-nav">
                        <button class="settings-nav-item active" data-target="accounts">
                            <i data-lucide="wallet"></i> Accounts
                        </button>
                        <button class="settings-nav-item" data-target="categories">
                            <i data-lucide="tags"></i> Categories
                        </button>
                        <button class="settings-nav-item" data-target="forecast">
                            <i data-lucide="trending-up"></i> Forecast
                        </button>
                        <button class="settings-nav-item" data-target="preferences">
                            <i data-lucide="settings-2"></i> Preferences
                        </button>
                        <button class="settings-nav-item" data-target="currencies">
                            <i data-lucide="coins"></i> Exchange Rates
                        </button>
                        <button class="settings-nav-item" data-target="bills">
                            <i data-lucide="receipt"></i> Bill Types
                        </button>
                        <button class="settings-nav-item" data-target="backup">
                            <i data-lucide="database"></i> Backup & Data
                        </button>
                        <button class="settings-nav-item" data-target="remote">
                            <i data-lucide="wifi"></i> Remote Access
                        </button>
                    </nav>

                    <div class="version-info mt-auto p-4 text-center text-xs text-muted">
                        <p>Bofo Finance v${typeof window.api.version === 'string' ? window.api.version : '1.0.0'}</p>
                        <p class="mt-1 opacity-50">Local-first & Encrypted</p>
                    </div>
                </div>

                <div class="settings-content">
                    <!-- Accounts Section -->
                    <div id="settings-section-accounts" class="settings-section active">
                        <div class="section-header">
                            <h3>My Accounts</h3>
                            <button class="btn primary sm" onclick="app.views.settings.handleNewAccount()">
                                <i data-lucide="plus"></i> New Account
                            </button>
                        </div>
                        <div class="card">
                            <div class="card-body no-padding">
                                <table class="data-table">
                                    <thead id="accounts-table-head"></thead>
                                    <tbody id="accounts-table-body"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Categories Section -->
                    <div id="settings-section-categories" class="settings-section">
                        <div class="section-header">
                            <h3>Categories</h3>
                            <div class="flex-row gap-2">
                                <div id="category-filter-container"></div>
                                <button class="btn primary sm" onclick="app.views.settings.handleNewCategory()">
                                    <i data-lucide="plus"></i> New Category
                                </button>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-body no-padding">
                                <table class="data-table">
                                    <thead id="category-table-head"></thead>
                                    <tbody id="category-table-body"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Forecast Settings -->
                    <div id="settings-section-forecast" class="settings-section">
                        <div class="section-header">
                            <h3>Forecast Configuration</h3>
                        </div>
                        <div class="card">
                            <div class="card-body">
                                <p class="text-muted mb-4">Settings for projection algorithms and analysis.</p>
                                <div class="form-group">
                                    <label>Default Projection Range (Months)</label>
                                    <select id="forecast-range-default" class="form-control" onchange="app.views.settings.saveForecastSettings()">
                                        <option value="6">6 Months</option>
                                        <option value="12">12 Months (1 Year)</option>
                                        <option value="24">24 Months (2 Years)</option>
                                        <option value="60">60 Months (5 Years)</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="toggle-row">
                                        <span class="text-sm font-medium">Include Recurring Charges in Baseline</span>
                                        <div class="toggle-switch">
                                            <input type="checkbox" id="forecast-include-recurring" onchange="app.views.settings.saveForecastSettings()" checked>
                                            <span class="toggle-slider"></span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Preferences Section -->
                    <div id="settings-section-preferences" class="settings-section">
                        <div class="section-header">
                            <h3>App Preferences</h3>
                        </div>
                        <div class="card">
                            <div class="card-body">
                                <div class="form-group">
                                    <label>Theme</label>
                                    <select id="pref-theme" class="form-control" onchange="app.toggleTheme(this.value)">
                                        <option value="system">System Default</option>
                                        <option value="light">Light</option>
                                        <option value="dark">Dark</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Base Currency</label>
                                    <select id="pref-currency" class="form-control" disabled>
                                        <option value="USD">USD ($)</option>
                                    </select>
                                    <small class="text-muted">Changing base currency is not yet supported.</small>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Exchange Rates Section -->
                    <div id="settings-section-currencies" class="settings-section">
                         <div class="section-header">
                            <h3>Exchange Rates</h3>
                            <div class="flex-row gap-2">
                                <button class="btn secondary sm" onclick="app.views.settings.handleTestCurrencyAPI()">
                                    <i data-lucide="activity"></i> Test API
                                </button>
                                <button class="btn primary sm" onclick="app.views.settings.handleSyncExchangeRates()">
                                    <i data-lucide="refresh-cw"></i> Sync Rates Now
                                </button>
                            </div>
                        </div>
                        
                        <div class="card mb-6">
                            <div class="card-body">
                                <div class="flex-row justify-between align-center mb-4">
                                    <div>
                                        <strong>Base Currency:</strong> <span id="base-currency-display">USD</span>
                                    </div>
                                    <div id="exchange-rate-sync-status"></div>
                                </div>
                                
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label>Rate Provider</label>
                                        <select id="currency-api-provider" class="form-control">
                                            <option value="frankfurter">Frankfurter.app (Open Source)</option>
                                            <option value="exchangerate-api">ExchangeRate-API</option>
                                            <option value="custom">Custom Endpoint</option>
                                        </select>
                                    </div>
                                    <div class="form-group" id="custom-api-url-group" style="display:none;">
                                        <label>Custom API URL</label>
                                        <input type="text" id="currency-custom-url" class="form-control" placeholder="https://api.example.com/latest">
                                    </div>
                                </div>
                                
                                <div class="form-group mt-4">
                                    <label class="toggle-row">
                                        <span class="text-sm font-medium">Sync rates on app startup (when stale)</span>
                                        <div class="toggle-switch">
                                            <input type="checkbox" id="exchange-rate-auto-sync" onchange="app.views.settings.handleAutoSyncToggle()">
                                            <span class="toggle-slider"></span>
                                        </div>
                                    </label>
                                    <small class="text-muted">Automatically fetch latest rates when app opens (if >24 hours old)</small>
                                </div>
                            </div>
                        </div>
                        
                        <div class="card">
                            <div class="card-header flex-row justify-between align-center">
                                <h3>Active Rates</h3>
                                <button class="btn secondary sm" onclick="app.views.settings.handleNewExchangeRate()">
                                    <i data-lucide="plus"></i> Add Manual Rate
                                </button>
                            </div>
                            <div class="card-body no-padding">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>From</th>
                                            <th>To</th>
                                            <th>Rate</th>
                                            <th>Source</th>
                                            <th>Updated</th>
                                            <th class="text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="exchange-rates-table-body"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Bill Types Section -->
                    <div id="settings-section-bills" class="settings-section">
                        <div class="section-header">
                            <h3>Bill Types</h3>
                            <button class="btn primary sm" onclick="app.views.settings.handleNewBillType()">
                                <i data-lucide="plus"></i> New Bill Type
                            </button>
                        </div>
                        <div class="card">
                            <div class="card-body no-padding">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Unit</th>
                                            <th>Cost/Unit</th>
                                            <th>Category / Account</th>
                                            <th>Auto-Tx</th>
                                            <th class="text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="bills-table-body"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Backup Section -->
                    <div id="settings-section-backup" class="settings-section">
                        <div class="section-header">
                            <h3>Backup & Data</h3>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-6">
                            <!-- Export/Import -->
                             <div class="card">
                                <div class="card-header">
                                    <h3>Data Management</h3>
                                </div>
                                <div class="card-body flex-col gap-4">
                                    <button class="btn secondary w-full justify-start" onclick="app.views.settings.handleExportData()">
                                        <i data-lucide="download"></i> Export Full Backup (.json)
                                    </button>
                                    <button class="btn secondary w-full justify-start" onclick="app.views.settings.handleImportData()">
                                        <i data-lucide="upload"></i> Import Backup (.json)
                                    </button>
                                    <hr>
                                    <button class="btn secondary w-full justify-start" onclick="app.views.settings.handleExportCSV()">
                                        <i data-lucide="file-text"></i> Export Transactions (CSV)
                                    </button>
                                    <button class="btn secondary w-full justify-start" onclick="app.views.settings.handleExportExcel()">
                                        <i data-lucide="sheet"></i> Export to Excel (.xlsx)
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Auto Backup -->
                            <div class="card">
                                <div class="card-header">
                                    <h3>Auto-Backup</h3>
                                </div>
                                <div class="card-body">
                                    <div class="form-group full-width">
                                        <label class="toggle-row">
                                            <span class="text-sm font-medium">Enable Automatic Backups</span>
                                            <div class="toggle-switch">
                                                <input type="checkbox" id="auto-backup-enabled" onchange="app.views.settings.handleAutoBackupToggle()">
                                                <span class="toggle-slider"></span>
                                            </div>
                                        </label>
                                    </div>
                                    
                                    <div id="auto-backup-dir-group" style="display: none;">
                                        <div class="form-group">
                                            <label>Backup Location</label>
                                            <div class="flex-row gap-2">
                                                <input type="text" id="auto-backup-directory" class="form-control" readonly>
                                                <button class="btn secondary" onclick="app.views.settings.handlePickBackupDirectory()">
                                                    <i data-lucide="folder-open"></i>
                                                </button>
                                            </div>
                                            <small class="text-muted">Backups are created daily on app start</small>
                                        </div>
                                    </div>
                                    
                                    <div id="auto-backup-status" class="mt-4 p-4 rounded bg-surface-elevated" style="display: none;">
                                        <div class="flex-row justify-between align-center">
                                            <span class="text-sm text-muted">Last Backup:</span>
                                            <span class="font-bold text-sm" id="last-backup-time">Checking...</span>
                                        </div>
                                        <button class="btn link sm mt-2" onclick="app.views.settings.handleRunBackupNow()">
                                            Run Backup Now
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Remote Access Section -->
                    <div id="settings-section-remote" class="settings-section">
                        <div class="section-header">
                            <h3>Remote Access (Mobile/LAN)</h3>
                        </div>
                        <div class="card">
                            <div class="card-body">
                                <div class="alert info mb-6">
                                    <i data-lucide="info"></i>
                                    <div>
                                        <strong>Beta Feature</strong>
                                        <p class="text-sm mt-1">Allows you to access your dashboard from other devices on your local network.</p>
                                    </div>
                                </div>

                                <div class="form-group full-width">
                                    <label class="toggle-row">
                                        <span class="text-sm font-medium">Enable Remote Access Server</span>
                                        <div class="toggle-switch">
                                            <input type="checkbox" id="set-remote-access-enabled">
                                            <span class="toggle-slider"></span>
                                        </div>
                                    </label>
                                </div>
                                
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="form-group">
                                        <label>Port</label>
                                        <input type="text" id="set-remote-access-port" class="form-control" value="5174">
                                    </div>
                                    <div class="form-group">
                                        <label>Access Key (Password)</label>
                                        <div class="flex-row gap-2">
                                            <input type="text" id="set-remote-access-key" class="form-control" placeholder="Required for access">
                                            <button class="btn secondary" id="btn-remote-gen-key" title="Generate Random Key">
                                                <i data-lucide="key"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                
                                <div id="remote-connection-info" class="mt-4 p-4 rounded-lg bg-success/10 border border-success/20 hidden">
                                    <h4 class="text-success mb-2 flex-row align-center gap-2">
                                        <i data-lucide="wifi"></i> Server Running
                                    </h4>
                                    <p class="text-sm mb-2">Access from other devices at:</p>
                                    <code class="block p-2 bg-white/50 rounded text-lg font-mono select-all" id="remote-host-address">
                                        http://192.168.1.x:5174
                                    </code>
                                </div>
                                
                                <div class="mt-6 flex-row justify-end">
                                    <button class="btn primary" onclick="app.views.settings.handleSaveRemoteSettings()">
                                        <i data-lucide="save"></i> Save & Restart Server
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.refreshIcons();
        this.populatePreferences();
    }

    setupNavigation(): void {
        const navItems = $$('.settings-nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const target = item.dataset.target;
                if (target) this.showSubView(target);
            });
        });
    }

    async showSubView(targetId: string): Promise<void> {
        // Update nav state
        $$('.settings-nav-item').forEach(el => el.classList.remove('active'));
        $(`.settings-nav-item[data-target="${targetId}"]`)?.classList.add('active');

        // Show section
        $$('.settings-section').forEach(el => el.classList.remove('active'));
        $(`#settings-section-${targetId}`)?.classList.add('active');

        // Load specific data if needed
        switch (targetId) {
            case 'accounts':
                this.renderAccountsTable();
                break;
            case 'categories':
                this.renderCategoryTable();
                break;
            case 'currencies':
                await this.renderExchangeRates();
                break;
            case 'bills':
                this.renderBillsTable();
                break;
            case 'backup':
                await this.populateAutoBackupSettings();
                break;
            case 'remote':
                await this.populateRemoteSettings();
                break;
        }

        this.refreshIcons();
    }

    populatePreferences(): void {
        const { state } = this.app;
        if (!state.settings) return;

        // Theme
        const themeSelect = $('#pref-theme') as HTMLSelectElement;
        if (themeSelect) themeSelect.value = state.settings.theme || 'system';

        // Forecast settings
        const forecastRange = $('#forecast-range-default') as HTMLSelectElement;
        if (forecastRange) forecastRange.value = state.settings.forecast_range_default || '12';

        const forecastRecur = $('#forecast-include-recurring') as HTMLInputElement;
        if (forecastRecur) forecastRecur.checked = state.settings.forecast_include_recurring !== '0';
    }

    async saveForecastSettings(): Promise<void> {
        const range = ($('#forecast-range-default') as HTMLSelectElement)?.value;
        const recur = ($('#forecast-include-recurring') as HTMLInputElement)?.checked;

        await window.api.updateSetting({ key: 'forecast_range_default', value: range });
        await window.api.updateSetting({ key: 'forecast_include_recurring', value: recur ? '1' : '0' });

        this.app.notifications.toast('Saved', 'Forecast settings updated', 'success');
    }
}
