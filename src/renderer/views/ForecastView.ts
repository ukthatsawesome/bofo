import { BaseView } from './BaseView';
import { $, UIUtils } from '../core/dom';
import { StatCard } from '../components/common/StatCard';
import { FeedbackItem } from '../components/common/FeedbackItem';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { InsightCard } from '../components/common/InsightCard';
import { ViewHeader } from '../components/common/ViewHeader';
import type { App } from '../core/app';

export class ForecastView extends BaseView {
  private range: number | 'custom' = 6;

  constructor(app: App) {
    super(app, 'forecast');
  }

  async onShow(): Promise<void> {
    if (!this.isInitialized) {
      this.renderBaseTemplate();
      this.setupListeners();
      this.isInitialized = true;
    }
    this.render();
  }

  renderBaseTemplate(): void {
    if (!this.element) return;
    this.element.innerHTML = `
            ${ViewHeader({
              title: 'Financial Forecast',
              subtitle: 'Analyze your future wealth based on historical patterns',
              actions: `<div id="forecast-range-container"></div>`,
            })}

            <div id="forecast-custom-dates" class="card mb-6 hidden">
                <div class="card-body flex-row gap-4 align-center">
                    <div class="form-group mb-0">
                        <label>Start Date</label>
                        <input type="date" id="f-start-date" class="form-control sm">
                    </div>
                    <div class="form-group mb-0">
                        <label>End Date</label>
                        <input type="date" id="f-end-date" class="form-control sm">
                    </div>
                </div>
            </div>

            <div id="forecast-stats-container" class="stats-grid mb-6"></div>

            <div class="forecast-content">
                <div id="forecast-insights-container" class="mb-6"></div>

                <div class="card">
                    <div class="card-header">
                        <h3><i data-lucide="line-chart"></i> Wealth Projection</h3>
                    </div>
                    <div class="card-body">
                        <div class="chart-container" style="height: 450px;">
                            <canvas id="forecastChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;
    this.refreshIcons();
  }

  /* -------------------- LISTENERS -------------------- */
  setupListeners(): void {
    $('#f-start-date')?.addEventListener('change', () => this.render());
    $('#f-end-date')?.addEventListener('change', () => this.render());
  }

  async render(): Promise<void> {
    const container = $('#forecast-range-container');
    if (container && !container.innerHTML.trim()) {
      container.innerHTML = SegmentedControl({
        id: 'forecast-range-toggle',
        onchange: 'app.views.forecast.handleRangeChange',
        options: [
          { label: '3M', value: '3', active: this.range === 3 },
          { label: '6M', value: '6', active: this.range === 6 || !this.range },
          { label: '12M', value: '12', active: this.range === 12 },
          { label: '24M', value: '24', active: this.range === 24 },
          { label: 'Custom', value: 'custom', active: this.range === 'custom' },
        ],
      });
    } else if (container) {
      container.querySelectorAll('.segment').forEach((btn) => {
        const el = btn as HTMLElement;
        el.classList.toggle('active', el.dataset.value === (this.range || 6).toString());
      });
    }

    let months = 6;
    let customRange: { start: Date; end: Date } | null = null;

    if (this.range === 'custom') {
      UIUtils.setHidden('#forecast-custom-dates', false);
      // Set default custom dates if empty
      if (!($('#f-start-date') as HTMLInputElement).value) {
        const start = new Date();
        start.setMonth(start.getMonth() - 3);
        ($('#f-start-date') as HTMLInputElement).value = start.toISOString().split('T')[0];
      }
      if (!($('#f-end-date') as HTMLInputElement).value) {
        const end = new Date();
        end.setMonth(end.getMonth() + 6);
        ($('#f-end-date') as HTMLInputElement).value = end.toISOString().split('T')[0];
      }

      const start = new Date(($('#f-start-date') as HTMLInputElement).value);
      const end = new Date(($('#f-end-date') as HTMLInputElement).value);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

      // Calculate months for the engine
      months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      customRange = { start, end };
    } else {
      UIUtils.setHidden('#forecast-custom-dates', true);
      months = typeof this.range === 'number' ? this.range : 6;
    }

    const forecast = await this.getForecast(months);

    // Handle empty/invalid forecast
    if (!forecast) {
      console.warn('No forecast data received');
      return;
    }

    // If custom range, filter the timeline for the chart
    let timeline = forecast.timeline || [];
    if (customRange && timeline.length > 0) {
      const startStr = customRange.start.toISOString().split('T')[0];
      const endStr = customRange.end.toISOString().split('T')[0];
      timeline = timeline.filter((d: any) => d.date >= startStr && d.date <= endStr);
    }

    this.renderSummary(forecast.summary || {});
    this.renderInsights(forecast.insights || []);
    this.renderChart(timeline);

    this.refreshIcons('#forecast-stats-container');
    this.refreshIcons('#forecast-insights-container');
  }

  handleRangeChange(val: string): void {
    this.range = val === 'custom' ? 'custom' : parseInt(val);
    this.render();
  }

  /* -------------------- DATA -------------------- */
  async getForecast(months: number): Promise<any> {
    return window.api.calculateForecast({
      transactions: this.app.state.transactions,
      accounts: this.app.state.accounts,
      recurringCharges: this.app.state.recurringCharges,
      months,
    });
  }

  /* -------------------- UI SECTIONS -------------------- */

  renderSummary(summary: any): void {
    const { formatter } = this.app;
    const container = $('#forecast-stats-container');
    if (!container) return;

    // Default values
    const totalIncome = summary.totalIncome || 0;
    const totalExpense = summary.totalExpense || 0;
    const netSavings = summary.netSavings || 0;
    const runway = summary.runway ?? 0;

    container.innerHTML = `
            ${StatCard({
              label: 'Projected Income',
              value: formatter.formatCurrency(totalIncome),
              icon: 'trending-up',
              type: 'income',
            })}
            ${StatCard({
              label: 'Projected Expense',
              value: formatter.formatCurrency(totalExpense),
              icon: 'trending-down',
              type: 'expense',
            })}
            ${StatCard({
              label: 'Projected Savings',
              value: formatter.formatCurrency(netSavings),
              icon: 'piggy-bank',
            })}
            ${StatCard({
              label: 'Runway',
              value: runway === Infinity ? 'Infinite' : (runway || 0).toFixed(1) + ' Months',
              icon: 'clock',
            })}
        `;
  }

  renderInsights(insights: any[]): void {
    const container = $('#forecast-insights-container');
    if (!container) return;

    const content = insights
      .map((i) =>
        FeedbackItem({
          type: i.type,
          icon:
            i.type === 'danger'
              ? 'x-circle'
              : i.type === 'warning'
                ? 'alert-triangle'
                : 'check-circle',
          title: i.title,
          message: i.message,
        })
      )
      .join('');

    container.innerHTML = InsightCard({
      title: 'Forecast Intelligence',
      message: content,
      icon: 'cpu',
    });
  }

  renderChart(timeline: any[]): void {
    this.app.chartManager.renderForecastChart('forecastChart', timeline);
  }
}
