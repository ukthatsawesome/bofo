class ChartManager {
    constructor(stateManager) {
        this.state = stateManager;
        this.charts = {};
    }

    _getThemeStyles() {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        return {
            brandPrimary: isLight ? '#6c5ce7' : '#a29bfe',
            brandSecondary: isLight ? '#00cec9' : '#81ecec',
            brandSuccess: '#55efc4',
            brandDanger: '#ff7675',
            gridColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
            textColor: isLight ? '#636e72' : '#9494b8',
            tooltipBg: isLight ? '#fff' : '#1a1a2e',
            tooltipTitle: isLight ? '#2d3436' : '#f0f0f5',
            chartAreaBg: isLight ? 'rgba(108, 92, 231, 0.05)' : 'rgba(162, 155, 254, 0.1)',
            isLight
        };
    }

    renderDashboardChart(canvasId, data) {
        const el = $(`#${canvasId}`);
        if (!el) return;
        const ctx = el.getContext('2d');
        if (this.charts[canvasId]) this.charts[canvasId].destroy();

        const s = this._getThemeStyles();

        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        type: 'line',
                        label: 'Net Worth',
                        data: data.netWorth,
                        borderColor: s.brandPrimary,
                        backgroundColor: 'transparent',
                        tension: 0.4,
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: s.brandPrimary,
                        yAxisID: 'y1',
                    },
                    {
                        label: 'Income',
                        data: data.income,
                        backgroundColor: s.isLight ? 'rgba(85, 239, 196, 0.6)' : 'rgba(85, 239, 196, 0.4)',
                        borderRadius: 6,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Expenses',
                        data: data.expenses,
                        backgroundColor: s.isLight ? 'rgba(255, 118, 117, 0.6)' : 'rgba(255, 118, 117, 0.4)',
                        borderRadius: 6,
                        yAxisID: 'y',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'top', labels: { color: s.textColor, usePointStyle: true, boxWidth: 8 } },
                    tooltip: {
                        backgroundColor: s.tooltipBg,
                        titleColor: s.tooltipTitle,
                        bodyColor: s.textColor,
                        borderColor: s.brandPrimary,
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 10,
                        displayColors: true
                    }
                },
                scales: {
                    y: {
                        type: 'linear', position: 'left',
                        grid: { color: s.gridColor, drawBorder: false },
                        ticks: { color: s.textColor, callback: (val) => '$' + val.toLocaleString() }
                    },
                    y1: {
                        type: 'linear', position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { color: s.brandPrimary, callback: (val) => '$' + val.toLocaleString() }
                    },
                    x: { grid: { display: false }, ticks: { color: s.textColor } }
                }
            }
        });

        return this.charts[canvasId];
    }

    renderLineChart(canvasId, data, label = 'Balance', secondDataset = null) {
        const el = $(`#${canvasId}`);
        if (!el) return;
        const ctx = el.getContext('2d');
        if (this.charts[canvasId]) this.charts[canvasId].destroy();

        const s = this._getThemeStyles();
        const datasets = [{
            label: label,
            data: data.map(d => d.balance),
            borderColor: s.brandPrimary,
            backgroundColor: s.chartAreaBg,
            tension: 0.4,
            fill: true,
            borderWidth: 3,
            pointRadius: 0
        }];

        if (secondDataset) {
            datasets.push({
                label: secondDataset.label,
                data: data.map(d => d.netWorth),
                borderColor: s.brandSecondary,
                backgroundColor: s.isLight ? 'rgba(0, 206, 201, 0.05)' : 'rgba(129, 236, 236, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 3,
                pointRadius: 0,
                hidden: secondDataset.hidden || false
            });
        }

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: { labels: data.map(d => d.date), datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: s.textColor, usePointStyle: true } } },
                scales: {
                    y: { grid: { color: s.gridColor }, ticks: { color: s.textColor } },
                    x: { grid: { display: false }, ticks: { color: s.textColor } }
                }
            }
        });

        return this.charts[canvasId];
    }

    renderForecastChart(canvasId, timeline) {
        const el = $(`#${canvasId}`);
        if (!el) return;
        const ctx = el.getContext('2d');
        if (this.charts[canvasId]) this.charts[canvasId].destroy();

        const s = this._getThemeStyles();
        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeline.map(d => d.date),
                datasets: [
                    {
                        label: 'Projected Liquid Balance',
                        data: timeline.map(d => d.balance),
                        borderColor: s.brandPrimary,
                        backgroundColor: (context) => {
                            const { ctx, chartArea } = context.chart;
                            if (!chartArea) return null;
                            const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                            gradient.addColorStop(0, s.isLight ? 'rgba(108, 92, 231, 0)' : 'rgba(162, 155, 254, 0)');
                            gradient.addColorStop(1, s.isLight ? 'rgba(108, 92, 231, 0.2)' : 'rgba(162, 155, 254, 0.3)');
                            return gradient;
                        },
                        tension: 0.3,
                        fill: true,
                        borderWidth: 4,
                        pointRadius: 0
                    },
                    {
                        label: 'Projected Net Worth',
                        data: timeline.map(d => d.netWorth),
                        borderColor: s.brandSecondary,
                        borderDash: [5, 5],
                        backgroundColor: 'transparent',
                        tension: 0.3,
                        fill: false,
                        borderWidth: 2,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { color: s.textColor, usePointStyle: true } },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        grid: { color: s.gridColor },
                        ticks: { color: s.textColor, callback: (v) => '$' + v.toLocaleString() }
                    },
                    x: { grid: { display: false }, ticks: { color: s.textColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } }
                }
            }
        });

        return this.charts[canvasId];
    }
}

window.ChartManager = ChartManager;
