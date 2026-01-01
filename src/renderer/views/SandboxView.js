import { BaseView } from './BaseView.js';
import { $, UIUtils } from '../core/dom.js';
import { StatCard } from '../components/common/StatCard.js';
import { ProgressBar } from '../components/common/ProgressBar.js';
import { SegmentedControl } from '../components/common/SegmentedControl.js';
import { EmptyState } from '../components/common/EmptyState.js';

export class SandboxView extends BaseView {
    constructor(app) {
        super(app, 'whatif');
        this.plannedItems = [];
        this.range = 12; // Default 12 months
        this.isInitialized = false;
    }

    async onShow() {
        if (!this.isInitialized) {
            this.renderBaseTemplate();
            this.setupListeners();
            this.isInitialized = true;
        }
        await this.updateProjection();
    }

    renderBaseTemplate() {
        this.element.innerHTML = `
            <div class="view-header">
                <div class="header-main">
                    <h1>Financial Planner</h1>
                    <p class="text-muted">Plan future expenses and see how they affect your finances</p>
                </div>
                <div class="header-actions">
                    <div id="planner-range-container"></div>
                </div>
            </div>

            <div id="planner-stats-container" class="stats-grid mb-6"></div>

            <div class="planner-grid">
                <div class="planner-main-col">
                    <div class="card">
                        <div class="card-header">
                            <h3><i data-lucide="line-chart"></i> Financial Projection</h3>
                        </div>
                        <div class="card-body">
                            <div class="chart-container" style="min-height: 350px;">
                                <canvas id="plannerChart"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- Planned Items List -->
                    <div class="card mt-6">
                        <div class="card-header flex-row justify-between align-center">
                            <h3><i data-lucide="list-checks"></i> Planned Items</h3>
                            <span class="text-muted text-sm" id="planned-items-count">0 items</span>
                        </div>
                        <div class="card-body">
                            <div id="planned-items-list"></div>
                        </div>
                    </div>
                </div>

                <div class="planner-side-col">
                    <!-- Add Item Form -->
                    <div class="card">
                        <div class="card-header">
                            <h3><i data-lucide="plus-circle"></i> Add Planned Item</h3>
                        </div>
                        <div class="card-body">
                            <form id="planner-form" class="flex flex-col gap-4">
                                <div class="form-group mb-0">
                                    <label class="text-xs font-bold uppercase text-text-muted mb-1">Description</label>
                                    <input type="text" id="plan-desc" class="form-control" placeholder="e.g. Europe Trip, New Car..." required>
                                </div>

                                <div class="form-group mb-0">
                                    <label class="text-xs font-bold uppercase text-text-muted mb-1">Type</label>
                                    <div class="tx-type-toggle" id="plan-type-toggle">
                                        <button type="button" class="segment active" data-type="expense">Expense</button>
                                        <button type="button" class="segment" data-type="income">Income</button>
                                    </div>
                                </div>

                                <div class="form-group mb-0">
                                    <label class="text-xs font-bold uppercase text-text-muted mb-1">Amount</label>
                                    <input type="number" id="plan-amount" class="form-control" placeholder="0.00" step="0.01" min="0" required>
                                </div>

                                <div class="form-group mb-0">
                                    <label class="text-xs font-bold uppercase text-text-muted mb-1">Category</label>
                                    <select id="plan-category" class="form-control"></select>
                                </div>

                                <div class="form-group mb-0">
                                    <label class="text-xs font-bold uppercase text-text-muted mb-1">Account</label>
                                    <select id="plan-account" class="form-control"></select>
                                </div>

                                <div class="form-group mb-0">
                                    <label class="text-xs font-bold uppercase text-text-muted mb-1">When</label>
                                    <input type="date" id="plan-date" class="form-control" required>
                                </div>

                                <div class="form-group mb-0">
                                    <label class="text-xs font-bold uppercase text-text-muted mb-1">Frequency</label>
                                    <select id="plan-frequency" class="form-control">
                                        <option value="once">One-time</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="yearly">Yearly</option>
                                    </select>
                                </div>

                                <button type="submit" class="btn primary w-full mt-2">
                                    <i data-lucide="plus"></i> Add to Plan
                                </button>
                            </form>
                        </div>
                    </div>

                    <!-- Quick Actions -->
                    <div class="card mt-6">
                        <div class="card-header">
                            <h3><i data-lucide="zap"></i> Actions</h3>
                        </div>
                        <div class="card-body flex flex-col gap-2">
                            <button class="btn secondary w-full" id="btn-clear-all">
                                <i data-lucide="trash-2"></i> Clear All Items
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.refreshIcons();
        this.renderRangeSelector();
        this.populateDropdowns();
        this.setDefaultDate();
    }

    renderRangeSelector() {
        const container = $('#planner-range-container');
        if (container) {
            container.innerHTML = SegmentedControl({
                id: 'planner-range-toggle',
                onchange: 'app.views.whatif.handleRangeChange',
                options: [
                    { label: '6M', value: '6', active: this.range === 6 },
                    { label: '12M', value: '12', active: this.range === 12 },
                    { label: '18M', value: '18', active: this.range === 18 },
                    { label: '24M', value: '24', active: this.range === 24 }
                ]
            });
        }
    }

    populateDropdowns() {
        const { state } = this.app;

        // Populate categories (default to expense)
        this.updateCategoryDropdown('expense');

        // Populate accounts
        const accountSelect = $('#plan-account');
        if (accountSelect) {
            const activeAccounts = state.accounts.filter(a => a.status !== 'archived');
            accountSelect.innerHTML = activeAccounts
                .map(a => `<option value="${a.id}">${a.name} (${this.formatter.formatCurrency(a.balance)})</option>`)
                .join('');
        }
    }

    updateCategoryDropdown(type) {
        const { state } = this.app;
        const categorySelect = $('#plan-category');
        if (categorySelect) {
            const categories = state.categories.filter(c => c.type === type && c.status !== 'archived');
            categorySelect.innerHTML = categories
                .map(c => `<option value="${c.name}">${c.name}</option>`)
                .join('');
        }
    }

    setDefaultDate() {
        const dateInput = $('#plan-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }

    handleRangeChange(val) {
        this.range = parseInt(val);
        this.renderRangeSelector();
        this.updateProjection();
    }

    setupListeners() {
        // Type toggle
        document.querySelectorAll('#plan-type-toggle .segment').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#plan-type-toggle .segment').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateCategoryDropdown(btn.dataset.type);
            });
        });

        // Form submit
        const form = $('#planner-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addPlannedItem();
            });
        }

        // Clear all
        $('#btn-clear-all')?.addEventListener('click', () => this.clearAllItems());
    }

    addPlannedItem() {
        const type = document.querySelector('#plan-type-toggle .segment.active')?.dataset.type || 'expense';
        const amount = parseFloat($('#plan-amount').value);

        if (!amount || amount <= 0) {
            this.app.notifications.toast('Error', 'Please enter a valid amount', 'error');
            return;
        }

        const item = {
            id: 'plan-' + Date.now(),
            description: $('#plan-desc').value || 'Planned item',
            type,
            amount,
            category: $('#plan-category').value,
            account_id: parseInt($('#plan-account').value),
            start_date: $('#plan-date').value,
            frequency: $('#plan-frequency').value,
            is_active: true
        };

        this.plannedItems.push(item);

        // Reset form
        $('#plan-desc').value = '';
        $('#plan-amount').value = '';
        this.setDefaultDate();

        this.app.notifications.toast('Added', `"${item.description}" added to plan`, 'success');
        this.updateProjection();
    }

    removeItem(id) {
        this.plannedItems = this.plannedItems.filter(item => item.id !== id);
        this.updateProjection();
    }

    async clearAllItems() {
        if (this.plannedItems.length === 0) return;

        if (await this.app.notifications.confirm('Clear All', 'Remove all planned items?')) {
            this.plannedItems = [];
            this.updateProjection();
            this.app.notifications.toast('Cleared', 'All planned items removed');
        }
    }

    async updateProjection() {
        const { state, chartManager, formatter } = this.app;

        try {
            // Calculate baseline (without planned items)
            const baselineForecast = await window.api.calculateForecast({
                transactions: state.transactions,
                accounts: state.accounts,
                months: this.range
            });

            // Calculate with planned items
            const scenarioTransactions = [...state.transactions, ...this.plannedItems];
            const scenarioForecast = await window.api.calculateForecast({
                transactions: scenarioTransactions,
                accounts: state.accounts,
                months: this.range
            });

            // Extract data
            const baseSummary = baselineForecast?.summary || {};
            const scenSummary = scenarioForecast?.summary || {};

            const currentBalance = state.accounts
                .filter(a => ['bank', 'wallet'].includes(a.type))
                .reduce((sum, a) => sum + a.balance, 0);

            const baselineEnd = baseSummary.endBalance || 0;
            const scenarioEnd = scenSummary.endBalance || 0;
            const impact = scenarioEnd - baselineEnd;

            const plannedExpenses = this.plannedItems
                .filter(i => i.type === 'expense')
                .reduce((sum, i) => {
                    if (i.frequency === 'once') return sum + i.amount;
                    if (i.frequency === 'monthly') return sum + (i.amount * this.range);
                    if (i.frequency === 'weekly') return sum + (i.amount * this.range * 4);
                    if (i.frequency === 'yearly') return sum + (i.amount * (this.range / 12));
                    return sum;
                }, 0);

            const plannedIncome = this.plannedItems
                .filter(i => i.type === 'income')
                .reduce((sum, i) => {
                    if (i.frequency === 'once') return sum + i.amount;
                    if (i.frequency === 'monthly') return sum + (i.amount * this.range);
                    if (i.frequency === 'weekly') return sum + (i.amount * this.range * 4);
                    if (i.frequency === 'yearly') return sum + (i.amount * (this.range / 12));
                    return sum;
                }, 0);

            // Render stats
            const statsContainer = $('#planner-stats-container');
            if (statsContainer) {
                statsContainer.innerHTML = `
                    ${StatCard({
                    label: 'Current Balance',
                    value: formatter.formatCurrency(currentBalance),
                    icon: 'wallet'
                })}
                    ${StatCard({
                    label: 'Without Plan',
                    value: formatter.formatCurrency(baselineEnd),
                    icon: 'trending-up'
                })}
                    ${StatCard({
                    label: 'With Plan',
                    value: formatter.formatCurrency(scenarioEnd),
                    icon: 'target',
                    trend: impact !== 0 ? {
                        type: impact >= 0 ? 'up' : 'down',
                        value: (impact >= 0 ? '+' : '') + formatter.formatCurrency(impact)
                    } : null
                })}
                    ${StatCard({
                    label: 'Planned Expenses',
                    value: formatter.formatCurrency(plannedExpenses),
                    icon: 'credit-card'
                })}
                    ${StatCard({
                    label: 'Planned Income',
                    value: formatter.formatCurrency(plannedIncome),
                    icon: 'banknote'
                })}
                    ${StatCard({
                    label: 'Net Impact',
                    value: (impact >= 0 ? '+' : '') + formatter.formatCurrency(impact),
                    icon: impact >= 0 ? 'arrow-up-circle' : 'arrow-down-circle'
                })}
                `;
            }

            // Render chart
            const timeline = scenarioForecast?.timeline || [];
            const baselineTimeline = baselineForecast?.timeline || [];

            if (timeline.length > 0) {
                this.renderComparisonChart(baselineTimeline, timeline);
            }

            // Render planned items list
            this.renderPlannedItems();

            this.refreshIcons('#planner-stats-container');

        } catch (error) {
            console.error('Projection update failed:', error);
        }
    }

    renderComparisonChart(baseline, scenario) {
        const ctx = document.getElementById('plannerChart')?.getContext('2d');
        if (!ctx) return;

        // Destroy existing chart
        if (this.chart) {
            this.chart.destroy();
        }

        const isLight = document.documentElement.getAttribute('data-theme') === 'light';

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: scenario.map(d => d.date),
                datasets: [
                    {
                        label: 'Without Plan',
                        data: baseline.map(d => d.balance),
                        borderColor: isLight ? '#94a3b8' : '#64748b',
                        backgroundColor: 'transparent',
                        borderDash: [5, 5],
                        tension: 0.3,
                        borderWidth: 2,
                        pointRadius: 0
                    },
                    {
                        label: 'With Plan',
                        data: scenario.map(d => d.balance),
                        borderColor: isLight ? '#6c5ce7' : '#a29bfe',
                        backgroundColor: isLight ? 'rgba(108, 92, 231, 0.1)' : 'rgba(162, 155, 254, 0.15)',
                        fill: true,
                        tension: 0.3,
                        borderWidth: 3,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        labels: {
                            color: isLight ? '#64748b' : '#94a3b8',
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const value = new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD'
                                }).format(ctx.parsed.y);
                                return `${ctx.dataset.label}: ${value}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        grid: { color: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' },
                        ticks: {
                            color: isLight ? '#64748b' : '#94a3b8',
                            callback: v => '$' + v.toLocaleString()
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: isLight ? '#64748b' : '#94a3b8',
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 12
                        }
                    }
                }
            }
        });
    }

    renderPlannedItems() {
        const container = $('#planned-items-list');
        const countEl = $('#planned-items-count');

        if (countEl) {
            countEl.textContent = `${this.plannedItems.length} item${this.plannedItems.length !== 1 ? 's' : ''}`;
        }

        if (!container) return;

        if (this.plannedItems.length === 0) {
            container.innerHTML = EmptyState({
                icon: 'clipboard-list',
                title: 'No planned items',
                message: 'Add expenses or income to see how they affect your finances'
            });
            this.refreshIcons(container);
            return;
        }

        container.innerHTML = this.plannedItems.map(item => {
            const account = this.state.accounts.find(a => a.id === item.account_id);
            const freqLabel = {
                'once': 'One-time',
                'weekly': 'Weekly',
                'monthly': 'Monthly',
                'yearly': 'Yearly'
            }[item.frequency] || item.frequency;

            return `
                <div class="planned-item ${item.type}">
                    <div class="planned-item-info">
                        <h4>${item.description}</h4>
                        <p class="text-muted text-sm">
                            ${item.category} • ${account?.name || 'Unknown'} • ${freqLabel} • ${item.start_date}
                        </p>
                    </div>
                    <div class="planned-item-amount ${item.type}">
                        ${item.type === 'income' ? '+' : '-'}${this.formatter.formatCurrency(item.amount)}
                    </div>
                    <button class="btn-icon" onclick="app.views.whatif.removeItem('${item.id}')" title="Remove">
                        <i data-lucide="x"></i>
                    </button>
                </div>
            `;
        }).join('');

        this.refreshIcons(container);
    }
}

window.SandboxView = SandboxView;
