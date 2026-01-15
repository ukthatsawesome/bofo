import { BaseView } from './BaseView';
import { $, UIUtils } from '../core/dom';
import { ViewHeader } from '../components/common/ViewHeader';
import type { App } from '../core/app';
import Chart from 'chart.js/auto';

interface BillProjection {
    name: string;
    projected_cost: number;
    this_month_actual: number;
    last_month_actual: number;
    color: string;
}

interface BillReading {
    id: number | string;
    bill_name: string;
    bill_type_id: string | number;
    date: string;
    units_used: number;
    unit_name: string;
    total_cost: number;
    category_name?: string;
    color?: string;
    icon?: string;
    notes?: string;
}

export class BillsView extends BaseView {
    private projections: BillProjection[] = [];
    private pieChart: Chart | null = null;
    private trendChart: Chart | null = null;

    constructor(app: App) {
        super(app, 'bills');
    }

    async onShow(): Promise<void> {
        if (!this.isInitialized) {
            this.renderBaseTemplate();
            this.isInitialized = true;
        }

        await Promise.all([
            this.app.state.loadBillTypes(),
            this.app.state.loadBillReadings()
        ]);

        await this.updateContent();
    }

    renderBaseTemplate(): void {
        if (!this.element) return;
        this.element.innerHTML = `
            ${ViewHeader({
            title: 'Bills Tracking',
            subtitle: 'Monitor consumption and projected expenses',
            actions: `
                    <button class="btn primary" onclick="app.views.bills.handleNewReading()">
                        <i data-lucide="plus"></i> New Reading
                    </button>
                `
        })}

            <div id="bills-summary-row" class="stats-grid mb-6"></div>

            <div class="dashboard-grid">
                <div class="grid-col-8">
                    <!-- Consumption Chart -->
                    <div class="card mb-6">
                        <div class="card-header border-b">
                            <h3><i data-lucide="trending-up" class="w-4 h-4 mr-2"></i> Consumption Trends</h3>
                        </div>
                        <div class="card-body">
                            <div class="chart-container" style="height: 300px;">
                                <canvas id="bill-history-chart"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- History Table -->
                    <div class="card">
                        <div class="card-header flex-row justify-between align-center border-b">
                            <h3>Reading History</h3>
                            <div class="flex-row gap-2" id="bills-filters-container">
                                <select class="form-control sm" id="bills-filter-year">
                                    ${this.renderYearOptions()}
                                </select>
                                <select class="form-control sm" id="bills-filter-month">
                                    ${this.renderMonthOptions()}
                                </select>
                            </div>
                        </div>
                        <div class="card-body no-padding">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Bill</th>
                                        <th>Consumption</th>
                                        <th>Total Cost</th>
                                        <th class="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="bill-history-body"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="grid-col-4">
                    <!-- Projections Breakdown -->
                    <div class="card mb-6">
                        <div class="card-header border-b">
                            <h3>Bill Performance</h3>
                            <p class="text-xs text-text-muted">Past vs. Present vs. Projected</p>
                        </div>
                        <div class="card-body no-padding">
                            <table class="data-table compact">
                                <thead>
                                    <tr>
                                        <th>Bill</th>
                                        <th class="text-right">Last</th>
                                        <th class="text-right">This</th>
                                        <th class="text-right">Est.</th>
                                    </tr>
                                </thead>
                                <tbody id="bill-projections-body"></tbody>
                            </table>
                        </div>
                    </div>

                    <div class="card mb-6">
                        <div class="card-header border-b">
                            <h3>Quick Insights</h3>
                        </div>
                        <div class="card-body">
                            <div id="bill-insights-content">
                                <p class="text-text-muted text-sm text-center py-4">Add more readings to see insights</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header border-b">
                            <h3>Top Consumed</h3>
                        </div>
                        <div class="card-body">
                           <div class="chart-container" style="height: 250px;">
                               <canvas id="bill-distribution-chart"></canvas>
                           </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.setupEventListeners();
    }

    setupEventListeners(): void {
        $('#bills-filter-year')?.addEventListener('change', (e: Event) => {
            const target = e.target as HTMLSelectElement;
            this.app.state.billHistoryFilter.year = parseInt(target.value);
            this.updateContent();
        });
        $('#bills-filter-month')?.addEventListener('change', (e: Event) => {
            const target = e.target as HTMLSelectElement;
            this.app.state.billHistoryFilter.month = parseInt(target.value);
            this.updateContent();
        });
    }

    async updateContent(): Promise<void> {
        // Force refresh state for current month summary even if viewing history
        const projections = await window.api.getBillProjections();
        this.projections = projections;
        await this.app.state.loadBillReadings();

        this.renderFilters();
        this.renderSummary(projections);
        this.renderProjections(projections);
        this.renderHistory();
        this.renderInsights(projections);
        this.renderCharts(projections);

        // Final icon refresh to be absolutely sure everything dynamic is covered
        this.refreshIcons();
    }

    renderFilters(): void {
        const container = $('#bills-filters-container');
        if (!container) return;

        const yearHtml = this.renderYearOptions();
        const monthHtml = this.renderMonthOptions();

        container.innerHTML = `
            <select class="form-control sm" id="bills-filter-year">${yearHtml}</select>
            <select class="form-control sm" id="bills-filter-month">${monthHtml}</select>
        `;

        this.setupEventListeners();
    }

    renderYearOptions(): string {
        const years = new Set<number>();
        const currentYear = new Date().getFullYear();
        years.add(currentYear);

        // Add years from data
        if (this.app.state.allBillReadings) {
            this.app.state.allBillReadings.forEach(r => {
                const year = parseInt(r.date.split('-')[0]);
                if (year) years.add(year);
            });
        }

        const sortedYears = [...years].sort((a, b) => b - a);
        // Padding for UI
        if (sortedYears.length < 3) {
            let last = sortedYears[sortedYears.length - 1];
            while (sortedYears.length < 3) {
                last--;
                sortedYears.push(last);
            }
        }

        let options = '<option value="0">All Years</option>';
        options += sortedYears.map(y => `<option value="${y}" ${y == this.app.state.billHistoryFilter.year ? 'selected' : ''}>${y}</option>`).join('');
        return options;
    }

    renderMonthOptions(): string {
        const months = ['All Months', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return months.map((m, i) => `<option value="${i}" ${i == this.app.state.billHistoryFilter.month ? 'selected' : ''}>${m}</option>`).join('');
    }

    renderSummary(projections: BillProjection[]): void {
        const totalProjectedLimit = projections.reduce((sum, p) => sum + p.projected_cost, 0);
        const recordedThisMonth = projections.reduce((sum, p) => sum + p.this_month_actual, 0);

        const container = $('#bills-summary-row');
        if (!container) return;

        container.innerHTML = `
            <div class="card p-5">
                <div class="flex-row align-center gap-4">
                    <div class="icon-box primary"><i data-lucide="calendar"></i></div>
                    <div>
                        <p class="text-xs text-text-muted font-bold uppercase tracking-widest">Monthly Goal (Est)</p>
                        <h2 class="mt-1">${this.app.formatter.formatCurrency(totalProjectedLimit)}</h2>
                    </div>
                </div>
            </div>
            <div class="card p-5">
                <div class="flex-row align-center gap-4">
                    <div class="icon-box success"><i data-lucide="receipt"></i></div>
                    <div>
                        <p class="text-xs text-text-muted font-bold uppercase tracking-widest">Spent This Month</p>
                        <h2 class="mt-1">${this.app.formatter.formatCurrency(recordedThisMonth)}</h2>
                    </div>
                </div>
            </div>
            <div class="card p-5">
                <div class="flex-row align-center gap-4">
                    <div class="icon-box warning"><i data-lucide="trending-up"></i></div>
                    <div>
                        <p class="text-xs text-text-muted font-bold uppercase tracking-widest">Performance</p>
                        <h2 class="mt-1 ${recordedThisMonth > totalProjectedLimit ? 'text-danger' : 'text-success'}">
                            ${recordedThisMonth > totalProjectedLimit ? 'Over Budget' : 'Within Budget'}
                        </h2>
                    </div>
                </div>
            </div>
        `;
        this.refreshIcons();
    }

    renderProjections(projections: BillProjection[]): void {
        UIUtils.renderList('bill-projections-body', projections, (p: BillProjection) => {
            return `
                <tr class="border-b border-border last:border-0 hover:bg-brand-primary/5">
                    <td class="px-2 py-3">
                        <div class="flex-row align-center gap-2">
                            <div class="w-2 h-2 rounded-full" style="background: ${p.color}"></div>
                            <span class="text-xs font-bold">${UIUtils.escapeHTML(p.name)}</span>
                        </div>
                    </td>
                    <td class="px-2 py-3 text-right text-xs text-text-muted">
                        ${this.app.formatter.formatCurrency(p.last_month_actual)}
                    </td>
                    <td class="px-2 py-3 text-right text-xs font-medium">
                        ${this.app.formatter.formatCurrency(p.this_month_actual)}
                    </td>
                    <td class="px-2 py-3 text-right font-bold text-xs text-brand-primary">
                        ${this.app.formatter.formatCurrency(p.projected_cost)}
                    </td>
                </tr>
            `;
        }, 'No data.');
    }

    renderHistory(): void {
        UIUtils.renderList('bill-history-body', this.app.state.billReadings, (r: BillReading) => {
            return `
                <tr class="hover:bg-brand-primary/5 transition-colors border-b border-border last:border-0">
                    <td class="px-5 py-4 text-sm text-text-secondary">${r.date}</td>
                    <td class="px-5 py-4 text-sm font-bold text-text-primary">
                         <div class="flex-row align-center gap-2">
                             <div class="icon-box xs" style="background: ${r.color || '#7c3aed'}20; color: ${r.color || '#7c3aed'}">
                                 <i data-lucide="${r.icon || 'file-text'}" class="w-3 h-3"></i>
                             </div>
                             <span>${UIUtils.escapeHTML(r.bill_name)}</span>
                             ${r.category_name ? `<span class="badge xs" style="background: var(--brand-primary)15; color: var(--brand-primary); border: 1px solid var(--brand-primary)30; font-size: 10px;">${UIUtils.escapeHTML(r.category_name)}</span>` : ''}
                         </div>
                    </td>
                    <td class="px-5 py-4 text-sm font-medium">${r.units_used} ${UIUtils.escapeHTML(r.unit_name)}</td>
                    <td class="px-5 py-4 text-sm font-bold text-text-primary">${this.app.formatter.formatCurrency(r.total_cost)}</td>
                    <td class="px-5 py-4 text-right">
                        <div class="flex-row gap-1 justify-end">
                            <button class="action-btn p-1 hover:text-brand-primary transition-colors" onclick="app.views.bills.handleEditReading('${r.id}')">
                                <i data-lucide="edit-3" class="w-4 h-4"></i>
                            </button>
                            <button class="action-btn p-1 hover:text-danger transition-colors" onclick="app.views.bills.handleDeleteReading('${r.id}')">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }, 'No readings found for this period.');
        this.refreshIcons();
    }

    renderInsights(projections: BillProjection[]): void {
        const container = $('#bill-insights-content');
        if (!container) return;

        if (projections.length === 0 || !projections.some(p => p.projected_cost > 0)) {
            container.innerHTML = '<p class="text-text-muted text-sm text-center py-4">No data to analyze</p>';
            return;
        }

        const topBill = [...projections].sort((a, b) => b.projected_cost - a.projected_cost)[0];

        container.innerHTML = `
            <div class="mb-4">
                <p class="text-sm font-bold text-text-primary mb-1">Most Expensive</p>
                <div class="flex-row justify-between align-end">
                    <span class="text-xs text-text-muted">${UIUtils.escapeHTML(topBill.name)}</span>
                    <span class="text-sm font-bold text-danger">${this.app.formatter.formatCurrency(topBill.projected_cost)}</span>
                </div>
                <div class="progress-bar mt-1">
                    <div class="progress-fill" style="width: 100%; background: ${topBill.color}"></div>
                </div>
            </div>
            
            <div class="alert alert-info p-3 rounded-lg flex-row gap-2 mt-4 text-xs">
                <i data-lucide="lightbulb" class="w-4 h-4 flex-shrink-0 text-amber-400"></i>
                <div class="text-text-secondary">
                    <strong>Optimization Tip:</strong> Your average ${UIUtils.escapeHTML(topBill.name)} cost is ${this.app.formatter.formatCurrency(topBill.projected_cost)}. Reducing consumption by 10% would save you ${this.app.formatter.formatCurrency(topBill.projected_cost * 0.1)} per month.
                </div>
            </div>
        `;
        this.refreshIcons();
    }

    renderCharts(projections: BillProjection[]): void {
        // Doughnut Chart
        const distCanvas = document.getElementById('bill-distribution-chart') as HTMLCanvasElement;
        const distCtx = distCanvas?.getContext('2d');
        if (distCtx) {
            const activeProjections = projections.filter(p => p.projected_cost > 0);
            if (this.pieChart) this.pieChart.destroy();
            this.pieChart = new Chart(distCtx, {
                type: 'doughnut',
                data: {
                    labels: activeProjections.map(p => p.name),
                    datasets: [{
                        data: activeProjections.map(p => p.projected_cost),
                        backgroundColor: activeProjections.map(p => p.color),
                        borderWidth: 0,
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#a1a1aa',
                                font: { size: 10 },
                                padding: 10,
                                usePointStyle: true
                            }
                        }
                    },
                    cutout: '75%'
                }
            });
        }

        // History Trend Chart - USES ALL READINGS for better history
        const trendCanvas = document.getElementById('bill-history-chart') as HTMLCanvasElement;
        const trendCtx = trendCanvas?.getContext('2d');
        if (trendCtx) {
            if (this.trendChart) this.trendChart.destroy();

            const readings = this.app.state.allBillReadings;
            if (readings.length === 0) {
                const ctx = trendCtx;
                ctx.font = '14px Inter, sans-serif';
                ctx.fillStyle = '#a1a1aa';
                ctx.textAlign = 'center';
                ctx.fillText('No reading history recorded yet', trendCanvas.width / 2, trendCanvas.height / 2);
                return;
            }

            // Group readings by month
            const monthMap: Record<string, number> = {};
            readings.forEach(r => {
                const month = r.date.slice(0, 7); // YYYY-MM
                if (!monthMap[month]) monthMap[month] = 0;
                monthMap[month] += r.total_cost;
            });

            const labels = Object.keys(monthMap).sort();
            const data = labels.map(l => monthMap[l]);

            this.trendChart = new Chart(trendCtx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Total Bill Cost',
                        data,
                        borderColor: '#7c3aed',
                        backgroundColor: 'rgba(124, 58, 237, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointBackgroundColor: '#7c3aed',
                        pointRadius: labels.length === 1 ? 6 : 4, // Bigger point if only one item
                        pointHoverRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: {
                                color: '#a1a1aa',
                                callback: (v) => this.app.formatter.formatCurrency(v as number)
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#a1a1aa' }
                        }
                    }
                }
            });
        }
    }

    handleNewReading(): void {
        if (this.app.state.billTypes.length === 0) {
            this.app.notifications.toast('Configuration Required', 'Please set up bill types in settings first.', 'warning');
            return;
        }
        this.showReadingModal();
    }

    handleEditReading(id: number | string): void {
        const reading = this.app.state.billReadings.find(r => r.id == id) || this.app.state.allBillReadings.find(r => r.id == id);
        if (!reading) return;
        this.showReadingModal(reading);
    }

    showReadingModal(reading: any = null): void {
        this.app.renderDynamicModals();
        const modal = $('#bill-reading-modal');
        if (!modal) return;

        UIUtils.setHidden('#bill-reading-modal', false);

        // Refresh icons after showing modal (fixes missing icons)
        this.refreshIcons(modal);

        // Update Modal UI for edit mode
        const modalTitle = modal.querySelector('h2');
        if (modalTitle) modalTitle.innerText = reading ? 'Edit Reading' : 'Record New Reading';

        const billTypeSelect = $('#reading-bill-type') as HTMLSelectElement;
        const dateInput = $('#reading-date') as HTMLInputElement;
        const unitsInput = $('#reading-units') as HTMLInputElement;
        const costInput = $('#reading-cost') as HTMLInputElement;
        const notesInput = $('#reading-notes') as HTMLInputElement;
        const unitLabel = $('#reading-unit-label') as HTMLElement;
        const calcBtn = $('#calculate-reading-cost') as HTMLElement;
        const saveBtn = $('#save-reading') as HTMLElement;

        // Pre-fill if editing
        if (reading) {
            billTypeSelect.value = reading.bill_type_id;
            dateInput.value = reading.date;
            unitsInput.value = reading.units_used;
            costInput.value = reading.total_cost;
            notesInput.value = reading.notes || '';
            billTypeSelect.disabled = true; // Don't allow changing type once created
        } else {
            billTypeSelect.disabled = false;
            dateInput.value = new Date().toISOString().split('T')[0];
            unitsInput.value = '';
            costInput.value = '';
            notesInput.value = '';
        }

        // Shared function to calculate cost from units
        const calculateCost = () => {
            const opt = billTypeSelect.options[billTypeSelect.selectedIndex];
            const units = parseFloat(unitsInput.value) || 0;
            const costPer = parseFloat(opt?.dataset.cost || '0') || 0;
            if (units > 0 && costPer > 0) {
                costInput.value = (units * costPer).toFixed(2);
            }
        };

        const updateUnitInfo = () => {
            const opt = billTypeSelect.options[billTypeSelect.selectedIndex];
            if (opt) {
                unitLabel.innerText = opt.dataset.unit || '';
                const costPer = parseFloat(opt.dataset.cost || '0');
                $('#reading-cost-hint')!.innerText = `Current rate: ${this.app.formatter.formatCurrency(costPer)} per ${opt.dataset.unit}`;
            }
        };

        billTypeSelect.onchange = () => {
            updateUnitInfo();
            calculateCost(); // Recalculate when bill type changes
        };
        updateUnitInfo();

        // Auto-calculate cost when units are entered
        unitsInput.oninput = calculateCost;

        // Manual calculate button
        calcBtn.onclick = calculateCost;

        // Always re-bind to handle save vs update
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode?.replaceChild(newSaveBtn, saveBtn);

        newSaveBtn.addEventListener('click', async () => {
            const data: any = {
                bill_type_id: billTypeSelect.value,
                date: dateInput.value,
                units_used: parseFloat(unitsInput.value) || 0,
                total_cost: parseFloat(costInput.value) || 0,
                notes: notesInput.value
            };

            if (!data.date || data.units_used <= 0 || data.total_cost <= 0) {
                this.app.notifications.toast('Validation Error', 'Please enter valid units and cost', 'error');
                return;
            }

            try {
                if (reading) {
                    await window.api.updateBillReading(reading.id, data);
                    this.app.notifications.toast('Success', 'Reading updated');
                } else {
                    await window.api.addBillReading(data);
                    this.app.notifications.toast('Success', 'Reading recorded');
                }
                UIUtils.setHidden('#bill-reading-modal', true);
                this.updateContent();
            } catch (err: any) {
                this.app.notifications.alert('Error', err.message);
            }
        });
    }

    async handleDeleteReading(id: number | string): Promise<void> {
        if (await this.app.notifications.confirm('Delete Reading', 'Permanently remove this reading entry?')) {
            try {
                await window.api.deleteBillReading(id);
                this.updateContent();
            } catch (err: any) {
                this.app.notifications.alert('Error', err.message);
            }
        }
    }
}
