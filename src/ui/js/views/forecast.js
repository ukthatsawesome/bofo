class ForecastView extends BaseView {
    constructor(app) {
        super(app, 'forecast');
    }

    async onShow() {
        this.setupListeners();
        this.render();
    }

    setupListeners() {
        $('#forecast-range')?.addEventListener('change', () => this.render());
    }

    async render() {
        const rangeInput = $('#forecast-range');
        if (!rangeInput) return;

        const range = parseInt(rangeInput.value);
        const { state, chartManager, formatter } = this.app;

        const forecast = await window.api.calculateForecast({ transactions: state.transactions, months: range });

        this.setText('f-projected-income', formatter.formatCurrency(forecast.summary.totalIncome));
        this.setText('f-projected-expense', formatter.formatCurrency(forecast.summary.totalExpense));
        this.setText('f-projected-savings', formatter.formatCurrency(forecast.summary.netSavings));
        this.setText('f-runway', forecast.summary.runway === Infinity
            ? 'Infinite'
            : forecast.summary.runway.toFixed(1) + ' Months');

        const icons = { success: 'check-circle', warning: 'alert-triangle', danger: 'x-circle' };

        UIUtils.renderList('forecast-insights-list', forecast.insights, i => `
            <div class="forecast-insight-item ${i.type}">
                <div class="icon"><i data-lucide="${icons[i.type]}"></i></div>
                <div class="insight-text">
                    <h4>${i.title}</h4>
                    <p>${i.message}</p>
                </div>
            </div>
        `, 'No specific insights for this period.');

        chartManager.renderForecastChart('forecastChart', forecast.timeline);
        this.refreshIcons();
    }
}

window.ForecastView = ForecastView;
