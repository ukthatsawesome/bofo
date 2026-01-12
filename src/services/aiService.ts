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

type ChunkCallback = (chunk: string) => void;

interface DefaultPrompts {
    promptTx: string;
    promptInsight: string;
    promptChat: string;
}

class AIService {
    private baseUrl: string;
    private model: string;
    private readonly DEFAULTS: DefaultPrompts;

    public promptTx: string | null;
    public promptInsight: string | null;
    public promptChat: string | null;

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
4. Keep the text part short. If adding an item, say "Adding [item] to your scenario...". If reverting, say "Reverting your last change...".`
        };

        this.promptTx = null;
        this.promptInsight = null;
        this.promptChat = null;
    }

    async setConfig(url: string, model: string): Promise<void> {
        this.baseUrl = url || 'http://127.0.0.1:11434';
        this.model = model || 'gemma3:4b';
    }

    private async _callApi(endpoint: string, body: Record<string, unknown>, isStreaming = false): Promise<Response> {
        const url = `${this.baseUrl}/api/${endpoint}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    ...body,
                    stream: isStreaming
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Ollama API Error (${response.status}): ${error}`);
            }

            return response;
        } catch (error) {
            console.error(`Ollama API Call Failed [${endpoint}]:`, error);
            throw error;
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
            const response = await fetch(`${this.baseUrl}/api/tags`);
            return response.ok;
        } catch {
            return false;
        }
    }

    async getInstalledModels(): Promise<OllamaModel[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            if (!response.ok) return [];
            const data = await response.json() as { models?: OllamaModel[] };
            return data.models || [];
        } catch {
            return [];
        }
    }

    async parseTransactionFromText(
        text: string,
        categories: string[],
        accountNames: string[] = [],
        promptTemplate: string | null = null
    ): Promise<ParsedTransaction> {
        const template = promptTemplate || this.promptTx || this.DEFAULTS.promptTx;
        const prompt = this._replaceTemplate(template, {
            input: text,
            date: new Date().toISOString().split('T')[0],
            categories: categories.join(', '),
            accounts: accountNames.join(', ')
        });

        try {
            const response = await this._callApi('generate', { prompt, format: 'json' });
            const data = await response.json() as { response: string };
            return JSON.parse(data.response) as ParsedTransaction;
        } catch (error) {
            console.error('AI Parse Failed:', error);
            throw error;
        }
    }

    async getFinancialInsight(summaryData: Record<string, unknown>, promptTemplate: string | null = null): Promise<string> {
        const template = promptTemplate || this.promptInsight || this.DEFAULTS.promptInsight;
        const prompt = this._replaceTemplate(template, {
            data: JSON.stringify(summaryData)
        });

        try {
            const response = await this._callApi('generate', { prompt });
            const data = await response.json() as { response: string };
            return data.response.replace(/^"|"$/g, '').trim();
        } catch {
            return "Keep tracking your spending to stay on top of your goals!";
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
            input: userText
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
                const data = await response.json() as { response: string };
                return data.response;
            }
        } catch {
            return "I'm having trouble connecting to the simulation engine.";
        }
    }
}

export const aiService = new AIService();
