import { BaseController } from './BaseController';
import { Route } from '../router';
import { validateSetting } from '../../../shared/settings/schema';
import { AIConfigService } from '../../config/AIConfig';
import { CurrencyConfigService } from '../../config/CurrencyConfig';
import { RemoteConfigService } from '../../config/RemoteConfig';

export class SettingsController extends BaseController {
  registerRoutes(): Record<string, Route> {
    return {
      'get-settings': () => this.getFinanceModel().getAllSettings(),

      'update-setting': (_, { key, value }) => {
        // Validate value against schema
        validateSetting(key, value);
        return this.getFinanceModel().updateSetting(key, value);
      },

      'save-settings': (_, settings) => { // settings is Record<string, any>
        // Validate all keys in the object
        for (const [key, value] of Object.entries(settings)) {
          validateSetting(key, value);
        }
        return this.getFinanceModel().saveSettings(settings);
      },

      'get-effective-config': async () => {
        const [ai, currency, remote] = await Promise.all([
          AIConfigService.getEffectiveConfig(),
          CurrencyConfigService.getEffectiveConfig(),
          RemoteConfigService.getEffectiveConfig()
        ]);

        return {
          ai,
          currency,
          remote
        };
      }
    };
  }
}
