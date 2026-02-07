
import { AiAnalysisResponseSchema, type AiAnalysisResponse, type AiInsight } from '../../shared/schemas';
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
        // Check cache (optional, if we cache by prompt?)
        // For now, cache is simpler: storing last insight per context type

        try {
            // Validate context (serialize)
            const contextJson = context ? JSON.stringify(context) : '';
            const fullPrompt = `${prompt}\n\nContext: ${contextJson}`;

            // Call IPC
            const responseJson = await window.api.aiChat(fullPrompt);

            // Parse response
            try {
                const parsed = JSON.parse(responseJson);
                // Validate with Zod
                const valid = AiAnalysisResponseSchema.parse(parsed);
                return valid;
            } catch (parseError) {
                console.warn('[AiService] JSON parse failed or schema mismatch:', parseError);
                console.warn('[AiService] Raw response:', responseJson);
                // Attempt to salvage strict JSON from markdown block ```json ... ```?
                // Or just fallback.
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
        // Identify context type (heuristic)
        if (!context) return { insights: [], summary: 'Unable to analyze.' };

        // If context has 'balance', 'monthIncome', it's dashboard
        if ('balance' in context && 'monthIncome' in context) {
            const text = FallbackGenerator.generateDashboardInsight(context);
            return {
                insights: [{
                    type: 'info',
                    title: 'Dashboard Analysis',
                    message: text,
                    priority: 1
                }],
                summary: text
            };
        }

        // Add other heuristics...

        return {
            insights: [{
                type: 'warning',
                title: 'AI Unavailable',
                message: 'AI service is offline. Showing cached or fallback data.',
                priority: 5
            }],
            summary: 'AI Unavailable'
        };
    }
};
