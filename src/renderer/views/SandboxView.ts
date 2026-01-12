import { BaseView } from './BaseView';
import { $, UIUtils } from '../core/dom';
import { StatCard } from '../components/common/StatCard';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { EmptyState } from '../components/common/EmptyState';
import { InsightCard } from '../components/common/InsightCard';
import { ViewHeader } from '../components/common/ViewHeader';
import type { App } from '../core/app';
import Chart from 'chart.js/auto';

interface PlannedItem {
    id: string;
    description: string;
    type: 'expense' | 'income';
    amount: number;
    category: string;
    account_id: number;
    start_date: string;
    frequency: 'once' | 'weekly' | 'monthly' | 'yearly';
    is_active: boolean;
}

export class SandboxView extends BaseView {
    private plannedItems: PlannedItem[] = [];
    private range: number = 12;
    private aiInsight: string | null = null;
    private isLoadingInsight: boolean = false;
    private chart: Chart | null = null;

    constructor(app: App) {
        super(app, 'whatif');
    }

    async onShow(): Promise<void> {
        if (!this.isInitialized) {
            this.renderBaseTemplate();
            this.setupListeners();
            this.isInitialized = true;
        }
        await this.updateProjection();
    }

    renderBaseTemplate(): void {
        if (!this.element) return;
        this.element.innerHTML = `
            ${ViewHeader({
            title: 'Financial Planner',
            subtitle: 'Plan future expenses and see how they affect your finances',
            actions: `<div id="planner-range-container"></div>`
        })}

            <div id="planner-stats-container" class="stats-grid mb-6"></div>

            <!-- AI Insight Card -->
            <div id="planner-insight-container" class="mb-6"></div>

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

                    <!-- Planned Items Table -->
                    <div class="card mt-6">
                        <div class="card-header flex-row justify-between align-center">
                            <h3><i data-lucide="list-checks"></i> Planned Items</h3>
                            <div class="flex-row align-center gap-3">
                                <span class="text-muted text-sm" id="planned-items-count">0 items</span>
                                <button class="btn secondary sm" id="btn-clear-all" title="Clear All">
                                    <i data-lucide="trash-2"></i> Clear All
                                </button>
                            </div>
                        </div>
                        <div class="card-body no-padding">
                            <div id="planned-items-table"></div>
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
                </div>
            </div>
        `;

        this.refreshIcons();
        this.renderRangeSelector();
        this.populateDropdowns();
        this.setDefaultDate();
    }

    renderRangeSelector(): void {
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

    populateDropdowns(): void {
        const { state, formatter } = this.app;
        this.updateCategoryDropdown('expense');

        const accountSelect = $('#plan-account');
        if (accountSelect) {
            const activeAccounts = state.accounts.filter(a => a.status !== 'archived');
            accountSelect.innerHTML = activeAccounts
                .map(a => `<option value="${a.id}">${a.name} (${formatter.formatCurrency(a.balance)})</option>`)
                .join('');
        }
    }

    updateCategoryDropdown(type: string): void {
        const { state } = this.app;
        const categorySelect = $('#plan-category');
        if (categorySelect) {
            const categories = state.categories.filter(c => c.type === type && c.status !== 'archived');
            categorySelect.innerHTML = categories
                .map(c => `<option value="${c.name}">${c.name}</option>`)
                .join('');
        }
    }

    setDefaultDate(): void {
        const dateInput = $('#plan-date') as HTMLInputElement;
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }

    handleRangeChange(val: string): void {
        this.range = parseInt(val);
        this.renderRangeSelector();
        this.updateProjection();
    }

    setupListeners(): void {
        document.querySelectorAll('#plan-type-toggle .segment').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#plan-type-toggle .segment').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateCategoryDropdown((btn as HTMLElement).dataset.type || 'expense');
            });
        });

        const form = $('#planner-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addPlannedItem();
            });
        }

        $('#btn-clear-all')?.addEventListener('click', () => this.clearAllItems());
    }

    addPlannedItem(): void {
        const activeSegment = document.querySelector('#plan-type-toggle .segment.active') as HTMLElement;
        const type = (activeSegment?.dataset.type as 'expense' | 'income') || 'expense';
        const amount = parseFloat(($('#plan-amount') as HTMLInputElement).value);

        if (!amount || amount <= 0) {
            this.app.notifications.toast('Error', 'Please enter a valid amount', 'error');
            return;
        }

        const item: PlannedItem = {
            id: 'plan-' + Date.now(),
            description: ($('#plan-desc') as HTMLInputElement).value || 'Planned item',
            type,
            amount,
            category: ($('#plan-category') as HTMLSelectElement).value,
            account_id: parseInt(($('#plan-account') as HTMLSelectElement).value),
            start_date: ($('#plan-date') as HTMLInputElement).value,
            frequency: ($('#plan-frequency') as HTMLSelectElement).value as any,
            is_active: true
        };

        this.plannedItems.push(item);

        ($('#plan-desc') as HTMLInputElement).value = '';
        ($('#plan-amount') as HTMLInputElement).value = '';
        this.setDefaultDate();

        this.app.notifications.toast('Added', `"${item.description}" added to plan`, 'success');
        this.updateProjection();
    }

    removeItem(id: string): void {
        this.plannedItems = this.plannedItems.filter(item => item.id !== id);
        this.updateProjection();
    }

    async clearAllItems(): Promise<void> {
        if (this.plannedItems.length === 0) return;

        if (await this.app.notifications.confirm('Clear All', 'Remove all planned items?')) {
            this.plannedItems = [];
            this.updateProjection();
            this.app.notifications.toast('Cleared', 'All planned items removed');
        }
    }

    async updateProjection(): Promise<void> {
        const { state } = this.app;

        try {
            const baselineForecast = await window.api.calculateForecast({
                transactions: state.transactions,
                accounts: state.accounts,
                months: this.range
            });

            const scenarioTransactions = [...state.transactions, ...this.plannedItems];
            const scenarioForecast = await window.api.calculateForecast({
                transactions: scenarioTransactions,
                accounts: state.accounts,
                months: this.range
            });

            const baseSummary = baselineForecast?.summary || {};
            const scenSummary = scenarioForecast?.summary || {};

            const currentBalance = state.accounts
                .filter(a => ['bank', 'wallet'].includes(a.type))
                .reduce((sum, a) => sum + a.balance, 0);

            const baselineEnd = baseSummary.endBalance || 0;
            const scenarioEnd = scenSummary.endBalance || 0;
            const impact = scenarioEnd - baselineEnd;

            const plannedExpenses = this._calculateTotalPlanned('expense');
            const plannedIncome = this._calculateTotalPlanned('income');

            // Render stats
            this._renderStats(currentBalance, baselineEnd, scenarioEnd, impact, plannedExpenses, plannedIncome);

            // Render chart
            const timeline = scenarioForecast?.timeline || [];
            const baselineTimeline = baselineForecast?.timeline || [];

            if (timeline.length > 0) {
                this.renderComparisonChart(baselineTimeline, timeline);
            }

            // Render planned items table
            this.renderPlannedItemsTable();

            // Load AI insight
            await this._loadInsight(currentBalance, baselineEnd, scenarioEnd, impact, plannedExpenses, plannedIncome);

        } catch (error) {
            console.error('Projection update failed:', error);
        }
    }

    _calculateTotalPlanned(type: string): number {
        return this.plannedItems
            .filter(i => i.type === type)
            .reduce((sum, i) => {
                if (i.frequency === 'once') return sum + i.amount;
                if (i.frequency === 'monthly') return sum + (i.amount * this.range);
                if (i.frequency === 'weekly') return sum + (i.amount * this.range * 4);
                if (i.frequency === 'yearly') return sum + (i.amount * (this.range / 12));
                return sum;
            }, 0);
    }

    _renderStats(currentBalance: number, baselineEnd: number, scenarioEnd: number, impact: number, plannedExpenses: number, plannedIncome: number): void {
        const { formatter } = this.app;
        const statsContainer = $('#planner-stats-container');
        if (!statsContainer) return;

        statsContainer.innerHTML = `
            ${StatCard({ label: 'Current Balance', value: formatter.formatCurrency(currentBalance), icon: 'wallet' })}
            ${StatCard({ label: 'Without Plan', value: formatter.formatCurrency(baselineEnd), icon: 'trending-up' })}
            ${StatCard({
            label: 'With Plan',
            value: formatter.formatCurrency(scenarioEnd),
            icon: 'target',
            trend: impact !== 0 ? { type: impact >= 0 ? 'up' : 'down', value: (impact >= 0 ? '+' : '') + formatter.formatCurrency(impact) } : undefined
        })}
            ${StatCard({ label: 'Planned Expenses', value: formatter.formatCurrency(plannedExpenses), icon: 'credit-card' })}
            ${StatCard({ label: 'Planned Income', value: formatter.formatCurrency(plannedIncome), icon: 'banknote' })}
            ${StatCard({
            label: 'Net Impact',
            value: (impact >= 0 ? '+' : '') + formatter.formatCurrency(impact),
            icon: impact >= 0 ? 'arrow-up-circle' : 'arrow-down-circle'
        })}
        `;
        this.refreshIcons('#planner-stats-container');
    }

    async _loadInsight(currentBalance: number, baselineEnd: number, scenarioEnd: number, impact: number, plannedExpenses: number, plannedIncome: number): Promise<void> {
        const container = $('#planner-insight-container');
        if (!container) return;

        if (this.plannedItems.length === 0) {
            container.innerHTML = '';
            return;
        }

        // Build context for caching
        const { formatter } = this.app;
        const summaryData = {
            currentBalance: formatter.formatCurrency(currentBalance),
            baselineEnd: formatter.formatCurrency(baselineEnd),
            scenarioEnd: formatter.formatCurrency(scenarioEnd),
            impact: formatter.formatCurrency(impact),
            impactPercent: currentBalance > 0 ? ((impact / currentBalance) * 100).toFixed(1) : '0',
            plannedExpenses: formatter.formatCurrency(plannedExpenses),
            plannedIncome: formatter.formatCurrency(plannedIncome),
            plannedExpensesRaw: plannedExpenses,
            plannedIncomeRaw: plannedIncome,
            range: this.range,
            items: this.plannedItems.map(i => ({
                description: i.description,
                type: i.type,
                amount: i.amount,
                frequency: i.frequency,
                category: i.category
            })),
            isDeficit: scenarioEnd < 0,
            willGoNegative: scenarioEnd < 0 && baselineEnd >= 0
        };

        // Check cache first (for same scenario configuration)
        const cacheContext = `planner_${this.range}_${this.plannedItems.length}`;
        const cachedInsight = this.app.aiCache.getCached(cacheContext, summaryData) as any;
        if (cachedInsight) {
            container.innerHTML = InsightCard({
                title: cachedInsight.isAI ? 'AI Financial Analysis' : 'Financial Analysis',
                message: cachedInsight.text,
                icon: cachedInsight.icon
            });
            this.refreshIcons(container);
            this.isLoadingInsight = false;
            return;
        }

        // Show loading state
        if (!this.isLoadingInsight) {
            this.isLoadingInsight = true;
            container.innerHTML = InsightCard({
                title: 'Financial Analysis',
                message: '<span class="typing-dots">Analyzing your plan</span>',
                icon: 'brain'
            });
            this.refreshIcons(container);
        }

        try {
            const insight: any = await this.app.aiCache.fetchInsight(
                cacheContext,
                summaryData,
                async (data: any) => {
                    const prompt = this._buildInsightPrompt(data);
                    return await window.api.getAIInsight(prompt);
                },
                (data: any) => this.app.fallbackGenerator.generatePlannerInsight(data),
                {
                    aiTitle: 'AI Financial Analysis',
                    fallbackTitle: 'Financial Analysis',
                    ttl: 5 * 60 * 1000 // 5 minutes for planner (changes frequently)
                }
            );

            this.aiInsight = insight.text;
            container.innerHTML = InsightCard({
                title: insight.isAI ? 'AI Financial Analysis' : 'Financial Analysis',
                message: insight.isAI ? `<p>${insight.text}</p>` : insight.text,
                icon: insight.icon
            });
            this.refreshIcons(container);
        } catch (error) {
            console.error('Failed to load planner insight:', error);
            const fallbackInsight = this.app.fallbackGenerator.generatePlannerInsight(summaryData);
            container.innerHTML = InsightCard({
                title: 'Financial Analysis',
                message: fallbackInsight,
                icon: 'lightbulb'
            });
            this.refreshIcons(container);
        }

        this.isLoadingInsight = false;
    }

    _buildInsightPrompt(data: any): string {
        return `Analyze this financial plan and give practical advice in 2-3 sentences:
Current balance: ${data.currentBalance}
Projected without plan: ${data.baselineEnd} in ${data.range} months
Projected with plan: ${data.scenarioEnd}
Net impact: ${data.impact} (${data.impactPercent}% of current balance)
Planned expenses: ${data.plannedExpenses}
Planned income: ${data.plannedIncome}
Items: ${data.items.map((i: any) => `${i.description} (${i.type}, ${i.amount}, ${i.frequency})`).join(', ')}
${data.willGoNegative ? 'WARNING: This plan will cause negative balance!' : ''}
Be direct, practical, and give specific advice on how to balance this plan if needed.`;
    }

    renderComparisonChart(baseline: any[], scenario: any[]): void {
        const ctx = (document.getElementById('plannerChart') as HTMLCanvasElement)?.getContext('2d');
        if (!ctx) return;

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
                        labels: { color: isLight ? '#64748b' : '#94a3b8', usePointStyle: true }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const value = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ctx.parsed.y);
                                return `${ctx.dataset.label}: ${value}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        grid: { color: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' },
                        ticks: { color: isLight ? '#64748b' : '#94a3b8', callback: v => '$' + v.toLocaleString() }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: isLight ? '#64748b' : '#94a3b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }
                    }
                }
            }
        });
    }

    renderPlannedItemsTable(): void {
        const container = $('#planned-items-table');
        const countEl = $('#planned-items-count');
        const clearBtn = $('#btn-clear-all');

        if (countEl) {
            countEl.textContent = `${this.plannedItems.length} item${this.plannedItems.length !== 1 ? 's' : ''}`;
        }

        if (clearBtn) {
            clearBtn.style.display = this.plannedItems.length > 0 ? 'inline-flex' : 'none';
        }

        if (!container) return;

        if (this.plannedItems.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center">
                    ${EmptyState({
                icon: 'clipboard-list',
                title: 'No planned items',
                message: 'Add expenses or income to see how they affect your finances'
            })}
                </div>
            `;
            this.refreshIcons(container);
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Category</th>
                        <th>Account</th>
                        <th>Frequency</th>
                        <th>Date</th>
                        <th class="text-right">Amount</th>
                        <th class="text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.plannedItems.map(item => {
            const account = this.app.state.accounts.find(a => a.id === item.account_id);
            const freqLabel = { 'once': 'One-time', 'weekly': 'Weekly', 'monthly': 'Monthly', 'yearly': 'Yearly' }[item.frequency] || item.frequency;
            const amountClass = item.type === 'income' ? 'text-success' : 'text-danger';
            const amountPrefix = item.type === 'income' ? '+' : '-';

            return `
                            <tr>
                                <td><strong>${UIUtils.escapeHTML(item.description)}</strong></td>
                                <td>${UIUtils.escapeHTML(item.category)}</td>
                                <td>${UIUtils.escapeHTML(account?.name || 'Unknown')}</td>
                                <td>${freqLabel}</td>
                                <td>${item.start_date}</td>
                                <td class="text-right font-bold ${amountClass}">${amountPrefix}${this.app.formatter.formatCurrency(item.amount)}</td>
                                <td class="text-right">
                                    <div class="row-actions justify-end">
                                        <button class="action-btn danger" onclick="app.views.whatif.removeItem('${item.id}')" title="Remove">
                                            <i data-lucide="trash-2"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
        `;

        this.refreshIcons(container);
    }
}
