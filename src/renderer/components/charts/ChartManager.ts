
import Chart from 'chart.js/auto';
import type { StateManager } from '../../core/state';

interface ThemeStyles {
    isLight: boolean;
    brandPrimary: string;
    brandSecondary: string;
    brandSuccess: string;
    brandDanger: string;
    gridColor: string;
    textColor: string;
    tooltipBg: string;
    tooltipTitle: string;
    chartAreaBg: string; // Add this line
}

interface ChartData {
    labels: string[];
    netWorth: number[];
    income: number[];
    expenses: number[];
}

interface LineChartItem {
    date: string;
    balance: number;
    netWorth?: number;
    isFuture?: boolean;
}

export class ChartManager {
    private state: StateManager;
    private charts: Record<string, Chart>;

    constructor(stateManager: StateManager) {
        this.state = stateManager;
        this.charts = {};
    }

    /* ==================== THEME ==================== */

    private _getThemeStyles(): ThemeStyles {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';

        return {
            isLight,
            brandPrimary: isLight ? '#6c5ce7' : '#a29bfe',
            brandSecondary: isLight ? '#00cec9' : '#81ecec',
            brandSuccess: '#55efc4',
            brandDanger: '#ff7675',
            gridColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
            textColor: isLight ? '#636e72' : '#9494b8',
            tooltipBg: isLight ? '#ffffff' : '#1a1a2e',
            tooltipTitle: isLight ? '#2d3436' : '#f0f0f5',
            chartAreaBg: isLight
                ? 'rgba(108, 92, 231, 0.05)'
                : 'rgba(162, 155, 254, 0.1)'
        };
    }

    /* ==================== HELPERS ==================== */

    private _getContext(canvasId: string): CanvasRenderingContext2D | null {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) return null;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        return canvas.getContext('2d');
    }

    private _baseOptions(styles: ThemeStyles): any {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    labels: {
                        color: styles.textColor,
                        usePointStyle: true
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: styles.gridColor },
                    ticks: { color: styles.textColor }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: styles.textColor }
                }
            }
        };
    }

    /* ==================== DASHBOARD ==================== */

    renderDashboardChart(canvasId: string, data: ChartData): Chart | undefined {
        const ctx = this._getContext(canvasId);
        if (!ctx) return;

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
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Income',
                        data: data.income,
                        backgroundColor: s.isLight
                            ? 'rgba(85, 239, 196, 0.6)'
                            : 'rgba(85, 239, 196, 0.4)',
                        borderRadius: 6
                    },
                    {
                        label: 'Expenses',
                        data: data.expenses,
                        backgroundColor: s.isLight
                            ? 'rgba(255, 118, 117, 0.6)'
                            : 'rgba(255, 118, 117, 0.4)',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                ...this._baseOptions(s),
                scales: {
                    y: {
                        position: 'left',
                        ticks: {
                            color: s.textColor,
                            callback: (v: string | number) => '$' + v.toLocaleString()
                        }
                    },
                    y1: {
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: {
                            color: s.brandPrimary,
                            callback: (v: string | number) => '$' + v.toLocaleString()
                        }
                    }
                }
            }
        } as any);

        return this.charts[canvasId];
    }

    /* ==================== LINE CHART ==================== */

    renderLineChart(canvasId: string, data: LineChartItem[], label = 'Balance', secondDataset: any = null): Chart | undefined {
        const ctx = this._getContext(canvasId);
        if (!ctx) return;

        const s = this._getThemeStyles();

        const datasets: any[] = [
            {
                label,
                data: data.map(d => d.balance),
                borderColor: s.brandPrimary,
                backgroundColor: s.chartAreaBg,
                tension: 0.4,
                fill: true,
                borderWidth: 3,
                pointRadius: 0
            }
        ];

        if (secondDataset) {
            datasets.push({
                label: secondDataset.label,
                data: data.map(d => d.netWorth),
                borderColor: s.brandSecondary,
                backgroundColor: s.isLight
                    ? 'rgba(0, 206, 201, 0.05)'
                    : 'rgba(129, 236, 236, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 3,
                pointRadius: 0,
                hidden: !!secondDataset.hidden
            });
        }

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.date),
                datasets
            },
            options: this._baseOptions(s)
        } as any);

        return this.charts[canvasId];
    }

    /* ==================== FORECAST ==================== */

    renderForecastChart(canvasId: string, timeline: LineChartItem[]): Chart | undefined {
        const ctx = this._getContext(canvasId);
        if (!ctx) return;

        const s = this._getThemeStyles();
        const today = new Date().toISOString().split('T')[0];

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeline.map(d => d.date),
                datasets: [
                    {
                        label: 'Liquid Balance',
                        data: timeline.map(d => d.balance),
                        borderColor: s.brandPrimary,
                        backgroundColor: (context: any) => {
                            const { ctx, chartArea } = context.chart;
                            if (!chartArea) return null;

                            const g = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                            g.addColorStop(0, 'transparent');
                            g.addColorStop(
                                1,
                                s.isLight
                                    ? 'rgba(108, 92, 231, 0.15)'
                                    : 'rgba(162, 155, 254, 0.2)'
                            );
                            return g;
                        },
                        tension: 0.3,
                        fill: true,
                        borderWidth: 4,
                        pointRadius: (ctx: any) =>
                            timeline[ctx.dataIndex]?.date === today ? 6 : 0,
                        pointBackgroundColor: s.brandPrimary,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        segment: {
                            borderDash: (ctx: any) =>
                                timeline[ctx.p0DataIndex]?.isFuture ? [] : [5, 5]
                        }
                    },
                    {
                        label: 'Net Worth',
                        data: timeline.map(d => d.netWorth),
                        borderColor: s.brandSecondary,
                        borderDash: [5, 5],
                        tension: 0.3,
                        fill: false,
                        borderWidth: 2,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                ...this._baseOptions(s),
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: (items: any[]) => {
                                const d = timeline[items[0].dataIndex];
                                return (d.isFuture ? 'Projected: ' : 'Actual: ') + d.date;
                            },
                            label: (ctx: any) => {
                                return (
                                    ctx.dataset.label +
                                    ': ' +
                                    new Intl.NumberFormat('en-US', {
                                        style: 'currency',
                                        currency: 'USD'
                                    }).format(ctx.parsed.y)
                                );
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            color: s.textColor,
                            callback: (v: string | number) => '$' + v.toLocaleString()
                        }
                    },
                    x: {
                        ticks: {
                            color: s.textColor,
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 12
                        }
                    }
                }
            }
        } as any);

        return this.charts[canvasId];
    }
}
