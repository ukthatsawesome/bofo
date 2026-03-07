import { BaseController } from './BaseController';
import { Route } from '../router';
import { Logger } from '../../utils/logger';
import { AI_DEFAULTS, AIConfigService } from '../../config/AIConfig';

export class BofoAIController extends BaseController {
  private getAIService() {
    return require('../../services/aiService').aiService;
  }

  private async syncAIService() {
    const ai = this.getAIService();

    await ai.syncFromConfig();
    const config = await AIConfigService.getEffectiveConfig();

    return {
      enabled: config.enabled,
      url: ai.baseUrl,
      model: ai.model,
      promptTx: ai.promptTx,
      promptInsight: ai.promptInsight,
      promptChat: ai.promptChat,
    };
  }

  registerRoutes(): Record<string, Route> {
    return {
      'get-ai-settings': async () => {
        try {
          return await this.syncAIService();
        } catch (e) {
          return { enabled: false, url: AI_DEFAULTS.URL, model: AI_DEFAULTS.MODEL };
        }
      },

      'get-ai-defaults': () => {
        try {
          return this.getAIService().DEFAULTS || {};
        } catch (e) {
          return {};
        }
      },

      'save-ai-settings': async (_, settings) => {
        try {
          await this.getFinanceModel().saveAISettings(settings);
          await this.syncAIService();
          return { success: true };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      },

      'get-ai-models': async (_, url) => {
        try {
          const ai = this.getAIService();
          if (url) ai.baseUrl = url;
          return await ai.getInstalledModels();
        } catch (e: any) {
          Logger.warn('[IPC] get-ai-models failed:', e.message);
          return [];
        }
      },

      'check-ai-connection': async (_, url?: string) => {
        try {
          const ai = this.getAIService();
          if (url) {
            await ai.setConfig(url, ai.model);
          } else {
            await ai.syncFromConfig();
          }
          return await ai.checkConnection();
        } catch (e) {
          return false;
        }
      },

      'get-ai-health': async () => {
        try {
          const ai = this.getAIService();
          const health = ai.getHealthStatus();
          return {
            ...health,
            baseUrl: ai.baseUrl,
            model: ai.model,
          };
        } catch (e: any) {
          return { isConnected: false, lastError: e.message, circuitOpen: true };
        }
      },

      'parse-transaction-ai': async (_, { text, categories, accounts }) => {
        try {
          const corrections = await this.getFinanceModel().getAICategoryCorrections(5);
          const result = await this.getAIService().parseTransactionFromText(
            text,
            categories || [],
            accounts || [],
            null,
            corrections
          );
          return { success: true, data: result };
        } catch (e: any) {
          Logger.warn('[IPC] parse-transaction-ai failed:', e.message);

          return { success: false, error: e.message, data: null };
        }
      },

      'get-ai-insight': async (_, summary) => {
        try {
          return await this.getAIService().getFinancialInsight(summary);
        } catch (e: any) {
          Logger.warn('[IPC] get-ai-insight failed:', e.message);
          return 'Keep tracking your spending to stay on top of your goals!';
        }
      },

      'chat-sandbox': async (event, { text, context }) => {
        try {
          const streamCallback = event?.sender
            ? (chunk: any) => event.sender.send('chat-sandbox-chunk', chunk)
            : null;

          return await this.getAIService().chatSandbox(text, context, null, streamCallback);
        } catch (e: any) {
          Logger.warn('[IPC] chat-sandbox failed:', e.message);
          if (e.message.includes('timed out')) return 'The AI is taking too long to respond.';
          return "I'm having trouble connecting to the AI engine.";
        }
      },
    };
  }
}
