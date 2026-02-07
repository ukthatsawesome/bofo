
import { BaseController } from './BaseController';
import { Route } from '../router';

export class ExchangeRateController extends BaseController {

    private getCurrencyService() {
        return require('../../services/currencyService').CurrencyService;
    }

    registerRoutes(): Record<string, Route> {
        return {
            'get-exchange-rates': () => this.getFinanceModel().getExchangeRates(),
            'get-exchange-rate': (_, { from, to }) => this.getFinanceModel().getExchangeRate(from, to),

            'set-exchange-rate': (_, { from, to, rate, source }) =>
                this.getFinanceModel().setExchangeRate(from, to, rate, source || 'manual'),

            'delete-exchange-rate': (_, id) => this.getFinanceModel().delete('exchangeRate', id, true),

            'convert-currency': (_, { amount, from, to }) =>
                this.getFinanceModel().convertCurrency(amount, from, to),

            'get-used-currencies': () => this.getFinanceModel().getUsedCurrencies(),

            'get-accounts-converted': (_, baseCurrency) =>
                this.getFinanceModel().getAccountsWithConvertedBalances(baseCurrency),

            'get-rate-sync-status': () => this.getFinanceModel().getRateSyncStatus(),

            'get-total-balance': (_, baseCurrency) =>
                this.getFinanceModel().getTotalBalanceInBaseCurrency(baseCurrency),

            'sync-exchange-rates': async (_, { provider, baseCurrency, customUrl }) => {
                try {
                    const model = this.getFinanceModel();
                    const CurrencyService = this.getCurrencyService();

                    const rates = await CurrencyService.fetchRates(provider, baseCurrency, customUrl);
                    const usedCurrencies = await model.getUsedCurrencies();
                    usedCurrencies.push(baseCurrency);
                    const relevantRates = CurrencyService.filterRelevantRates(rates, usedCurrencies);

                    await model.setExchangeRatesBulk(relevantRates, 'api');
                    await model.updateSetting('currency_last_sync', new Date().toISOString());

                    return {
                        success: true,
                        message: `Synced ${relevantRates.length} exchange rates`,
                        ratesUpdated: relevantRates.length,
                    };
                } catch (err: any) {
                    return { success: false, message: err.message };
                }
            },

            'test-currency-api': async (_, { provider, baseCurrency, customUrl }) => {
                try {
                    return await this.getCurrencyService().testConnection(provider, baseCurrency, customUrl);
                } catch (err: any) {
                    return { success: false, message: err.message };
                }
            },

            'get-currency-providers': () => {
                return this.getCurrencyService().getProviders();
            },
        };
    }
}
