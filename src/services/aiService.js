class AIService {
    constructor() {
        this.baseUrl = 'http://127.0.0.1:11434';
        this.model = 'gemma3:4b';

        // Centralized Default Prompts
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
    }

    async setConfig(url, model) {
        this.baseUrl = url || 'http://127.0.0.1:11434';
        this.model = model || 'gemma3:4b';
    }

    /**
     * Private helper for Ollama API calls
     */
    async _callApi(endpoint, body, isStreaming = false) {
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

    /**
     * Helper for template replacement
     */
    _replaceTemplate(template, data) {
        let result = template;
        for (const [key, value] of Object.entries(data)) {
            result = result.split(`{{${key}}}`).join(value);
        }
        return result;
    }

    async checkConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async getInstalledModels() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            if (!response.ok) return [];
            const data = await response.json();
            return data.models || [];
        } catch (error) {
            return [];
        }
    }

    async parseTransactionFromText(text, categories, accountNames = [], promptTemplate = null) {
        const prompt = this._replaceTemplate(promptTemplate || this.DEFAULTS.promptTx, {
            input: text,
            date: new Date().toISOString().split('T')[0],
            categories: categories.join(', '),
            accounts: accountNames.join(', ')
        });

        try {
            const response = await this._callApi('generate', { prompt, format: 'json' });
            const data = await response.json();
            return JSON.parse(data.response);
        } catch (error) {
            console.error('AI Parse Failed:', error);
            throw error;
        }
    }

    async getFinancialInsight(summaryData, promptTemplate = null) {
        const prompt = this._replaceTemplate(promptTemplate || this.DEFAULTS.promptInsight, {
            data: JSON.stringify(summaryData)
        });

        try {
            const response = await this._callApi('generate', { prompt });
            const data = await response.json();
            return data.response.replace(/^"|"$/g, '').trim();
        } catch (error) {
            return "Keep tracking your spending to stay on top of your goals!";
        }
    }

    async chatSandbox(userText, context, promptTemplate = null, onChunk = null) {
        const prompt = this._replaceTemplate(promptTemplate || this.DEFAULTS.promptChat, {
            stats: JSON.stringify(context.stats),
            hypotheticals: JSON.stringify(context.simulation),
            rules: JSON.stringify(context.rules),
            input: userText
        });

        const isStreaming = typeof onChunk === 'function';

        try {
            const response = await this._callApi('generate', { prompt }, isStreaming);

            if (isStreaming) {
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
                            const data = JSON.parse(line);
                            if (data.response) {
                                fullText += data.response;
                                onChunk(data.response);
                            }
                            if (data.done) return fullText;
                        } catch (e) {
                            // Ignore partial JSON lines
                        }
                    }
                }
                return fullText;
            } else {
                const data = await response.json();
                return data.response;
            }
        } catch (error) {
            return "I'm having trouble connecting to the simulation engine.";
        }
    }
}

module.exports = new AIService();
