import { FinanceModel } from '../models/finance';
import { SETTING_KEYS } from '../../shared/settings/keys';
import { DEFAULTS, DEFAULT_AI_URL, DEFAULT_AI_MODEL } from '../../shared/settings/defaults';

export interface AIConfig {
  enabled: boolean;
  url: string;
  model: string;
  prompts: {
    tx: string;
    insight: string;
    chat: string;
  };
}

export const AI_DEFAULTS = {
  URL: DEFAULT_AI_URL,
  MODEL: DEFAULT_AI_MODEL,
  TIMEOUT: DEFAULTS.AI.TIMEOUT_MS,
};

export class AIConfigService {
  static async getEffectiveConfig(): Promise<AIConfig> {
    const settings = await FinanceModel.getAllSettings();

    return {
      enabled: settings[SETTING_KEYS.AI.ENABLED] === 'true',
      url: settings[SETTING_KEYS.AI.URL] || AI_DEFAULTS.URL,
      model: settings[SETTING_KEYS.AI.MODEL] || AI_DEFAULTS.MODEL,
      prompts: {
        tx: settings[SETTING_KEYS.AI.PROMPT_TX] || '',
        insight: settings[SETTING_KEYS.AI.PROMPT_INSIGHT] || '',
        chat: settings[SETTING_KEYS.AI.PROMPT_CHAT] || '',
      },
    };
  }
}
