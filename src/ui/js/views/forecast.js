class ForecastView extends BaseView {
    constructor(app) {
        super(app, 'forecast');
        this.isInitialized = false;
    }

    async onShow() {
        if (!this.isInitialized) {
            this.setupListeners();
            this.isInitialized = true;
        }
        this.render();
    }

    /* -------------------- LISTENERS -------------------- */

    setupListeners() {
        const toggleButtons = $$('#forecast-range-toggle .toggle-btn');
        toggleButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                toggleButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (btn.dataset.value === 'custom') {
                    UIUtils.setHidden('#forecast-custom-dates', false);
                    // Set default custom dates if empty
                    if (!$('#f-start-date').value) {
                        const start = new Date();
                        start.setMonth(start.getMonth() - 3);
                        $('#f-start-date').value = start.toISOString().split('T')[0];
                    }
                    if (!$('#f-end-date').value) {
                        const end = new Date();
                        end.setMonth(end.getMonth() + 6);
                        $('#f-end-date').value = end.toISOString().split('T')[0];
                    }
                } else {
                    UIUtils.setHidden('#forecast-custom-dates', true);
                    this.render();
                }
            });
        });

        $('#f-start-date')?.addEventListener('change', () => this.render());
        $('#f-end-date')?.addEventListener('change', () => this.render());
    }

    /* -------------------- RENDER -------------------- */

    async render() {
        const activeBtn = $('#forecast-range-toggle .toggle-btn.active');
        if (!activeBtn) return;

        let months = 6;
        let customRange = null;

        if (activeBtn.dataset.value === 'custom') {
            const start = new Date($('#f-start-date').value);
            const end = new Date($('#f-end-date').value);
            if (isNaN(start) || isNaN(end)) return;

            // Calculate months for the engine
            months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
            customRange = { start, end };
        } else {
            months = parseInt(activeBtn.dataset.value, 10);
        }

        const forecast = await this.getForecast(months);

        // If custom range, filter the timeline for the chart
        if (customRange) {
            const startStr = customRange.start.toISOString().split('T')[0];
            const endStr = customRange.end.toISOString().split('T')[0];
            forecast.timeline = forecast.timeline.filter(d => d.date >= startStr && d.date <= endStr);
        }

        this.renderSummary(forecast.summary);
        this.renderInsights(forecast.insights);
        this.renderChart(forecast.timeline);

        this.refreshIcons();
    }

    /* -------------------- DATA -------------------- */

    async getForecast(months) {
        return window.api.calculateForecast({
            transactions: this.app.state.transactions,
            accounts: this.app.state.accounts,
            months
        });
    }

    /* -------------------- UI SECTIONS -------------------- */

    renderSummary(summary) {
        const { formatter } = this.app;

        this.setText('f-projected-income', formatter.formatCurrency(summary.totalIncome));
        this.setText('f-projected-expense', formatter.formatCurrency(summary.totalExpense));
        this.setText('f-projected-savings', formatter.formatCurrency(summary.netSavings));

        this.setText(
            'f-runway',
            summary.runway === Infinity
                ? 'Infinite'
                : summary.runway.toFixed(1) + ' Months'
        );
    }

    renderInsights(insights) {
        const icons = {
            success: 'check-circle',
            warning: 'alert-triangle',
            danger: 'x-circle'
        };

        UIUtils.renderList(
            'forecast-insights-list',
            insights,
            i => `
                <div class="forecast-insight-item ${i.type}">
                    <div class="icon">
                        <i data-lucide="${icons[i.type]}"></i>
                    </div>
                    <div class="insight-text">
                        <h4>${i.title}</h4>
                        <p>${i.message}</p>
                    </div>
                </div>
            `,
            'No specific insights for this period.'
        );
    }

    renderChart(timeline) {
        this.app.chartManager.renderForecastChart('forecastChart', timeline);
    }
}

window.ForecastView = ForecastView;
