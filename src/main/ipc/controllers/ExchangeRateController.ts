import { BaseController } from './BaseController';
import { Route } from '../router';
import { SETTING_KEYS } from '../../../shared/settings/keys';
import { CurrencyConfigService } from '../../config/CurrencyConfig';

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

          const config = await CurrencyConfigService.getEffectiveConfig();

          const p = provider || config.provider;
          const b = baseCurrency || config.base;
          const u = customUrl || config.customUrl;

          const rates = await CurrencyService.fetchRates(p, b, u);
          const usedCurrencies = await model.getUsedCurrencies();
          usedCurrencies.push(b);
          const relevantRates = CurrencyService.filterRelevantRates(rates, usedCurrencies);

          await model.setExchangeRatesBulk(relevantRates, 'api');
          await model.updateSetting(SETTING_KEYS.CURRENCY.LAST_SYNC, new Date().toISOString());

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
          const config = await CurrencyConfigService.getEffectiveConfig();
          const p = provider || config.provider;
          const b = baseCurrency || config.base;
          const u = customUrl || config.customUrl;

          return await this.getCurrencyService().testConnection(p, b, u);
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
