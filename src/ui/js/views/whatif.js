class WhatIfView extends BaseView {
    constructor(app) {
        super(app, 'whatif');
        this.sandboxTransactions = [];
        this.realityToggles = new Set(); // IDs of transactions to EXCLUDE
        this.realityOverrides = {}; // Map of txID -> newAmount
        this.isInitialized = false;
    }

    async onShow() {
        if (!this.isInitialized) {
            this.setupListeners();
            this.isInitialized = true;
        }
        this.render();
        await this.updateSimulation();
    }

    setupListeners() {
        const toggleButtons = $$('#whatif-range-toggle .toggle-btn');
        toggleButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                toggleButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateSimulation();
            });
        });

        // Rule Listeners
        $('#wi-rule-min-balance')?.addEventListener('change', () => this.updateSimulation());
        $('#wi-rule-savings-rate')?.addEventListener('change', () => this.updateSimulation());

        // Modal triggers
        $('#btn-add-sandbox')?.addEventListener('click', () => UIUtils.setHidden('#sandbox-modal', false));
        $('#close-sandbox-modal')?.addEventListener('click', () => UIUtils.setHidden('#sandbox-modal', true));
        $('#cancel-sandbox')?.addEventListener('click', () => UIUtils.setHidden('#sandbox-modal', true));

        const form = $('#sandbox-form');
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                this.addSandboxItem();
                UIUtils.setHidden('#sandbox-modal', true);
                form.reset();
            };
        }

        // Tab Logic
        $$('.wi-tab-btn').forEach(tab => {
            tab.addEventListener('click', () => {
                $$('.wi-tab-btn').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                $$('.wi-tab-content').forEach(c => c.classList.add('hidden'));
                UIUtils.setHidden(`#wi-tab-${tab.dataset.tab}`, false);
            });
        });

        // Floating Chat Toggle
        $('#toggle-bofo-chat')?.addEventListener('click', () => {
            const win = $('#bofo-chat-window');
            if (win) {
                const isHidden = win.classList.toggle('hidden');
                if (!isHidden) {
                    UIUtils.refreshIcons();
                    setTimeout(() => $('#wi-chat-input')?.focus(), 400);
                }
            }
        });

        $('#close-bofo-chat')?.addEventListener('click', () => {
            UIUtils.setHidden('#bofo-chat-window', true);
        });

        this.setupChat();
    }

    setupChat() {
        const input = $('#wi-chat-input');
        const btn = $('#wi-chat-send');
        if (!input || !btn) return;

        window.api.onChatSandboxChunk((chunk) => {
            const loadingMsg = $('.chat-msg.ai.streaming');
            if (loadingMsg) {
                if (loadingMsg.dataset.started === 'false') {
                    loadingMsg.innerHTML = '';
                    loadingMsg.dataset.started = 'true';
                }

                let p = loadingMsg.querySelector('p');
                if (!p) {
                    p = document.createElement('p');
                    loadingMsg.appendChild(p);
                }
                p.innerText += chunk;

                const container = $('#wi-chat-messages');
                if (container) container.scrollTop = container.scrollHeight;
            }
        });

        const send = async () => {
            const text = input.value.trim();
            if (!text) return;

            this.addChatMessage('user', text);
            input.value = '';

            const msgEl = this.addChatMessage('ai', '<span class="typing-dots">Bofo is typing...</span>');
            msgEl.classList.add('streaming');
            msgEl.dataset.started = 'false';

            try {
                const context = {
                    simulation: this.sandboxTransactions || [],
                    rules: {
                        minBalance: parseFloat($('#wi-rule-min-balance')?.value) || 0,
                        targetSavings: parseFloat($('#wi-rule-savings-rate')?.value) || 0
                    },
                    stats: {
                        baseBalance: $('#wi-base-balance')?.innerText || '$0',
                        scenarioBalance: $('#wi-scenario-balance')?.innerText || '$0',
                        netImpact: $('#wi-delta')?.innerText || '$0'
                    }
                };

                const response = await window.api.chatSandbox(text, context);
                msgEl.classList.remove('streaming');

                let replyText = response;
                let actionData = null;

                const jsonMatch = response.match(/```json\s*(\{[\s\S]*?\})\s*```/) || response.match(/(\{[\s\S]*\})/);
                if (jsonMatch) {
                    try {
                        actionData = JSON.parse(jsonMatch[1]);
                        replyText = response.replace(jsonMatch[0], '').trim();
                    } catch (e) { console.error("JSON Parse Error", e); }
                }

                if (replyText) {
                    msgEl.innerHTML = `<p>${replyText}</p>`;
                } else if (msgEl.dataset.started === 'false') {
                    msgEl.innerHTML = `<p>Done.</p>`;
                }

                if (actionData) await this.executeAIAction(actionData);

            } catch (err) {
                console.error(err);
                msgEl.classList.remove('streaming');
                msgEl.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
            }
        };

        btn.onclick = send;
        input.onkeydown = (e) => { if (e.key === 'Enter') send(); };
    }

    addChatMessage(role, html) {
        const container = $('#wi-chat-messages');
        if (!container) return;
        const div = document.createElement('div');
        div.className = `chat-msg ${role}`;
        div.innerHTML = role === 'user' ? `<p>${html}</p>` : html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return div;
    }

    async executeAIAction(action) {
        if (action.type === 'ADD_ITEM') {
            const newItem = {
                id: 'sb-' + Date.now(),
                description: action.item.desc || 'AI Suggestion',
                type: action.item.type || 'expense',
                amount: parseFloat(action.item.amount) || 0,
                frequency: action.item.frequency || 'monthly',
                is_active: true,
                start_date: action.item.date || new Date().toISOString().split('T')[0],
                is_sandbox: true
            };
            this.sandboxTransactions.push(newItem);
            this.renderLists();
            this.updateSimulation();

            const sandboxTab = $('.wi-tab-btn[data-tab="sandbox"]');
            if (sandboxTab) sandboxTab.click();

            notifications.toast('Scenario Updated', `Added ${newItem.description}`);
        }
        else if (action.type === 'UNDO' || action.type === 'REVERT') {
            if (this.sandboxTransactions.length > 0) {
                const removed = this.sandboxTransactions.pop();
                this.renderLists();
                this.updateSimulation();
                notifications.toast('Action Reverted', `Removed ${removed.description}`, 'info');
            }
        }
        else if (action.type === 'UPDATE_RULE') {
            if (action.rule === 'min_balance' && $('#wi-rule-min-balance')) {
                $('#wi-rule-min-balance').value = action.value;
            } else if (action.rule === 'savings_rate' && $('#wi-rule-savings-rate')) {
                $('#wi-rule-savings-rate').value = action.value;
            }
            this.updateSimulation();
            notifications.toast('Rules Updated', 'Safety rules adjusted');
        }
    }

    addSandboxItem() {
        const item = {
            id: 'sb-' + Date.now(),
            description: $('#sb-desc')?.value || 'New Item',
            type: $('#sb-type')?.value || 'expense',
            amount: parseFloat($('#sb-amount')?.value) || 0,
            frequency: $('#sb-frequency')?.value || 'once',
            start_date: $('#sb-date')?.value || new Date().toISOString().split('T')[0],
            is_sandbox: true,
            is_active: true
        };
        this.sandboxTransactions.push(item);
        this.renderLists();
        this.updateSimulation();
    }

    removeSandboxItem(id) {
        this.sandboxTransactions = this.sandboxTransactions.filter(t => t.id !== id);
        this.renderLists();
        this.updateSimulation();
    }

    async applyToBudget(id) {
        const item = this.sandboxTransactions.find(t => t.id === id);
        if (!item) return;

        if (await notifications.confirm('Convert to Real?', `Add "${item.description}" to your real budget?`)) {
            await window.api.addTransaction({
                ...item,
                id: null,
                is_sandbox: false,
                is_active: 1
            });
            this.removeSandboxItem(id);
            await this.state.loadTransactions();
            notifications.toast('Conversion Successful', `"${item.description}" added to real accounts`, 'success');
        }
    }

    async toggleRealityItem(id) {
        const idStr = String(id);
        if (this.realityToggles.has(idStr)) this.realityToggles.delete(idStr);
        else this.realityToggles.add(idStr);
        this.renderLists();
        this.updateSimulation();
    }

    updateRealityAmount(id, val) {
        this.realityOverrides[String(id)] = parseFloat(val);
        this.updateSimulation();
    }

    async updateSimulation() {
        if (!this.app) return;
        this.app.setLoading(true);

        setTimeout(async () => {
            const activeBtn = $('#whatif-range-toggle .toggle-btn.active');
            if (!activeBtn) {
                this.app.setLoading(false);
                return;
            }

            const range = parseInt(activeBtn.dataset.value);
            const { state, chartManager, formatter } = this.app;

            const realityForecast = await window.api.calculateForecast({
                transactions: state.transactions,
                accounts: state.accounts,
                months: range
            });

            const adjustedTransactions = state.transactions
                .filter(t => !this.realityToggles.has(String(t.id)))
                .map(t => {
                    const idStr = String(t.id);
                    if (this.realityOverrides[idStr] !== undefined) {
                        return { ...t, amount: this.realityOverrides[idStr] };
                    }
                    return t;
                });

            const scenarioTransactions = [...adjustedTransactions, ...this.sandboxTransactions];

            const scenarioForecast = await window.api.calculateForecast({
                transactions: scenarioTransactions,
                accounts: state.accounts,
                months: range
            });

            const realEnd = realityForecast.summary.endBalance;
            const scenEnd = scenarioForecast.summary.endBalance;
            const delta = scenEnd - realEnd;
            const scenIncome = scenarioForecast.summary.totalIncome / range;
            const scenExpense = scenarioForecast.summary.totalExpense / range;

            this.setText('wi-base-balance', formatter.formatCurrency(realEnd));
            this.setText('wi-scenario-balance', formatter.formatCurrency(scenEnd));
            this.setText('wi-scenario-income', formatter.formatCurrency(scenIncome) + '/mo');
            this.setText('wi-scenario-expense', formatter.formatCurrency(scenExpense) + '/mo');
            this.setText('wi-scenario-runway', scenarioForecast.summary.runway === Infinity ? '∞' : scenarioForecast.summary.runway + ' Mos');

            this.setText('wi-delta', (delta >= 0 ? '+' : '') + formatter.formatCurrency(delta));
            const deltaContainer = $('#wi-delta-container');
            if (deltaContainer) deltaContainer.className = `stat-card ${delta >= 0 ? 'positive' : 'negative'}`;

            const rules = {
                minBalance: parseFloat($('#wi-rule-min-balance')?.value) || 0,
                savingsRate: parseFloat($('#wi-rule-savings-rate')?.value) || 0
            };
            const healthCheck = this.validateRules(scenarioForecast, rules);
            this.setHTML('whatif-insights-list', this.generateEducationalFeedback(scenarioForecast, delta, healthCheck));

            chartManager.renderForecastChart('whatifChart', scenarioForecast.timeline);
            this.refreshIcons();
            this.app.setLoading(false);
        }, 50);
    }

    validateRules(forecast, rules) {
        const violations = [];
        const lowPoint = forecast.timeline.reduce((min, day) => day.balance < min.balance ? day : min, forecast.timeline[0]);
        if (lowPoint && lowPoint.balance < rules.minBalance) {
            violations.push({
                type: 'danger',
                title: 'Safety Net Breach',
                message: `On <b>${lowPoint.date}</b>, your balance drops below your limit.`
            });
        }

        const totalIncome = forecast.summary.totalIncome;
        const totalExpense = forecast.summary.totalExpense;
        if (totalIncome > 0) {
            const rate = ((totalIncome - totalExpense) / totalIncome) * 100;
            if (rate < rules.savingsRate) {
                violations.push({
                    type: 'warning',
                    title: 'Low Savings Rate',
                    message: `Projected savings rate is <b>${rate.toFixed(1)}%</b>.`
                });
            }
        }
        return violations;
    }

    generateEducationalFeedback(forecast, delta, healthCheck) {
        let html = '<div class="forecast-insights-list">';
        if (healthCheck && healthCheck.length > 0) {
            healthCheck.forEach(v => {
                html += `
                    <div class="forecast-insight-item ${v.type}">
                        <div class="icon"><i data-lucide="alert-triangle"></i></div>
                        <div class="insight-text">
                            <h4>${v.title}</h4>
                            <p>${v.message}</p>
                        </div>
                    </div>
                `;
            });
        }

        if (this.sandboxTransactions.length === 0 && this.realityToggles.size === 0 && Object.keys(this.realityOverrides).length === 0) {
            html += '<p class="text-muted">Start by adding a hypothetical transaction or toggling reality items.</p>';
        } else {
            if (delta > 0) {
                html += `
                    <div class="forecast-insight-item success">
                        <div class="icon"><i data-lucide="award"></i></div>
                        <div class="insight-text">
                            <h4>Wealth Booster</h4>
                            <p>Increases future wealth by ${this.app.formatter.formatCurrency(delta)}.</p>
                        </div>
                    </div>
                `;
            } else if (delta < 0) {
                html += `
                    <div class="forecast-insight-item info">
                        <div class="icon"><i data-lucide="info"></i></div>
                        <div class="insight-text">
                            <h4>Cost Analysis</h4>
                            <p>Costs ${this.app.formatter.formatCurrency(Math.abs(delta))}. ${healthCheck.length === 0 ? 'Healthy path.' : ''}</p>
                        </div>
                    </div>
                `;
            }
        }

        html += '</div>';
        return html;
    }

    render() { this.renderLists(); }

    renderLists() {
        const { state, formatter } = this.app;
        const sbList = $('#sandbox-list');
        if (sbList) {
            sbList.innerHTML = this.sandboxTransactions.length > 0
                ? this.sandboxTransactions.map(t => `
                    <div class="wi-item-card">
                        <div class="wi-item-info">
                            <h4>${t.description}</h4>
                            <p>${t.frequency} • ${t.start_date}</p>
                        </div>
                        <div class="wi-item-amount ${t.type}">
                            ${t.type === 'income' ? '+' : '-'}${formatter.formatCurrency(t.amount)}
                        </div>
                        <div class="wi-item-actions">
                            <button class="action-btn success" onclick="app.views.whatif.applyToBudget('${t.id}')">
                                <i data-lucide="check-circle-2"></i>
                            </button>
                            <button class="action-btn danger" onclick="app.views.whatif.removeSandboxItem('${t.id}')">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </div>
                `).join('')
                : '<p class="text-muted text-center py-4">No hypothetical items yet.</p>';
        }

        const realityList = $('#reality-toggle-list');
        if (realityList) {
            realityList.innerHTML = state.transactions.length > 0
                ? state.transactions.map(t => {
                    const idStr = String(t.id);
                    const currentAmt = this.realityOverrides[idStr] !== undefined ? this.realityOverrides[idStr] : t.amount;
                    return `
                    <div class="wi-item-card ${this.realityToggles.has(idStr) ? 'muted' : ''}">
                        <input type="checkbox" ${!this.realityToggles.has(idStr) ? 'checked' : ''} 
                            onchange="app.views.whatif.toggleRealityItem(${t.id})">
                        <div class="wi-item-info">
                            <h4>${t.description || t.category}</h4>
                            <p>${t.type} • ${t.frequency}</p>
                        </div>
                        <div class="wi-item-edit">
                            <input type="number" step="0.01" value="${currentAmt}" 
                                onchange="app.views.whatif.updateRealityAmount(${t.id}, this.value)"
                                class="wi-amount-input ${t.type}">
                        </div>
                    </div>
                `}).join('')
                : '<p class="text-muted text-center py-4">No real transactions found.</p>';
        }
        this.refreshIcons();
    }
}

window.WhatIfView = WhatIfView;
