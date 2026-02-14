/**
 * Currency Service - Handles exchange rate fetching from open-source APIs
 *
 * Features:
 * - Retry with exponential backoff for API resilience
 * - In-memory caching to reduce API calls
 * - Multiple provider support (Frankfurter, ExchangeRate-API, Custom)
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

export interface RateSyncStatus {
  lastSync: string | null;
  isStale: boolean;
  stalenessHours: number;
  rateCount: number;
}

interface ProviderConfig {
  name: string;
  fetchRates: (baseCurrency: string, customUrl?: string | null) => Promise<ExchangeRate[]>;
}

interface CacheEntry {
  rates: ExchangeRate[];
  timestamp: number;
  baseCurrency: string;
}

// In-memory cache with 1-hour TTL (to reduce API calls during session)
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const rateCache: Map<string, CacheEntry> = new Map();

const PROVIDERS: Record<string, ProviderConfig> = {
  frankfurter: {
    name: 'Frankfurter (ECB)',
    fetchRates: async (baseCurrency: string): Promise<ExchangeRate[]> => {
      const url = `https://api.frankfurter.app/latest?from=${baseCurrency}`;
      try {
        const data = await fetchJSONWithRetry(url);
        if (data && data.rates) {
          return Object.entries(data.rates).map(([currency, rate]) => ({
            from: baseCurrency,
            to: currency,
            rate: rate as number,
          }));
        }
        throw new Error('Invalid response from Frankfurter API');
      } catch (error: any) {
        if (error.message.includes('404') || error.message.includes('not found')) {
          // Fallback to ExchangeRate-API for unsupported currencies (like NPR)
          console.warn(`Frankfurter API does not support ${baseCurrency}, falling back to ExchangeRate-API...`);
          return PROVIDERS['exchangerate-api'].fetchRates(baseCurrency);
        }
        throw error;
      }
    },
  },
  'exchangerate-api': {
    name: 'ExchangeRate-API (Free)',
    fetchRates: async (baseCurrency: string): Promise<ExchangeRate[]> => {
      const url = `https://open.er-api.com/v6/latest/${baseCurrency}`;
      const data = await fetchJSONWithRetry(url);
      if (data && data.rates) {
        return Object.entries(data.rates).map(([currency, rate]) => ({
          from: baseCurrency,
          to: currency,
          rate: rate as number,
        }));
      }
      throw new Error('Invalid response from ExchangeRate-API');
    },
  },
  custom: {
    name: 'Custom API',
    fetchRates: async (
      baseCurrency: string,
      customUrl?: string | null
    ): Promise<ExchangeRate[]> => {
      if (!customUrl) throw new Error('Custom API URL not configured');

      const url = customUrl.replace('{base}', baseCurrency);
      const data = await fetchJSONWithRetry(url);

      if (data && data.rates) {
        return Object.entries(data.rates).map(([currency, rate]) => ({
          from: baseCurrency,
          to: currency,
          rate: rate as number,
        }));
      }
      throw new Error(
        'Invalid response from custom API. Expected format: { rates: { "CURRENCY": rate } }'
      );
    },
  },
};

/**
 * Fetch JSON with retry and exponential backoff
 */
async function fetchJSONWithRetry(
  url: string,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<Record<string, unknown>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchJSON(url);
    } catch (err) {
      lastError = err as Error;
      const isRetryable = isRetryableError(lastError);

      if (!isRetryable || attempt === maxRetries - 1) {
        throw lastError;
      }

      // Exponential backoff: 1s, 2s, 4s...
      const delay = baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastError || new Error('Failed to fetch after retries');
}

/**
 * Check if an error is retryable (network issues, timeouts, 5xx errors)
 */
function isRetryableError(err: Error): boolean {
  const message = err.message.toLowerCase();
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('http 5') ||
    message.includes('http 429') // Rate limited
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchJSON(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const req = protocol.get(url, { timeout: 15000 }, (res) => {
      let data = '';

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        res.resume();
        return;
      }

      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Failed to parse JSON response'));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Network error: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

/**
 * Get cache key for a provider/currency combination
 */
function getCacheKey(providerId: string, baseCurrency: string): string {
  return `${providerId}:${baseCurrency}`;
}

export const CurrencyService = {
  getProviders(): ApiProvider[] {
    return Object.entries(PROVIDERS).map(([id, provider]) => ({
      id,
      name: provider.name,
    }));
  },

  /**
   * Fetch rates with optional caching
   */
  async fetchRates(
    providerId: string,
    baseCurrency: string,
    customUrl: string | null = null,
    useCache: boolean = true
  ): Promise<ExchangeRate[]> {
    const provider = PROVIDERS[providerId];
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    const cacheKey = getCacheKey(providerId, baseCurrency);

    // Check cache first (unless explicitly bypassing)
    if (useCache) {
      const cached = rateCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.rates;
      }
    }

    // Fetch from API
    const rates =
      providerId === 'custom'
        ? await provider.fetchRates(baseCurrency, customUrl)
        : await provider.fetchRates(baseCurrency);

    // Cache the results
    rateCache.set(cacheKey, {
      rates,
      timestamp: Date.now(),
      baseCurrency,
    });

    return rates;
  },

  /**
   * Force refresh rates (bypass cache)
   */
  async refreshRates(
    providerId: string,
    baseCurrency: string,
    customUrl: string | null = null
  ): Promise<ExchangeRate[]> {
    return this.fetchRates(providerId, baseCurrency, customUrl, false);
  },

  async testConnection(
    providerId: string,
    baseCurrency: string,
    customUrl: string | null = null
  ): Promise<ConnectionTestResult> {
    try {
      const rates = await this.fetchRates(providerId, baseCurrency, customUrl, false);
      return {
        success: true,
        message: `Connected successfully. Found ${rates.length} exchange rates.`,
        rateCount: rates.length,
      };
    } catch (err) {
      return {
        success: false,
        message: (err as Error).message,
      };
    }
  },

  filterRelevantRates(rates: ExchangeRate[], usedCurrencies: string[]): ExchangeRate[] {
    const usedSet = new Set(usedCurrencies.map((c) => c.toUpperCase()));
    return rates.filter(
      (r) => usedSet.has(r.to.toUpperCase()) || usedSet.has(r.from.toUpperCase())
    );
  },

  /**
   * Get a specific rate from cached rates
   */
  getCachedRate(providerId: string, baseCurrency: string, targetCurrency: string): number | null {
    const cacheKey = getCacheKey(providerId, baseCurrency);
    const cached = rateCache.get(cacheKey);

    if (!cached || Date.now() - cached.timestamp >= CACHE_TTL_MS) {
      return null;
    }

    const rate = cached.rates.find((r) => r.to.toUpperCase() === targetCurrency.toUpperCase());
    return rate?.rate ?? null;
  },

  /**
   * Clear the in-memory cache
   */
  clearCache(): void {
    rateCache.clear();
  },

  /**
   * Check if rates are stale based on last sync time
   */
  isStale(lastSyncISO: string | null, stalenessHours: number = 24): boolean {
    if (!lastSyncISO) return true;

    const lastSync = new Date(lastSyncISO).getTime();
    const now = Date.now();
    const hoursSinceSync = (now - lastSync) / (1000 * 60 * 60);

    return hoursSinceSync >= stalenessHours;
  },
};
