export interface OllamaModel {
  name: string;
  modified_at?: string;
  size?: number;
}

export interface ParsedTransaction {
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  category: string;
  description: string;
  date: string;
  from_account?: string;
  to_account?: string;
}

export interface SandboxContext {
  stats: Record<string, unknown>;
  simulation: unknown[];
  rules: Record<string, unknown>;
}

export type ChunkCallback = (chunk: string) => void;

interface DefaultPrompts {
  promptTx: string;
  promptInsight: string;
  promptChat: string;
}

/**
 * AI Service using Ollama
 *
 * Handles communication with local Ollama instance for:
 * - Transaction Parsing
 * - Financial Insights
 * - Sandbox Chat Simulation
 *
 * Features:
 * - Circuit Breaker for reliability
 * - Retry Logic with exponential backoff
 * - Connection Health Monitoring
 */
class AIService {
  private baseUrl: string;
  private model: string;
  public readonly DEFAULTS: DefaultPrompts;

  public promptTx: string | null;
  public promptInsight: string | null;
  public promptChat: string | null;

  private config = {
    timeout: 30000,
    maxRetries: 2,
    retryDelay: 1000,
    retryBackoff: 2,
    circuitBreakerThreshold: 3,
    circuitBreakerReset: 60000,
  };

  private _circuit = {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
  };

  private _health = {
    lastCheck: 0,
    isConnected: false,
    lastError: null as string | null,
  };

  constructor() {
    this.baseUrl = 'http://127.0.0.1:11434';
    this.model = 'gemma3:4b';

    this.DEFAULTS = {
      promptTx: `You are a smart financial engine. Parse this input: "{{input}}"
Current Date: {{date}}

Key Definitions:
- Categories: [{{categories}}]
- Accounts: [{{accounts}}]

Tasks:
1. Determine Type: 'income', 'expense', or 'transfer'.
2. Extract Amount: number only.
3. FOR EXPENSES/INCOME: Map to the ONE most appropriate Category from the list above.
4. FOR TRANSFERS: Identify 'from_account' and 'to_account' if mentioned (fuzzy match).
5. Create Description: A short, clean summary.

Return JSON ONLY:
{
    "type": "expense" | "income" | "transfer",
    "amount": 123.45,
    "category": "Exact Category Name",
    "description": "Short Description",
    "date": "YYYY-MM-DD",
    "from_account": "Account Name",
    "to_account": "Account Name"
}`,
      promptInsight: `You are Bofo, a precise financial analyst.
Data: {{data}}

Task: Provide ONE single, highly accurate sentence about the user's financial status or a key trend.
Constraints:
- STRICTLY one sentence.
- NO markdown (no **, no #).
- Use HTML <b>tags</b> for emphasis on numbers or key terms.
- Be direct and professional.`,
      promptChat: `You are Bofo, a professional financial analyst and simulation expert. 
Your goal is to help users explore "What-If" financial scenarios.

Current Context:
- Scenario Stats: {{stats}}
- Active Hypotheticals: {{hypotheticals}}
- Safety Rules: {{rules}}

User Query: "{{input}}"

Instructions:
1. Provide a concise, helpful response.
2. If you need to modify the simulation (add items, update rules, or undo), append a JSON block at the end.
3. Use this JSON format for actions:
\`\`\`json
{
  "type": "ADD_ITEM",
  "item": { "desc": "Description", "amount": 100, "type": "expense", "frequency": "monthly" }
}
OR
{
  "type": "UPDATE_RULE",
  "rule": "min_balance",
  "value": 1000
}
OR
{
  "type": "UNDO"
}
\`\`\`
4. Keep the text part short. If adding an item, say "Adding [item] to your scenario...". If reverting, say "Reverting your last change...".`,
    };

    this.promptTx = null;
    this.promptInsight = null;
    this.promptChat = null;
  }

  async setConfig(url: string, model: string): Promise<void> {
    this.baseUrl = url || 'http://127.0.0.1:11434';
    this.model = model || 'gemma3:4b';
    this._resetCircuit();
  }

  setTimeoutConfig(options: Partial<typeof this.config>): void {
    Object.assign(this.config, options);
  }

  // =========================================================================
  // CIRCUIT BREAKER & RELIABILITY
  // =========================================================================

  private _resetCircuit(): void {
    this._circuit = { failures: 0, lastFailure: 0, isOpen: false };
  }

  private _checkCircuit(): boolean {
    if (!this._circuit.isOpen) return true;

    const timeSinceFailure = Date.now() - this._circuit.lastFailure;
    if (timeSinceFailure >= this.config.circuitBreakerReset) {
      this._resetCircuit();
      console.log('[AI] Circuit breaker reset - retrying connection');
      return true;
    }

    console.log(
      `[AI] Circuit breaker open - ${Math.ceil((this.config.circuitBreakerReset - timeSinceFailure) / 1000)}s until retry`
    );
    return false;
  }

  private _recordFailure(error: Error): void {
    this._circuit.failures++;
    this._circuit.lastFailure = Date.now();
    this._health.lastError = error.message;
    this._health.isConnected = false;

    if (this._circuit.failures >= this.config.circuitBreakerThreshold) {
      this._circuit.isOpen = true;
      console.log('[AI] Circuit breaker opened due to repeated failures');
    }
  }

  private _recordSuccess(): void {
    this._circuit.failures = 0;
    this._circuit.isOpen = false;
    this._health.isConnected = true;
    this._health.lastError = null;
  }

  private async _fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout = this.config.timeout
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout / 1000}s`);
      }
      throw error;
    }
  }

  private async _withRetry<T>(fn: () => Promise<T>, retries = this.config.maxRetries): Promise<T> {
    let lastError: Error | unknown;
    let delay = this.config.retryDelay;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await fn();
        this._recordSuccess();
        return result;
      } catch (error) {
        lastError = error;
        console.warn(`[AI] Attempt ${attempt + 1} failed:`, (error as Error).message);

        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= this.config.retryBackoff;
        }
      }
    }

    this._recordFailure(lastError as Error);
    throw lastError;
  }

  // =========================================================================
  // API CALLS
  // =========================================================================

  private async _callApi(
    endpoint: string,
    body: Record<string, unknown>,
    isStreaming = false
  ): Promise<Response> {
    if (!this._checkCircuit()) {
      throw new Error('AI service temporarily unavailable. Please try again later.');
    }

    const url = `${this.baseUrl}/api/${endpoint}`;

    const makeRequest = async () => {
      const response = await this._fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          ...body,
          stream: isStreaming,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API Error (${response.status}): ${error}`);
      }

      return response;
    };

    if (!isStreaming) {
      return await this._withRetry(makeRequest);
    } else {
      // Streaming requests don't retry
      try {
        const result = await makeRequest();
        this._recordSuccess();
        return result;
      } catch (error) {
        this._recordFailure(error as Error);
        throw error;
      }
    }
  }

  private _replaceTemplate(template: string, data: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      result = result.split(`{{${key}}}`).join(value);
    }
    return result;
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await this._fetchWithTimeout(
        `${this.baseUrl}/api/tags`,
        { method: 'GET' },
        5000
      );
      const isOk = response.ok;
      this._health.lastCheck = Date.now();
      this._health.isConnected = isOk;
      if (isOk) this._recordSuccess();
      return isOk;
    } catch (error) {
      this._health.lastCheck = Date.now();
      this._health.isConnected = false;
      this._health.lastError = (error as Error).message;
      return false;
    }
  }

  getHealthStatus() {
    return {
      isConnected: this._health.isConnected,
      lastCheck: this._health.lastCheck,
      lastError: this._health.lastError,
      circuitOpen: this._circuit.isOpen,
      failureCount: this._circuit.failures,
    };
  }

  async getInstalledModels(): Promise<OllamaModel[]> {
    try {
      const response = await this._fetchWithTimeout(
        `${this.baseUrl}/api/tags`,
        { method: 'GET' },
        10000
      );
      if (!response.ok) return [];
      const data = (await response.json()) as { models?: OllamaModel[] };
      this._recordSuccess();
      return data.models || [];
    } catch (error) {
      console.warn('[AI] Failed to fetch models:', (error as Error).message);
      return [];
    }
  }

  async parseTransactionFromText(
    text: string,
    categories: string[],
    accountNames: string[] = [],
    promptTemplate: string | null = null,
    corrections: { original: string; corrected: string; description: string }[] = []
  ): Promise<ParsedTransaction> {
    const template = promptTemplate || this.promptTx || this.DEFAULTS.promptTx;

    // Build corrections section for few-shot learning
    let correctionsSection = '';
    if (corrections.length > 0) {
      correctionsSection = '\n\nLEARN FROM PAST CORRECTIONS (prioritize these patterns):\n';
      correctionsSection += corrections
        .map((c, i) => `${i + 1}. "${c.description}" was "${c.original}" → should be "${c.corrected}"`)
        .join('\n');
      correctionsSection += '\n';
    }

    const prompt = this._replaceTemplate(template, {
      input: text,
      date: new Date().toISOString().split('T')[0],
      categories: categories.join(', '),
      accounts: accountNames.join(', '),
    }) + correctionsSection;

    try {
      const response = await this._callApi('generate', { prompt, format: 'json' });
      const data = (await response.json()) as { response: string };
      return JSON.parse(data.response) as ParsedTransaction;
    } catch (error) {
      console.error('AI Parse Failed:', error);
      throw error;
    }
  }

  async getFinancialInsight(
    summaryData: Record<string, unknown>,
    promptTemplate: string | null = null
  ): Promise<string> {
    const template = promptTemplate || this.promptInsight || this.DEFAULTS.promptInsight;
    const prompt = this._replaceTemplate(template, {
      data: JSON.stringify(summaryData),
    });

    try {
      const response = await this._callApi('generate', { prompt });
      const data = (await response.json()) as { response: string };
      return data.response.replace(/^"|"$/g, '').trim();
    } catch (error: any) {
      console.warn('[AI] Insight generation failed, using fallback:', error.message);
      // Simple fallback logic since we don't have the full FallbackGenerator linked here
      return 'Keep tracking your spending to stay on top of your goals!';
    }
  }

  async chatSandbox(
    userText: string,
    context: SandboxContext,
    promptTemplate: string | null = null,
    onChunk: ChunkCallback | null = null
  ): Promise<string> {
    const template = promptTemplate || this.promptChat || this.DEFAULTS.promptChat;
    const prompt = this._replaceTemplate(template, {
      stats: JSON.stringify(context.stats),
      hypotheticals: JSON.stringify(context.simulation),
      rules: JSON.stringify(context.rules),
      input: userText,
    });

    const isStreaming = typeof onChunk === 'function';

    try {
      const response = await this._callApi('generate', { prompt }, isStreaming);

      if (isStreaming && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line) as { response?: string; done?: boolean };
              if (data.response) {
                fullText += data.response;
                onChunk!(data.response);
              }
              if (data.done) return fullText;
            } catch {
              // Ignore partial JSON lines
            }
          }
        }
        return fullText;
      } else {
        const data = (await response.json()) as { response: string };
        return data.response;
      }
    } catch (error: any) {
      console.error('[AI] Chat sandbox failed:', error.message);
      if (error.message.includes('timed out')) {
        return 'The AI is taking too long to respond. Try a simpler question or check if Ollama is running.';
      } else if (error.message.includes('temporarily unavailable')) {
        return 'The AI service is temporarily unavailable. It will automatically retry in about a minute.';
      }
      return "I'm having trouble connecting to the simulation engine.";
    }
  }
}

export const aiService = new AIService();
