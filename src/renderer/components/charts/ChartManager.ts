import Chart, { ChartType, ChartData, ChartOptions, ScaleOptions } from 'chart.js/auto';

export interface IFormatter {
  currency(value: number, currency: string): string;
}

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
  chartAreaBg: string;
}

interface ChartDataInput {
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

interface SecondaryDatasetConfig {
  label: string;
  hidden?: boolean;
}

type ChartTypeKey = 'dashboard' | 'line' | 'forecast';

export class ChartManager {
  private charts: Record<string, Chart>;
  private chartTypes: Record<string, ChartTypeKey>;
  private formatter: IFormatter;
  private observer: MutationObserver | null;

  constructor(formatter: IFormatter) {
    this.charts = {};
    this.chartTypes = {};
    this.formatter = formatter;
    this.observer = null;

    this._setupThemeListener();
  }

  public dispose(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.destroyAll();
  }

  private _setupThemeListener(): void {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          this._handleThemeChange();
        }
      }
    });

    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  private _handleThemeChange(): void {
    const s = this._getThemeStyles();

    Object.keys(this.charts).forEach((id) => {
      const chart = this.charts[id];
      const type = this.chartTypes[id];

      if (!chart || !type) return;

      chart.options = { ...chart.options, ...this._baseOptions(s) };

      switch (type) {
        case 'dashboard':
          this._updateDashboardColors(chart, s);
          break;
        case 'line':
          this._updateLineColors(chart, s);
          break;
        case 'forecast':
          this._updateForecastColors(chart, s);
          break;
      }

      chart.update('none');
    });
  }

  private _updateDashboardColors(chart: Chart, s: ThemeStyles): void {
    if (chart.data.datasets.length < 3) return;

    const ds0 = chart.data.datasets[0] as any;
    ds0.borderColor = s.brandPrimary;
    ds0.pointBackgroundColor = s.brandPrimary;

    const ds1 = chart.data.datasets[1] as any;
    ds1.backgroundColor = this._getCssColor('--success', s.isLight ? 0.6 : 0.4);

    const ds2 = chart.data.datasets[2] as any;
    ds2.backgroundColor = this._getCssColor('--danger', s.isLight ? 0.6 : 0.4);
  }

  private _updateLineColors(chart: Chart, s: ThemeStyles): void {
    if (chart.data.datasets.length < 1) return;

    const ds0 = chart.data.datasets[0] as any;
    ds0.borderColor = s.brandPrimary;
    ds0.backgroundColor = s.chartAreaBg;

    if (chart.data.datasets.length > 1) {
      const ds1 = chart.data.datasets[1] as any;
      ds1.borderColor = s.brandSecondary;
      ds1.backgroundColor = this._getCssColor('--brand-secondary', s.isLight ? 0.05 : 0.1);
    }
  }

  private _updateForecastColors(chart: Chart, s: ThemeStyles): void {
    if (chart.data.datasets.length < 1) return;

    const ds0 = chart.data.datasets[0] as any;
    ds0.borderColor = s.brandPrimary;
    ds0.pointBackgroundColor = s.brandPrimary;
    ds0.pointBorderColor = this._getCssColor('--bg-panel');

    ds0.backgroundColor = (context: any) => {
      const chart = context.chart;
      const { ctx: canvasCtx, chartArea } = chart;
      if (!chartArea) return null;

      const gradient = canvasCtx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(1, this._getCssColor('--brand-primary', s.isLight ? 0.15 : 0.2));
      return gradient;
    };

    if (chart.data.datasets.length > 1) {
      const ds1 = chart.data.datasets[1] as any;
      ds1.borderColor = s.brandSecondary;
    }
  }

  private _getCssColor(variable: string, alpha = 1): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    return `rgba(${value} / ${alpha})`;
  }

  private _getThemeStyles(): ThemeStyles {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    return {
      isLight,
      brandPrimary: this._getCssColor('--brand-primary'),
      brandSecondary: this._getCssColor('--brand-secondary'),
      brandSuccess: this._getCssColor('--success'),
      brandDanger: this._getCssColor('--danger'),
      gridColor: this._getCssColor('--border', 0.1), // Reduced alpha for grid
      textColor: this._getCssColor('--text-secondary'),
      tooltipBg: this._getCssColor('--bg-panel'),
      tooltipTitle: this._getCssColor('--text-primary'),
      chartAreaBg: this._getCssColor('--brand-primary', isLight ? 0.08 : 0.15),
    };
  }

  public destroyChart(canvasId: string): void {
    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
      delete this.charts[canvasId];
      delete this.chartTypes[canvasId];
    }
  }

  public destroyAll(): void {
    Object.keys(this.charts).forEach((id) => this.destroyChart(id));
  }

  private _getContext(canvasId: string): CanvasRenderingContext2D | null {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      this.destroyChart(canvasId);
      return null;
    }

    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    return canvas.getContext('2d');
  }

  private _getCurrencyScaleOptions(
    currency: string,
    position: 'left' | 'right' = 'left',
    color?: string
  ): ScaleOptions<'linear'> {
    return {
      position,
      grid: { drawOnChartArea: position === 'left' }, // Avoid double grid lines
      ticks: {
        color,
        callback: (value: string | number) => this.formatter.currency(Number(value), currency),
      },
    };
  }

  private _baseOptions(styles: ThemeStyles): ChartOptions {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: styles.textColor,
            usePointStyle: true,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: styles.textColor },
        },
      },
    };
  }

  renderDashboardChart(
    canvasId: string,
    data: ChartDataInput,
    currency = 'USD'
  ): Chart | undefined {
    const ctx = this._getContext(canvasId);
    if (!ctx) return;

    this.chartTypes[canvasId] = 'dashboard';
    const s = this._getThemeStyles();

    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          {
            type: 'line' as ChartType,
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
            backgroundColor: this._getCssColor('--success', s.isLight ? 0.6 : 0.4),
            borderRadius: 6,
          },
          {
            label: 'Expenses',
            data: data.expenses,
            backgroundColor: this._getCssColor('--danger', s.isLight ? 0.6 : 0.4),
            borderRadius: 6,
          },
        ],
      },
      options: {
        ...this._baseOptions(s),
        scales: {
          y: this._getCurrencyScaleOptions(currency, 'left', s.textColor),
          y1: this._getCurrencyScaleOptions(currency, 'right', s.brandPrimary),
        },
      },
    });

    return this.charts[canvasId];
  }

  renderLineChart(
    canvasId: string,
    data: LineChartItem[],
    label = 'Balance',
    secondDataset: SecondaryDatasetConfig | null = null
  ): Chart | undefined {
    const ctx = this._getContext(canvasId);
    if (!ctx) return;

    this.chartTypes[canvasId] = 'line';
    const s = this._getThemeStyles();

    const datasets: any[] = [
      {
        label,
        data: data.map((d) => d.balance),
        borderColor: s.brandPrimary,
        backgroundColor: s.chartAreaBg,
        tension: 0.4,
        fill: true,
        borderWidth: 3,
        pointRadius: 0,
      },
    ];

    if (secondDataset) {
      datasets.push({
        label: secondDataset.label,
        data: data.map((d) => d.netWorth ?? 0),
        borderColor: s.brandSecondary,
        backgroundColor: this._getCssColor('--brand-secondary', s.isLight ? 0.05 : 0.1),
        tension: 0.4,
        fill: true,
        borderWidth: 3,
        pointRadius: 0,
        hidden: !!secondDataset.hidden,
      });
    }

    this.charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map((d) => d.date),
        datasets,
      },
      options: this._baseOptions(s),
    });

    return this.charts[canvasId];
  }

  renderForecastChart(
    canvasId: string,
    timeline: LineChartItem[],
    currency = 'USD'
  ): Chart | undefined {
    const ctx = this._getContext(canvasId);
    if (!ctx) return;

    this.chartTypes[canvasId] = 'forecast';
    const s = this._getThemeStyles();
    const today = new Date().toISOString().split('T')[0];

    this.charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: timeline.map((d) => d.date),
        datasets: [
          {
            label: 'Liquid Balance',
            data: timeline.map((d) => d.balance),
            borderColor: s.brandPrimary,
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx: canvasCtx, chartArea } = chart;
              if (!chartArea) return null;

              const gradient = canvasCtx.createLinearGradient(
                0,
                chartArea.bottom,
                0,
                chartArea.top
              );
              gradient.addColorStop(0, 'transparent');
              gradient.addColorStop(
                1,
                this._getCssColor('--brand-primary', s.isLight ? 0.15 : 0.2)
              );
              return gradient;
            },
            tension: 0.3,
            fill: true,
            borderWidth: 4,
            pointRadius: (context: any) => (timeline[context.dataIndex]?.date === today ? 6 : 0),
            pointBackgroundColor: s.brandPrimary,
            pointBorderColor: this._getCssColor('--bg-panel'),
            pointBorderWidth: 2,
            segment: {
              borderDash: (context: any) => (timeline[context.p0DataIndex]?.isFuture ? [] : [5, 5]),
            },
          },
          {
            label: 'Net Worth',
            data: timeline.map((d) => d.netWorth ?? 0),
            borderColor: s.brandSecondary,
            borderDash: [5, 5],
            tension: 0.3,
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
          },
        ],
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
              label: (context: any) => {
                return `${context.dataset.label}: ${this.formatter.currency(context.parsed.y, currency)}`;
              },
            },
          },
        },
        scales: {
          y: this._getCurrencyScaleOptions(currency, 'left', s.textColor),
          x: {
            ticks: {
              color: s.textColor,
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12,
            },
          },
        },
      },
    });

    return this.charts[canvasId];
  }
}
