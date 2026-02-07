
import { BaseController } from './BaseController';
import { Route } from '../router';

export class SettingsController extends BaseController {
  registerRoutes(): Record<string, Route> {
    return {
      'get-settings': () => this.getFinanceModel().getAllSettings(),
      'update-setting': (_, { key, value }) => this.getFinanceModel().updateSetting(key, value),
      'save-settings': (_, settings) => this.getFinanceModel().saveSettings(settings),
    };
  }
}
