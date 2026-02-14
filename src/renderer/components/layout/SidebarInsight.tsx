import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { clsx } from 'clsx';
import { Sparkles, TrendingUp, TrendingDown, RefreshCcw } from 'lucide-preact';
import { financeStore } from '@/core/financeStore';

export const SidebarInsight = () => {
    const insight = financeStore.insight.value;
    const stats = financeStore.summaryStats.value;
    // Consider it loading if we have stats but no insight yet, or if global loading is true
    const isLoading = financeStore.isLoading.value || (stats && !insight);

    useEffect(() => {
        // Reload if we have stats but no insight
        if (stats && !insight && !financeStore.isLoading.value) {
            financeStore.loadInsight();
        }
    }, [stats, insight]); // React to stats changes

    // Only hide if we truly have nothing and aren't loading
    if (!insight && !isLoading && !stats) return null;

    if (isLoading && !insight) {
        return (
            <div className="mx-4 mb-4 p-4 rounded-2xl bg-surface-card border border-border/50 animate-pulse">
                <div className="h-3 w-24 bg-surface-elevated rounded mb-3"></div>
                <div className="space-y-2">
                    <div className="h-2 w-full bg-surface-elevated rounded"></div>
                    <div className="h-2 w-2/3 bg-surface-elevated rounded"></div>
                </div>
            </div>
        );
    }

    const simpleText = insight?.text.replace(/<[^>]*>/g, '') || '';
    const isPositive = simpleText.toLowerCase().includes('good') || simpleText.toLowerCase().includes('saving') || simpleText.toLowerCase().includes('increase');

    return (
        <div className="mx-4 mb-4 relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative p-4 rounded-2xl bg-surface-card/60 backdrop-blur-md border border-white/10 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-brand-primary uppercase tracking-wider">
                    <Sparkles size={12} className="text-brand-primary animate-pulse" />
                    <span>Bofo Insight</span>
                </div>

                {/* Content */}
                <div className="text-xs text-text-secondary leading-relaxed line-clamp-4">
                    {insight?.isAI ? (
                        <span dangerouslySetInnerHTML={{ __html: insight.text }} />
                    ) : (
                        simpleText
                    )}
                </div>

                {/* Footer / Status */}
                <div className="mt-3 flex items-center justify-between text-[10px] text-text-muted border-t border-border/50 pt-2">
                    <div className="flex items-center gap-1">
                        {isPositive ? (
                            <TrendingUp size={10} className="text-success" />
                        ) : (
                            <TrendingDown size={10} className="text-text-muted" />
                        )}
                        <span>{insight?.isAI ? 'AI Generated' : 'Automated Analysis'}</span>
                    </div>
                    <button
                        onClick={() => financeStore.loadInsight()}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-surface-elevated rounded cursor-pointer"
                        title="Refresh Insight"
                    >
                        <RefreshCcw size={10} />
                    </button>
                </div>
            </div>
        </div>
    );
};
