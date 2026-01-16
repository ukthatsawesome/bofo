/**
 * Centralized AI Insight Cache Manager
 * Provides unified caching, background fetching, and smart invalidation for AI insights
 */

interface AIInsight {
  text: string;
  title: string;
  icon: string;
  isAI: boolean;
  timestamp?: number;
  ttl?: number;
  fromCache?: boolean;
}

interface FetchOptions {
  forceRefresh?: boolean;
  ttl?: number;
  skipCache?: boolean;
  aiTitle?: string;
  fallbackTitle?: string;
}

interface CacheItem extends AIInsight {
  timestamp: number;
  ttl: number;
}

type SubscriberCallback = (data: { insight: AIInsight | null; status: string }) => void;

const CACHE_PREFIX = 'bofo_ai_cache_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours default

export class AIInsightCache {
  private pendingRequests: Map<string, Promise<AIInsight | null>>;
  private subscribers: Map<string, SubscriberCallback[]>;
  private connectionStatus: boolean | null;
  private lastConnectionCheck: number;
  private readonly CONNECTION_CHECK_INTERVAL: number;

  constructor() {
    this.pendingRequests = new Map();
    this.subscribers = new Map();
    this.connectionStatus = null;
    this.lastConnectionCheck = 0;
    this.CONNECTION_CHECK_INTERVAL = 60000; // 1 minute
  }

  /**
   * Generate a cache key based on context type and data hash
   */
  _generateKey(context: string, dataHash: string = ''): string {
    return `${CACHE_PREFIX}${context}_${dataHash}`;
  }

  /**
   * Simple hash function for data objects
   */
  _hashData(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached insight if valid
   */
  getCached(context: string, data: any = null): AIInsight | null {
    const dataHash = data ? this._hashData(data) : '';
    const key = this._generateKey(context, dataHash);

    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const parsed = JSON.parse(cached) as CacheItem;
      const now = Date.now();

      // Check if cache is still valid
      if (parsed.timestamp && now - parsed.timestamp < (parsed.ttl || CACHE_TTL_MS)) {
        return {
          text: parsed.text,
          title: parsed.title,
          icon: parsed.icon,
          isAI: parsed.isAI,
          fromCache: true,
        };
      }

      // Cache expired, remove it
      localStorage.removeItem(key);
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Store insight in cache
   */
  setCache(context: string, data: any, insight: AIInsight, ttl: number = CACHE_TTL_MS): void {
    const dataHash = data ? this._hashData(data) : '';
    const key = this._generateKey(context, dataHash);

    try {
      const item: CacheItem = {
        text: insight.text,
        title: insight.title,
        icon: insight.icon,
        isAI: insight.isAI,
        timestamp: Date.now(),
        ttl,
      };
      localStorage.setItem(key, JSON.stringify(item));
    } catch (e) {
      console.warn('Failed to cache insight:', e);
    }
  }

  /**
   * Invalidate cache for a specific context or all contexts
   */
  invalidate(context: string | null = null): void {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));

    keys.forEach((key) => {
      if (!context || key.includes(context)) {
        localStorage.removeItem(key);
      }
    });

    // Notify subscribers of invalidation
    if (context) {
      this._notifySubscribers(context, null, 'invalidated');
    } else {
      // Notify all subscribers if full invalidation
      this.subscribers.forEach((subs, ctx) => {
        this._notifySubscribers(ctx, null, 'invalidated');
      });
    }
  }

  /**
   * Subscribe to insight updates for a specific context
   */
  subscribe(context: string, callback: SubscriberCallback): () => void {
    if (!this.subscribers.has(context)) {
      this.subscribers.set(context, []);
    }
    this.subscribers.get(context)?.push(callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(context);
      if (subs) {
        this.subscribers.set(
          context,
          subs.filter((cb) => cb !== callback)
        );
      }
    };
  }

  /**
   * Notify subscribers of insight updates
   */
  _notifySubscribers(context: string, insight: AIInsight | null, status: string = 'ready'): void {
    const subs = this.subscribers.get(context) || [];
    subs.forEach((cb) => cb({ insight, status }));
  }

  /**
   * Fetch insight with caching and deduplication
   */
  async fetchInsight(
    context: string,
    summaryData: any,
    fetchFn: (data: any) => Promise<string>,
    fallbackFn: (data: any) => string,
    options: FetchOptions = {}
  ): Promise<AIInsight | null> {
    const { forceRefresh = false, ttl = CACHE_TTL_MS, skipCache = false } = options;

    const dataHash = this._hashData(summaryData);
    const requestKey = `${context}_${dataHash}`;

    // Check for pending request (deduplication)
    if (this.pendingRequests.has(requestKey)) {
      return (await this.pendingRequests.get(requestKey)) || null;
    }

    // Check cache first
    if (!forceRefresh && !skipCache) {
      const cached = this.getCached(context, summaryData);
      if (cached) {
        return cached;
      }
    }

    // Create promise for this request
    const requestPromise = (async (): Promise<AIInsight | null> => {
      try {
        // Check AI connection first
        const aiEnabled = await this.isAIAvailable();

        let insight: AIInsight | undefined;
        if (aiEnabled) {
          try {
            const aiResult = await fetchFn(summaryData);
            if (aiResult && !aiResult.includes('Keep tracking')) {
              insight = {
                text: aiResult,
                title: options.aiTitle || 'AI Insight',
                icon: 'sparkles',
                isAI: true,
              };
            }
          } catch (err: any) {
            console.warn(`AI fetch failed for ${context}:`, err.message);
          }
        }

        // Fallback to rule-based if AI failed or not available
        if (!insight) {
          const fallbackText = fallbackFn(summaryData);
          insight = {
            text: fallbackText,
            title: options.fallbackTitle || 'Financial Insight',
            icon: 'lightbulb',
            isAI: false,
          };
        }

        // Cache the result
        if (!skipCache && insight) {
          this.setCache(context, summaryData, insight, ttl);
        }

        this._notifySubscribers(context, insight || null, 'ready');
        return insight || null;
      } finally {
        this.pendingRequests.delete(requestKey);
      }
    })();

    this.pendingRequests.set(requestKey, requestPromise);
    return requestPromise;
  }

  /**
   * Check if AI is available (with caching)
   */
  async isAIAvailable(): Promise<boolean> {
    const now = Date.now();

    // Smart TTL: Check more frequently if offline (10s) vs online (60s)
    // This helps the UI recover faster when the AI service comes online
    const ttl = this.connectionStatus === false ? 10000 : this.CONNECTION_CHECK_INTERVAL;

    // Use cached status if recent
    if (this.connectionStatus !== null && now - this.lastConnectionCheck < ttl) {
      return this.connectionStatus;
    }

    try {
      const settings = await window.api.getAISettings();
      if (!settings.enabled) {
        this.connectionStatus = false;
        this.lastConnectionCheck = now;
        return false;
      }

      const connected = await window.api.checkAIConnection();
      this.connectionStatus = connected;
      this.lastConnectionCheck = now;

      // Emit connection status change event
      this._emitConnectionStatus(connected);

      return connected;
    } catch (e) {
      this.connectionStatus = false;
      this.lastConnectionCheck = now;
      return false;
    }
  }

  /**
   * Get current connection status (synchronous, uses cached value)
   */
  getConnectionStatus() {
    return {
      status: this.connectionStatus,
      lastCheck: this.lastConnectionCheck,
      isStale: Date.now() - this.lastConnectionCheck > this.CONNECTION_CHECK_INTERVAL,
    };
  }

  /**
   * Force refresh connection status
   */
  async refreshConnectionStatus(): Promise<boolean> {
    this.lastConnectionCheck = 0; // Force refresh
    return this.isAIAvailable();
  }

  /**
   * Emit connection status to listeners
   */
  _emitConnectionStatus(connected: boolean): void {
    // Use custom event for global notification
    window.dispatchEvent(
      new CustomEvent('ai-connection-status', {
        detail: { connected, timestamp: Date.now() },
      })
    );
  }

  /**
   * Pre-fetch insights for multiple contexts (background processing)
   */
  async prefetchInsights(
    contexts: { context: string; summaryData: any; fetchFn: any; fallbackFn: any; options: any }[]
  ): Promise<void> {
    const promises = contexts.map(
      async ({ context, summaryData, fetchFn, fallbackFn, options }) => {
        try {
          // Only prefetch if not cached
          const cached = this.getCached(context, summaryData);
          if (!cached) {
            await this.fetchInsight(context, summaryData, fetchFn, fallbackFn, options);
          }
        } catch (e) {
          console.warn(`Prefetch failed for ${context}:`, e);
        }
      }
    );

    await Promise.allSettled(promises);
  }
}

// Singleton instance
export const aiInsightCache = new AIInsightCache();
