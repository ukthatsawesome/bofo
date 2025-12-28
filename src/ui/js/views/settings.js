class SettingsView extends BaseView {
    constructor(app) {
        super(app, 'settings');
    }

    async onShow() {
        this.showHome();
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

            const refreshModels = async () => {
                const url = $('#set-ai-url')?.value.trim();
                if (!url || !modelSelect || !btnRefresh) return;

                btnRefresh.classList.add('spinning');
                try {
                    const models = await window.api.getAIModels(url);
                    modelSelect.innerHTML = '';
                    if (models.length === 0) {
                        modelSelect.innerHTML = '<option value="" disabled selected>No models found</option>';
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
                    }
                } catch (err) {
                    notifications.toast('Error', 'Failed to fetch models', 'error');
                } finally {
                    btnRefresh.classList.remove('spinning');
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
                    newBtn.innerText = 'Testing Connection...';
                    this.app.setLoading(true);

                    try {
                        await window.api.saveAISettings({ url, model, enabled, promptTx: pTx, promptInsight: pIn, promptChat: pChat });
                        if (enabled) {
                            const success = await window.api.checkAIConnection();
                            notifications.toast(success ? 'Success' : 'Connection Failed', success ? 'AI Connected!' : 'Could not connect to Ollama', success ? 'success' : 'warning');
                        } else {
                            notifications.toast('Saved', 'AI Settings Saved (Disabled)');
                        }
                    } catch (err) {
                        notifications.toast('Error', 'Failed to save settings', 'error');
                    } finally {
                        this.app.setLoading(false);
                        newBtn.disabled = false;
                        newBtn.innerText = 'Save & Test Connection';
                    }
                });
            }
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
        UIUtils.renderList('accounts-table-body', state.accounts, acc => `
            <tr>
                <td><strong>${acc.name}</strong></td>
                <td><span class="type-tag ${acc.type}">${acc.type.replace('_', ' ')}</span></td>
                <td class="text-muted">${formatter.formatCurrency(acc.initial_balance || 0, acc.currency)}</td>
                <td class="amount ${acc.type === 'credit_card' || acc.type === 'loan' ? 'expense' : 'income'}">
                    ${formatter.formatCurrency(acc.balance, acc.currency)}
                </td>
                <td><span class="status-badge active">Active</span></td>
                <td>
                    <div class="row-actions">
                        <button class="action-btn" onclick="app.handleEditAccount(${acc.id})" title="Edit">
                            <i data-lucide="edit-3"></i>
                        </button>
                        <button class="action-btn danger" onclick="app.handleDeleteAccount(${acc.id})" title="Delete">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `, 'No accounts found.');
    }

    async renderCategoryTable() {
        const { state } = this.app;
        let filtered = state.categoryTableFilter === 'all' ? state.categories : state.categories.filter(c => c.type === state.categoryTableFilter);
        const start = (state.categoryTablePage - 1) * state.categoryTablePageSize;
        const pageData = filtered.slice(start, start + state.categoryTablePageSize);

        const tbody = $('#category-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        for (const c of pageData) {
            const inUse = window.api.isCategoryInUse ? await window.api.isCategoryInUse(c.name) : false;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${c.name}</td>
                <td style="text-transform: capitalize">${c.type}</td>
                <td><span class="status-badge ${c.status || 'active'}">${c.status || 'active'}</span></td>
                <td>
                    <div class="row-actions">
                        ${c.status === 'archived'
                    ? `<button class="action-btn" onclick="app.handleUnarchiveCategory(${c.id})" title="Unarchive"><i data-lucide="archive-restore"></i></button>`
                    : `<button class="action-btn" onclick="app.handleArchiveCategory(${c.id})" title="Archive"><i data-lucide="archive"></i></button>`}
                        ${!c.is_default && !inUse
                    ? `<button class="action-btn danger" onclick="app.handleDeleteCategory(${c.id})" title="Delete"><i data-lucide="trash-2"></i></button>`
                    : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        }
        this.refreshIcons();
    }
}

window.SettingsView = SettingsView;
