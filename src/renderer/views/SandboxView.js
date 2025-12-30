import { BaseView } from './BaseView.js';
import { $, UIUtils } from '../core/dom.js';
import { StatCard } from '../components/common/StatCard.js';
import { FeedbackItem } from '../components/common/FeedbackItem.js';
import { ProgressBar } from '../components/common/ProgressBar.js';
import { Card } from '../components/common/Card.js';
import { InsightCard } from '../components/common/InsightCard.js';
import { SegmentedControl } from '../components/common/SegmentedControl.js';

export class SandboxView extends BaseView {
    constructor(app) {
        super(app, 'whatif');
        this.sandboxTransactions = [];
        this.realityToggles = new Set(); // IDs of transactions to EXCLUDE
        this.realityOverrides = {}; // Map of txID -> newAmount
        this.isInitialized = false;
        this.range = 6;
    }

    async onShow() {
        if (!this.isInitialized) {
            this.renderBaseTemplate();
            this.setupListeners();
            this.isInitialized = true;
        }
        this.render();
        await this.updateSimulation();
    }

    renderBaseTemplate() {
        this.element.innerHTML = `
            <div class="view-header">
                <div class="header-main">
                    <h1>What-If Sandbox</h1>
                    <p class="text-muted">Simulate financial decisions without affecting your real data</p>
                </div>
                <div class="header-actions">
                    <div id="whatif-range-container"></div>
                </div>
            </div>

            <div id="sandbox-stats-container" class="stats-grid mb-6"></div>

            <div class="sandbox-grid">
                <div class="sandbox-main-col">
                    <div id="whatif-insight-container" class="mb-6"></div>

                    <div class="card wi-main-card">
                        <div class="card-header">
                            <h3><i data-lucide="line-chart"></i> Projected Scenario</h3>
                        </div>
                        <div class="card-body">
                            <div class="chart-container sandbox-chart">
                                <canvas id="whatifChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="sandbox-side-col">
                    <div class="card mb-6">
                        <div class="card-header">
                            <h3><i data-lucide="shield-check"></i> Safety Rules</h3>
                        </div>
                        <div class="card-body">
                            <div class="safety-rules-grid">
                                <div class="form-group">
                                    <label>Min Balance</label>
                                    <input type="number" id="wi-rule-min-balance" class="form-control" value="1000">
                                </div>
                                <div class="form-group">
                                    <label>Savings Rate %</label>
                                    <input type="number" id="wi-rule-savings-rate" class="form-control" value="20">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card wi-side-card">
                        <div class="card-header flex-row justify-between align-center">
                            <h3 class="mb-0">Hypothesis</h3>
                            <button class="btn primary sm" id="btn-add-sandbox">
                                <i data-lucide="plus"></i>
                            </button>
                        </div>
                        <div class="card-body">
                            <div id="whatif-tabs-container" class="mb-4"></div>
                            <div id="wi-tab-sandbox" class="wi-tab-content">
                                <div id="sandbox-list" class="wi-list"></div>
                            </div>
                            <div id="wi-tab-reality" class="wi-tab-content hidden">
                                <div id="reality-toggle-list" class="wi-list"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Floating Bofo Chat Toggle -->
            <button id="toggle-bofo-chat" class="chat-fab" title="Ask Bofo">
                <i data-lucide="sparkles"></i>
            </button>

            <!-- Bofo Chat Window -->
            <div id="bofo-chat-window" class="chat-window hidden">
                <div class="chat-header">
                    <div class="flex-row align-center gap-2">
                        <div class="ai-avatar"><i data-lucide="sparkles"></i></div>
                        <div>
                            <h4>Bofo AI</h4>
                            <p class="text-muted">Scenario Assistant</p>
                        </div>
                    </div>
                    <button id="close-bofo-chat" class="btn icon sm"><i data-lucide="x"></i></button>
                </div>
                <div id="wi-chat-messages" class="chat-messages">
                    <div class="chat-msg ai">
                        <p>Hi! I'm Bofo. Ask me to "Add a $500 monthly car payment" or "What if I saved $200 more?"</p>
                    </div>
                </div>
                <div class="chat-input-area">
                    <input type="text" id="wi-chat-input" placeholder="Type a scenario...">
                    <button id="wi-chat-send" class="btn primary icon"><i data-lucide="send"></i></button>
                </div>
            </div>
        `;
        this.refreshIcons();
    }

    handleRangeChange(val) {
        this.range = parseInt(val);
        this.updateSimulation();
    }

    handleTabChange(tab) {
        this.activeTab = tab;
        this.render(); // Re-render to update segmented control active state and visibility
    }

    setupListeners() {
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

            this.app.notifications.toast('Scenario Updated', `Added ${newItem.description}`);
        }
        else if (action.type === 'UNDO' || action.type === 'REVERT') {
            if (this.sandboxTransactions.length > 0) {
                const removed = this.sandboxTransactions.pop();
                this.renderLists();
                this.updateSimulation();
                this.app.notifications.toast('Action Reverted', `Removed ${removed.description}`, 'info');
            }
        }
        else if (action.type === 'UPDATE_RULE') {
            if (action.rule === 'min_balance' && $('#wi-rule-min-balance')) {
                $('#wi-rule-min-balance').value = action.value;
            } else if (action.rule === 'savings_rate' && $('#wi-rule-savings-rate')) {
                $('#wi-rule-savings-rate').value = action.value;
            }
            this.updateSimulation();
            this.app.notifications.toast('Rules Updated', 'Safety rules adjusted');
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

        if (await this.app.notifications.confirm('Convert to Real?', `Add "${item.description}" to your real budget?`)) {
            await window.api.addTransaction({
                ...item,
                id: null,
                is_sandbox: false,
                is_active: 1
            });
            this.removeSandboxItem(id);
            await this.app.state.loadTransactions();
            this.app.notifications.toast('Conversion Successful', `"${item.description}" added to real accounts`, 'success');
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
            try {
                const range = this.range || 6;
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

                // Safe access with defaults
                const realSummary = realityForecast?.summary || {};
                const scenSummary = scenarioForecast?.summary || {};

                const realEnd = realSummary.endBalance || 0;
                const scenEnd = scenSummary.endBalance || 0;
                const delta = scenEnd - realEnd;
                const scenIncome = (scenSummary.totalIncome || 0) / range;
                const scenExpense = (scenSummary.totalExpense || 0) / range;
                const scenRunway = scenSummary.runway ?? 0;

                const container = $('#sandbox-stats-container');
                if (container) {
                    container.innerHTML = `
                        ${StatCard({
                        label: 'Real Balance',
                        value: formatter.formatCurrency(realEnd),
                        icon: 'landmark'
                    })}
                        ${StatCard({
                        label: 'Net Impact',
                        value: (delta >= 0 ? '+' : '') + formatter.formatCurrency(delta),
                        icon: delta >= 0 ? 'trending-up' : 'trending-down',
                        type: delta >= 0 ? 'income' : 'expense'
                    })}
                        ${StatCard({
                        label: 'Scenario Balance',
                        value: formatter.formatCurrency(scenEnd),
                        icon: 'gem'
                    })}
                        ${StatCard({
                        label: 'Scenario Income',
                        value: formatter.formatCurrency(scenIncome) + '/mo',
                        icon: 'wallet'
                    })}
                        ${StatCard({
                        label: 'Scenario Expenses',
                        value: formatter.formatCurrency(scenExpense) + '/mo',
                        icon: 'trending-down'
                    })}
                        ${StatCard({
                        label: 'Scenario Runway',
                        value: scenRunway === Infinity ? '∞' : (scenRunway || 0).toFixed(1) + ' Mos',
                        icon: 'clock'
                    })}
                    `;
                }

                const rules = {
                    minBalance: parseFloat($('#wi-rule-min-balance')?.value) || 0,
                    savingsRate: parseFloat($('#wi-rule-savings-rate')?.value) || 0
                };
                const healthCheck = this.validateRules(scenarioForecast || { timeline: [], summary: {} }, rules);

                const insightContainer = $('#whatif-insight-container');
                if (insightContainer) {
                    insightContainer.innerHTML = InsightCard({
                        title: 'Decision Impact Analysis',
                        message: this.generateEducationalFeedback(scenarioForecast || { summary: {} }, delta, healthCheck),
                        icon: 'brain'
                    });
                }

                const timeline = scenarioForecast?.timeline || [];
                if (timeline.length > 0) {
                    chartManager.renderForecastChart('whatifChart', timeline);
                }
                this.refreshIcons();
            } catch (error) {
                console.error('Simulation update failed:', error);
            } finally {
                this.app.setLoading(false);
            }
        }, 50);
    }

    validateRules(forecast, rules) {
        const violations = [];
        const timeline = forecast?.timeline || [];
        const summary = forecast?.summary || {};

        if (timeline.length > 0) {
            const lowPoint = timeline.reduce((min, day) => day.balance < min.balance ? day : min, timeline[0]);
            if (lowPoint && lowPoint.balance < rules.minBalance) {
                violations.push({
                    type: 'danger',
                    title: 'Safety Net Breach',
                    message: `On <b>${lowPoint.date}</b>, your balance drops below your limit.`
                });
            }
        }

        const totalIncome = summary.totalIncome || 0;
        const totalExpense = summary.totalExpense || 0;
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
        let items = [];
        if (healthCheck && healthCheck.length > 0) {
            healthCheck.forEach(v => {
                items.push(FeedbackItem({
                    type: v.type,
                    icon: 'alert-triangle',
                    title: v.title,
                    message: v.message
                }));
            });
        }

        if (this.sandboxTransactions.length === 0 && this.realityToggles.size === 0 && Object.keys(this.realityOverrides).length === 0) {
            items.push('<p class="text-muted">Start by adding a hypothetical transaction or toggling reality items.</p>');
        } else {
            if (delta > 0) {
                items.push(FeedbackItem({
                    type: 'success',
                    icon: 'award',
                    title: 'Wealth Booster',
                    message: `Increases future wealth by ${this.app.formatter.formatCurrency(delta)}.`
                }));
            } else if (delta < 0) {
                items.push(FeedbackItem({
                    type: 'info',
                    icon: 'info',
                    title: 'Financial Impact',
                    message: `Decreases future wealth by ${this.app.formatter.formatCurrency(Math.abs(delta))}.`
                }));
            }
        }

        return `<div class="forecast-insights-list">${items.join('')}</div>`;
    }

    render() {
        const rangeContainer = $('#whatif-range-container');
        if (rangeContainer) {
            rangeContainer.innerHTML = SegmentedControl({
                id: 'sandbox-range-toggle',
                onchange: 'app.views.whatif.handleRangeChange',
                options: [
                    { label: '3M', value: '3', active: this.rangeMonths === 3 },
                    { label: '6M', value: '6', active: this.rangeMonths === 6 },
                    { label: '12M', value: '12', active: this.rangeMonths === 12 },
                    { label: '24M', value: '24', active: this.rangeMonths === 24 }
                ]
            });
        }

        const tabsContainer = $('#whatif-tabs-container');
        if (tabsContainer) {
            tabsContainer.innerHTML = SegmentedControl({
                id: 'whatif-tabs-toggle',
                onchange: 'app.views.whatif.handleTabChange',
                options: [
                    { label: 'Hypotheticals', value: 'sandbox', active: this.activeTab === 'sandbox' || !this.activeTab },
                    { label: 'Reality', value: 'reality', active: this.activeTab === 'reality' }
                ]
            });
        }

        UIUtils.setHidden('#wi-tab-sandbox', this.activeTab === 'reality');
        UIUtils.setHidden('#wi-tab-reality', this.activeTab !== 'reality');

        this.renderLists();
    }

    renderLists() {
        const { state, formatter } = this.app;
        const sbList = $('#sandbox-list');
        if (sbList) {
            sbList.innerHTML = this.sandboxTransactions.length > 0
                ? this.sandboxTransactions.map(t => {
                    const freqIcon = t.frequency === 'monthly' ? 'calendar-days' : (t.frequency === 'weekly' ? 'calendar-range' : 'calendar');
                    const totalImpact = t.frequency === 'one-time' ? t.amount : (t.frequency === 'monthly' ? t.amount * this.range : (t.frequency === 'weekly' ? t.amount * (this.range * 4) : t.amount));

                    return `
                    <div class="wi-item-card ${t.type}">
                        <div class="wi-item-info">
                            <h4>${t.description}</h4>
                            <p>
                                <i data-lucide="${freqIcon}" class="w-3 h-3"></i> ${t.frequency} 
                                <span class="mx-1">•</span> 
                                <i data-lucide="clock" class="w-3 h-3"></i> ${t.start_date}
                            </p>
                        </div>
                        <div class="wi-item-amount ${t.type}">
                            <div class="text-xs font-normal text-muted mb-0.5">${this.range}mo Impact</div>
                            ${t.type === 'income' ? '+' : '-'}${formatter.formatCurrency(totalImpact)}
                        </div>
                        <div class="wi-item-actions">
                            <button class="action-btn" onclick="app.views.whatif.applyToBudget('${t.id}')" title="Apply to Budget">
                                <i data-lucide="check-circle-2" class="text-success"></i>
                            </button>
                            <button class="action-btn" onclick="app.views.whatif.removeSandboxItem('${t.id}')" title="Delete">
                                <i data-lucide="trash-2" class="text-danger"></i>
                            </button>
                        </div>
                    </div>
                `}).join('')
                : `
                <div class="empty-state py-8">
                    <i data-lucide="plus-circle" class="w-12 h-12 text-muted mb-3"></i>
                    <p class="text-muted">No hypothetical items yet.</p>
                </div>`;
        }

        const realityList = $('#reality-toggle-list');
        if (realityList) {
            realityList.innerHTML = state.transactions.length > 0
                ? state.transactions.map(t => {
                    const idStr = String(t.id);
                    const isMuted = this.realityToggles.has(idStr);
                    const currentAmt = this.realityOverrides[idStr] !== undefined ? this.realityOverrides[idStr] : t.amount;
                    return `
                    <div class="wi-item-card ${isMuted ? 'muted' : ''} ${t.type}">
                        <div class="wi-reality-toggle">
                            <label class="toggle-switch">
                                <input type="checkbox" ${!isMuted ? 'checked' : ''} 
                                    onchange="app.views.whatif.toggleRealityItem(${t.id})">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="wi-item-info">
                            <h4>${t.description || t.category}</h4>
                            <p>${t.type} <span class="mx-1">•</span> ${t.frequency}</p>
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

window.SandboxView = SandboxView;
