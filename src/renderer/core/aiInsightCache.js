/**
 * Centralized AI Insight Cache Manager
 * Provides unified caching, background fetching, and smart invalidation for AI insights
 */

const CACHE_PREFIX = 'bofo_ai_cache_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours default

export class AIInsightCache {
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
    _generateKey(context, dataHash = '') {
        return `${CACHE_PREFIX}${context}_${dataHash}`;
    }

    /**
     * Simple hash function for data objects
     */
    _hashData(data) {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Get cached insight if valid
     */
    getCached(context, data = null) {
        const dataHash = data ? this._hashData(data) : '';
        const key = this._generateKey(context, dataHash);

        try {
            const cached = localStorage.getItem(key);
            if (!cached) return null;

            const parsed = JSON.parse(cached);
            const now = Date.now();

            // Check if cache is still valid
            if (parsed.timestamp && (now - parsed.timestamp) < (parsed.ttl || CACHE_TTL_MS)) {
                return {
                    text: parsed.text,
                    title: parsed.title,
                    icon: parsed.icon,
                    isAI: parsed.isAI,
                    fromCache: true
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
    setCache(context, data, insight, ttl = CACHE_TTL_MS) {
        const dataHash = data ? this._hashData(data) : '';
        const key = this._generateKey(context, dataHash);

        try {
            localStorage.setItem(key, JSON.stringify({
                text: insight.text,
                title: insight.title,
                icon: insight.icon,
                isAI: insight.isAI,
                timestamp: Date.now(),
                ttl
            }));
        } catch (e) {
            console.warn('Failed to cache insight:', e);
        }
    }

    /**
     * Invalidate cache for a specific context or all contexts
     */
    invalidate(context = null) {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));

        keys.forEach(key => {
            if (!context || key.includes(context)) {
                localStorage.removeItem(key);
            }
        });

        // Notify subscribers of invalidation
        this._notifySubscribers(context, null, 'invalidated');
    }

    /**
     * Subscribe to insight updates for a specific context
     */
    subscribe(context, callback) {
        if (!this.subscribers.has(context)) {
            this.subscribers.set(context, []);
        }
        this.subscribers.get(context).push(callback);

        // Return unsubscribe function
        return () => {
            const subs = this.subscribers.get(context);
            if (subs) {
                this.subscribers.set(context, subs.filter(cb => cb !== callback));
            }
        };
    }

    /**
     * Notify subscribers of insight updates
     */
    _notifySubscribers(context, insight, status = 'ready') {
        const subs = this.subscribers.get(context) || [];
        subs.forEach(cb => cb({ insight, status }));
    }

    /**
     * Fetch insight with caching and deduplication
     */
    async fetchInsight(context, summaryData, fetchFn, fallbackFn, options = {}) {
        const {
            forceRefresh = false,
            ttl = CACHE_TTL_MS,
            skipCache = false
        } = options;

        const dataHash = this._hashData(summaryData);
        const requestKey = `${context}_${dataHash}`;

        // Check for pending request (deduplication)
        if (this.pendingRequests.has(requestKey)) {
            return this.pendingRequests.get(requestKey);
        }

        // Check cache first
        if (!forceRefresh && !skipCache) {
            const cached = this.getCached(context, summaryData);
            if (cached) {
                return cached;
            }
        }

        // Create promise for this request
        const requestPromise = (async () => {
            try {
                // Check AI connection first
                const aiEnabled = await this.isAIAvailable();

                let insight;
                if (aiEnabled) {
                    try {
                        const aiResult = await fetchFn(summaryData);
                        if (aiResult && !aiResult.includes('Keep tracking')) {
                            insight = {
                                text: aiResult,
                                title: options.aiTitle || 'AI Insight',
                                icon: 'sparkles',
                                isAI: true
                            };
                        }
                    } catch (err) {
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
                        isAI: false
                    };
                }

                // Cache the result
                if (!skipCache) {
                    this.setCache(context, summaryData, insight, ttl);
                }

                this._notifySubscribers(context, insight, 'ready');
                return insight;

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
    async isAIAvailable() {
        const now = Date.now();

        // Use cached status if recent
        if (this.connectionStatus !== null &&
            (now - this.lastConnectionCheck) < this.CONNECTION_CHECK_INTERVAL) {
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
            isStale: Date.now() - this.lastConnectionCheck > this.CONNECTION_CHECK_INTERVAL
        };
    }

    /**
     * Force refresh connection status
     */
    async refreshConnectionStatus() {
        this.lastConnectionCheck = 0; // Force refresh
        return this.isAIAvailable();
    }

    /**
     * Emit connection status to listeners
     */
    _emitConnectionStatus(connected) {
        // Use custom event for global notification
        window.dispatchEvent(new CustomEvent('ai-connection-status', {
            detail: { connected, timestamp: Date.now() }
        }));
    }

    /**
     * Pre-fetch insights for multiple contexts (background processing)
     */
    async prefetchInsights(contexts) {
        const promises = contexts.map(async ({ context, summaryData, fetchFn, fallbackFn, options }) => {
            try {
                // Only prefetch if not cached
                const cached = this.getCached(context, summaryData);
                if (!cached) {
                    await this.fetchInsight(context, summaryData, fetchFn, fallbackFn, options);
                }
            } catch (e) {
                console.warn(`Prefetch failed for ${context}:`, e);
            }
        });

        await Promise.allSettled(promises);
    }
}

// Singleton instance
export const aiInsightCache = new AIInsightCache();
