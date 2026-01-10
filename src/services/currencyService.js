/**
 * Currency Service - Handles exchange rate fetching from open-source APIs
 */

const https = require('https');
const http = require('http');

// API Provider configurations
const PROVIDERS = {
    frankfurter: {
        name: 'Frankfurter (ECB)',
        fetchRates: async (baseCurrency) => {
            const url = `https://api.frankfurter.app/latest?from=${baseCurrency}`;
            const data = await fetchJSON(url);
            if (data && data.rates) {
                return Object.entries(data.rates).map(([currency, rate]) => ({
                    from: baseCurrency,
                    to: currency,
                    rate: rate
                }));
            }
            throw new Error('Invalid response from Frankfurter API');
        }
    },
    'exchangerate-api': {
        name: 'ExchangeRate-API (Free)',
        fetchRates: async (baseCurrency) => {
            const url = `https://open.er-api.com/v6/latest/${baseCurrency}`;
            const data = await fetchJSON(url);
            if (data && data.rates) {
                return Object.entries(data.rates).map(([currency, rate]) => ({
                    from: baseCurrency,
                    to: currency,
                    rate: rate
                }));
            }
            throw new Error('Invalid response from ExchangeRate-API');
        }
    },
    custom: {
        name: 'Custom API',
        fetchRates: async (baseCurrency, customUrl) => {
            if (!customUrl) throw new Error('Custom API URL not configured');

            // Replace placeholder in URL
            const url = customUrl.replace('{base}', baseCurrency);
            const data = await fetchJSON(url);

            // Expect response format: { rates: { "USD": 1.0, "NPR": 133.5, ... } }
            if (data && data.rates) {
                return Object.entries(data.rates).map(([currency, rate]) => ({
                    from: baseCurrency,
                    to: currency,
                    rate: rate
                }));
            }
            throw new Error('Invalid response from custom API. Expected format: { rates: { "CURRENCY": rate } }');
        }
    }
};

/**
 * Fetch JSON from a URL using native Node.js http/https
 */
function fetchJSON(url) {
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
                } catch (e) {
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

const CurrencyService = {
    /**
     * Get available API providers
     */
    getProviders() {
        return Object.entries(PROVIDERS).map(([id, provider]) => ({
            id,
            name: provider.name
        }));
    },

    /**
     * Fetch exchange rates from specified provider
     * @param {string} providerId - Provider identifier (frankfurter, exchangerate-api, custom)
     * @param {string} baseCurrency - Base currency code (e.g., 'NPR', 'USD')
     * @param {string} [customUrl] - Custom API URL (only for 'custom' provider)
     * @returns {Promise<Array<{from: string, to: string, rate: number}>>}
     */
    async fetchRates(providerId, baseCurrency, customUrl = null) {
        const provider = PROVIDERS[providerId];
        if (!provider) {
            throw new Error(`Unknown provider: ${providerId}`);
        }

        if (providerId === 'custom') {
            return await provider.fetchRates(baseCurrency, customUrl);
        }

        return await provider.fetchRates(baseCurrency);
    },

    /**
     * Test connection to a provider
     * @param {string} providerId 
     * @param {string} baseCurrency 
     * @param {string} [customUrl]
     * @returns {Promise<{success: boolean, message: string, rateCount?: number}>}
     */
    async testConnection(providerId, baseCurrency, customUrl = null) {
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
                message: err.message
            };
        }
    },

    /**
     * Filter rates to only include currencies we care about
     * @param {Array} rates - All fetched rates
     * @param {Array<string>} usedCurrencies - Currencies used in accounts
     * @returns {Array}
     */
    filterRelevantRates(rates, usedCurrencies) {
        const usedSet = new Set(usedCurrencies.map(c => c.toUpperCase()));
        return rates.filter(r => usedSet.has(r.to.toUpperCase()) || usedSet.has(r.from.toUpperCase()));
    }
};

module.exports = CurrencyService;
