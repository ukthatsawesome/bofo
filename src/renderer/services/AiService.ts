import {
  AiAnalysisResponseSchema,
  type AiAnalysisResponse,
  type AiInsight,
} from '../../shared/schemas';
import { api } from '../core/lib/api';
import { FallbackGenerator } from '../core/lib/ai/FallbackGenerator';
import { aiInsightCache } from '../core/lib/ai/InsightCache';

/**
 * Functional AI Client
 * Handles communication with the backend AI service (Ollama) via IPC.
 * Uses Zod for strict validation and FallbackGenerator for reliability.
 */
export const AiService = {
  /**
   * Analyze text query or data context
   */
  async analyze(prompt: string, context?: any): Promise<AiAnalysisResponse> {
    try {
      const contextJson = context ? JSON.stringify(context) : '';
      const fullPrompt = `${prompt}\n\nContext: ${contextJson}`;

      const responseJson = await api.aiChat(fullPrompt);

      try {
        const parsed = JSON.parse(responseJson);

        const valid = AiAnalysisResponseSchema.parse(parsed);
        return valid;
      } catch (parseError) {
        console.warn('[AiService] JSON parse failed or schema mismatch:', parseError);
        console.warn('[AiService] Raw response:', responseJson);

        return this.generateFallback(context);
      }
    } catch (ipcError) {
      console.error('[AiService] IPC failed:', ipcError);
      return this.generateFallback(context);
    }
  },

  /**
   * Generate fallback insights based on context data type
   */
  generateFallback(context: any): AiAnalysisResponse {
    if (!context) return { insights: [], summary: 'Unable to analyze.' };

    if ('balance' in context && 'monthIncome' in context) {
      const text = FallbackGenerator.generateDashboardInsight(context);
      return {
        insights: [
          {
            type: 'info',
            title: 'Dashboard Analysis',
            message: text,
            priority: 1,
          },
        ],
        summary: text,
      };
    }

    return {
      insights: [
        {
          type: 'warning',
          title: 'AI Unavailable',
          message: 'AI service is offline. Showing cached or fallback data.',
          priority: 5,
        },
      ],
      summary: 'AI Unavailable',
    };
  },
};
