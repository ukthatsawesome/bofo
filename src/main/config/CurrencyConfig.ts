import { FinanceModel } from '../models/finance';
import { SETTING_KEYS } from '../../shared/settings/keys';
import { DEFAULT_CURRENCY, DEFAULT_CURRENCY_PROVIDER } from '../../shared/settings/defaults';

export interface CurrencyConfig {
  base: string;
  provider: string;
  customUrl?: string;
  autoSync: boolean;
  lastSync?: string;
}

export class CurrencyConfigService {
  static async getEffectiveConfig(): Promise<CurrencyConfig> {
    const settings = await FinanceModel.getAllSettings();

    return {
      base: settings[SETTING_KEYS.CURRENCY.BASE] || DEFAULT_CURRENCY,
      provider: settings[SETTING_KEYS.CURRENCY.API_PROVIDER] || DEFAULT_CURRENCY_PROVIDER,
      customUrl: settings[SETTING_KEYS.CURRENCY.CUSTOM_URL],
      autoSync: settings[SETTING_KEYS.CURRENCY.AUTO_SYNC] === 'true',
      lastSync: settings[SETTING_KEYS.CURRENCY.LAST_SYNC],
    };
  }
}
