/**
 * Currency Service - Handles exchange rate fetching from open-source APIs
 */

import * as https from 'https';
import * as http from 'http';

export interface ExchangeRate {
    from: string;
    to: string;
    rate: number;
}

export interface ApiProvider {
    id: string;
    name: string;
}

export interface ConnectionTestResult {
    success: boolean;
    message: string;
    rateCount?: number;
}

interface ProviderConfig {
    name: string;
    fetchRates: (baseCurrency: string, customUrl?: string | null) => Promise<ExchangeRate[]>;
}

const PROVIDERS: Record<string, ProviderConfig> = {
    frankfurter: {
        name: 'Frankfurter (ECB)',
        fetchRates: async (baseCurrency: string): Promise<ExchangeRate[]> => {
            const url = `https://api.frankfurter.app/latest?from=${baseCurrency}`;
            const data = await fetchJSON(url);
            if (data && data.rates) {
                return Object.entries(data.rates).map(([currency, rate]) => ({
                    from: baseCurrency,
                    to: currency,
                    rate: rate as number
                }));
            }
            throw new Error('Invalid response from Frankfurter API');
        }
    },
    'exchangerate-api': {
        name: 'ExchangeRate-API (Free)',
        fetchRates: async (baseCurrency: string): Promise<ExchangeRate[]> => {
            const url = `https://open.er-api.com/v6/latest/${baseCurrency}`;
            const data = await fetchJSON(url);
            if (data && data.rates) {
                return Object.entries(data.rates).map(([currency, rate]) => ({
                    from: baseCurrency,
                    to: currency,
                    rate: rate as number
                }));
            }
            throw new Error('Invalid response from ExchangeRate-API');
        }
    },
    custom: {
        name: 'Custom API',
        fetchRates: async (baseCurrency: string, customUrl?: string | null): Promise<ExchangeRate[]> => {
            if (!customUrl) throw new Error('Custom API URL not configured');

            const url = customUrl.replace('{base}', baseCurrency);
            const data = await fetchJSON(url);

            if (data && data.rates) {
                return Object.entries(data.rates).map(([currency, rate]) => ({
                    from: baseCurrency,
                    to: currency,
                    rate: rate as number
                }));
            }
            throw new Error('Invalid response from custom API. Expected format: { rates: { "CURRENCY": rate } }');
        }
    }
};

function fetchJSON(url: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        protocol.get(url, { timeout: 10000 }, (res) => {
            let data = '';

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                res.resume();
                return;
            }

            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    reject(new Error('Failed to parse JSON response'));
                }
            });
        }).on('error', (err) => {
            reject(new Error(`Network error: ${err.message}`));
        }).on('timeout', () => {
            reject(new Error('Request timed out'));
        });
    });
}

export const CurrencyService = {
    getProviders(): ApiProvider[] {
        return Object.entries(PROVIDERS).map(([id, provider]) => ({
            id,
            name: provider.name
        }));
    },

    async fetchRates(providerId: string, baseCurrency: string, customUrl: string | null = null): Promise<ExchangeRate[]> {
        const provider = PROVIDERS[providerId];
        if (!provider) {
            throw new Error(`Unknown provider: ${providerId}`);
        }

        if (providerId === 'custom') {
            return await provider.fetchRates(baseCurrency, customUrl);
        }

        return await provider.fetchRates(baseCurrency);
    },

    async testConnection(providerId: string, baseCurrency: string, customUrl: string | null = null): Promise<ConnectionTestResult> {
        try {
            const rates = await this.fetchRates(providerId, baseCurrency, customUrl);
            return {
                success: true,
                message: `Connected successfully. Found ${rates.length} exchange rates.`,
                rateCount: rates.length
            };
        } catch (err) {
            return {
                success: false,
                message: (err as Error).message
            };
        }
    },

    filterRelevantRates(rates: ExchangeRate[], usedCurrencies: string[]): ExchangeRate[] {
        const usedSet = new Set(usedCurrencies.map(c => c.toUpperCase()));
        return rates.filter(r => usedSet.has(r.to.toUpperCase()) || usedSet.has(r.from.toUpperCase()));
    }
};
