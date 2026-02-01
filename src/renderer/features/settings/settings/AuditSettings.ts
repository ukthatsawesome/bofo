import { BaseView } from '../../../app/BaseView';
import { $, UIUtils } from '../../../lib/dom';
import { Card } from '../../../components/ui/Card';
import { ListItem } from '../../../components/ui/ListItem';
import { ViewHeader } from '../../../components/ui/ViewHeader';
import type { App } from '../../../app/App';

export class AuditSettingsView extends BaseView {
    private logs: any[] = [];
    private filterSource: 'ALL' | 'USER' | 'AI' = 'ALL';

    constructor(app: App) {
        super(app, 'settings-section-audit');
    }

    async onShow(): Promise<void> {
        this.logs = await window.api.getAuditLogs();
        await this.render();
    }

    async render(): Promise<void> {
        if (!this.element) return;

        this.element.innerHTML = `
      <div class="flex flex-col gap-6 animate-fade-in">
        <div class="flex justify-between items-center">
            <div>
                <h2 class="text-xl font-bold text-text-main">Activity Feed</h2>
                <p class="text-sm text-text-muted">Track all changes made to your financial data</p>
            </div>
            <div class="flex gap-2 bg-surface-input p-1 rounded-lg">
                <button class="px-3 py-1 text-xs font-semibold rounded-md transition-colors ${this.filterSource === 'ALL' ? 'bg-brand-primary text-white' : 'text-text-muted hover:text-text-main'}" id="filter-all">All</button>
                <button class="px-3 py-1 text-xs font-semibold rounded-md transition-colors ${this.filterSource === 'USER' ? 'bg-blue-500 text-white' : 'text-text-muted hover:text-text-main'}" id="filter-user">My Actions</button>
                <button class="px-3 py-1 text-xs font-semibold rounded-md transition-colors ${this.filterSource === 'AI' ? 'bg-purple-500 text-white' : 'text-text-muted hover:text-text-main'}" id="filter-ai">AI Actions</button>
            </div>
        </div>

        <div class="flex flex-col gap-4" id="audit-feed-container">
            <!-- Logs injected here -->
        </div>
      </div>
    `;

        this.renderLogs();
        this.setupListeners();
        this.refreshIcons();
    }

    renderLogs(): void {
        const container = $('#audit-feed-container');
        if (!container) return;

        const filtered = this.logs.filter(log => {
            if (this.filterSource === 'ALL') return true;
            return log.source === this.filterSource;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 text-text-muted">
                <i data-lucide="clipboard-list" class="w-12 h-12 mb-4 opacity-20"></i>
                <p>No activity found for this filter.</p>
            </div>
        `;
            return;
        }

        container.innerHTML = filtered.map(log => this.createLogItem(log)).join('');
        this.refreshIcons(container);
    }

    createLogItem(log: any): string {
        const isAI = log.source === 'AI';
        const isCreate = log.action === 'CREATE';
        const isDelete = log.action === 'DELETE';

        const icon = isAI ? 'sparkles' : (isDelete ? 'trash-2' : (isCreate ? 'plus-circle' : 'edit-2'));
        const colorClass = isAI ? 'text-purple-500 bg-purple-500/10 border-purple-500/20' : 'text-blue-500 bg-blue-500/10 border-blue-500/20';
        const name = isAI ? 'Bofo AI' : 'You';

        let description = '';
        let details = '';

        if (log.entity_type === 'transaction') {
            const txName = log.entity_name || 'Transaction';
            if (isCreate) description = `created a new transaction used for <b>${this.extractVal(log.changes, 'category')}</b>`;
            else if (isDelete) description = `deleted transaction`;
            else description = `updated transaction details`;

            if (log.changes && !isCreate && !isDelete) {
                try {
                    const changes = typeof log.changes === 'string' ? JSON.parse(log.changes) : log.changes;
                    if (changes.old && changes.new) {
                        // Transaction history format
                        // Just show updated fields
                        const fields = Object.keys(changes.new).filter(k =>
                            JSON.stringify(changes.new[k]) !== JSON.stringify(changes.old[k]) && !['updated_at', 'created_at'].includes(k)
                        );
                        details = fields.map(k => `<span class="text-xs bg-surface-hover px-1.5 py-0.5 rounded border border-border">${k}: ${changes.old[k]} → ${changes.new[k]}</span>`).join(' ');
                    }
                } catch {
                    // Intentionally empty: JSON parse for display - graceful fallback on malformed data
                }
            }
        } else {
            description = `${log.action.toLowerCase()}d ${log.entity_type} details`;
        }

        return `
        <div class="flex gap-4 p-4 rounded-xl border border-border/50 bg-surface-card hover:border-border transition-colors group">
            <div class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${colorClass}">
                <i data-lucide="${icon}" class="w-5 h-5"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start mb-1">
                    <p class="text-sm font-medium text-text-main">
                        <span class="${isAI ? 'text-purple-400' : 'text-blue-400'} font-bold">${name}</span> 
                        <span class="text-text-muted font-normal">${description}</span>
                    </p>
                    <span class="text-[10px] text-text-muted uppercase tracking-wider ml-2 whitespace-nowrap">
                        ${new Date(log.created_at).toLocaleString()}
                    </span>
                </div>
                ${details ? `<div class="mt-2 flex flex-wrap gap-2">${details}</div>` : ''}
                
                ${log.metadata ? `<div class="mt-2 text-xs text-text-muted italic border-l-2 border-border pl-2">${this.formatMetadata(log.metadata)}</div>` : ''}
            </div>
        </div>
    `;
    }

    extractVal(json: any, key: string): string {
        try {
            const obj = typeof json === 'string' ? JSON.parse(json) : json;
            return obj[key] || 'Unknown';
        } catch { return '...'; }
    }

    formatMetadata(meta: any): string {
        try {
            const obj = typeof meta === 'string' ? JSON.parse(meta) : meta;
            // Format specific AI keys
            if (obj.confidence) return `Confidence: ${(obj.confidence * 100).toFixed(0)}%`;
            return JSON.stringify(obj);
        } catch { return ''; }
    }

    setupListeners(): void {
        $('#filter-all')?.addEventListener('click', () => { this.filterSource = 'ALL'; this.render(); });
        $('#filter-user')?.addEventListener('click', () => { this.filterSource = 'USER'; this.render(); });
        $('#filter-ai')?.addEventListener('click', () => { this.filterSource = 'AI'; this.render(); });
    }
}
