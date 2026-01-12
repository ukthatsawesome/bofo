import { BaseView } from './BaseView';
import { $, UIUtils } from '../core/dom';
import { ViewHeader } from '../components/common/ViewHeader';
import type { App } from '../core/app';

interface AISettings {
    url?: string;
    model?: string;
    enabled?: boolean;
    promptTx?: string;
    promptInsight?: string;
    promptChat?: string;
}

interface OllamaModel {
    name: string;
}

interface AIHealth {
    isConnected: boolean;
    circuitOpen: boolean;
    baseUrl?: string;
    model?: string;
    lastError?: string;
}

export class AISettingsView extends BaseView {
    constructor(app: App) {
        super(app, 'ai-settings');
    }

    async onShow(): Promise<void> {
        if (!this.isInitialized) {
            this.renderBaseTemplate();
            this.isInitialized = true;
        }
        await this.loadAISettings();
    }

    renderBaseTemplate(): void {
        if (!this.element) return;
        this.element.innerHTML = `
            ${ViewHeader({
            title: 'AI Configuration',
            subtitle: 'Configure Ollama connection and AI prompts'
        })}

            <div class="card">
                <div class="card-body">
                    <!-- Connection Status -->
                    <div id="ai-status-container" class="mb-6"></div>

                    <div class="form-grid">
                        <!-- Server URL -->
                        <div class="form-group">
                            <label>Ollama Server URL</label>
                            <div class="flex-row gap-2">
                                <input type="text" id="set-ai-url" class="form-control" placeholder="http://localhost:11434">
                                <button class="btn secondary" id="btn-refresh-models" title="Fetch Models">
                                    <i data-lucide="refresh-cw"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Model Selection -->
                        <div class="form-group">
                            <label>Selected Model</label>
                            <select id="set-ai-model" class="form-control"></select>
                        </div>

                        <!-- AI Toggle -->
                        <div class="form-group full-width">
                            <label class="toggle-row">
                                <span class="text-sm font-medium">Enable AI Insights & Categorization</span>
                                <div class="toggle-switch">
                                    <input type="checkbox" id="set-ai-enabled">
                                    <span class="toggle-slider"></span>
                                </div>
                            </label>
                        </div>

                        <!-- Transaction Prompt -->
                        <div class="form-group full-width">
                            <div class="flex-row justify-between align-center mb-2">
                                <label>Transaction Prompt</label>
                                <button class="btn link sm" id="reset-prompt-tx">Reset to Default</button>
                            </div>
                            <textarea id="set-ai-prompt-tx" class="form-control" rows="4"></textarea>
                            <small class="text-muted">Used for parsing natural language transactions</small>
                        </div>

                        <!-- Insights Prompt -->
                        <div class="form-group full-width">
                            <div class="flex-row justify-between align-center mb-2">
                                <label>Insights Prompt</label>
                                <button class="btn link sm" id="reset-prompt-insight">Reset to Default</button>
                            </div>
                            <textarea id="set-ai-prompt-insight" class="form-control" rows="3"></textarea>
                            <small class="text-muted">Used for generating dashboard insights</small>
                        </div>

                        <!-- Chat/Sandbox Prompt -->
                        <div class="form-group full-width">
                            <div class="flex-row justify-between align-center mb-2">
                                <label>Chat/Sandbox Prompt</label>
                                <button class="btn link sm" id="reset-prompt-chat">Reset to Default</button>
                            </div>
                            <textarea id="set-ai-prompt-chat" class="form-control" rows="3"></textarea>
                            <small class="text-muted">Used for the What-If Sandbox conversation</small>
                        </div>
                    </div>

                    <!-- Save Button -->
                    <div class="card-footer mt-6">
                        <button class="btn primary" id="btn-save-ai">
                            <i data-lucide="save"></i> Save AI Configuration
                        </button>
                    </div>
                </div>
            </div>

            <!-- Health Status Card -->
            <div class="card mt-6">
                <div class="card-header">
                    <h3>Connection Health</h3>
                </div>
                <div class="card-body" id="ai-health-container">
                    <p class="text-muted">Checking connection status...</p>
                </div>
            </div>
        `;

        this.refreshIcons();
    }

    async loadAISettings(): Promise<void> {
        const aiSettings = await window.api.getAISettings();

        // Update status badge
        this.updateStatusBadge(null); // Start with unknown

        // Populate form values
        ($('#set-ai-url') as HTMLInputElement).value = aiSettings.url || 'http://localhost:11434';
        ($('#set-ai-enabled') as HTMLInputElement).checked = aiSettings.enabled !== false;
        ($('#set-ai-prompt-tx') as HTMLTextAreaElement).value = aiSettings.promptTx || '';
        ($('#set-ai-prompt-insight') as HTMLTextAreaElement).value = aiSettings.promptInsight || '';
        ($('#set-ai-prompt-chat') as HTMLTextAreaElement).value = aiSettings.promptChat || '';

        // Bind events
        this.bindEvents(aiSettings);

        // Load models
        await this.refreshModels(aiSettings);

        // Show health status
        await this.updateHealthStatus();
    }

    bindEvents(aiSettings: AISettings): void {
        // Refresh models button
        $('#btn-refresh-models')?.addEventListener('click', () => this.refreshModels(aiSettings));

        // Save button
        $('#btn-save-ai')?.addEventListener('click', () => this.saveSettings());

        // Reset prompt buttons
        $('#reset-prompt-tx')?.addEventListener('click', async () => {
            const defaults = await window.api.getAIDefaults();
            if (defaults.promptTx) ($('#set-ai-prompt-tx') as HTMLTextAreaElement).value = defaults.promptTx;
        });

        $('#reset-prompt-insight')?.addEventListener('click', async () => {
            const defaults = await window.api.getAIDefaults();
            if (defaults.promptInsight) ($('#set-ai-prompt-insight') as HTMLTextAreaElement).value = defaults.promptInsight;
        });

        $('#reset-prompt-chat')?.addEventListener('click', async () => {
            const defaults = await window.api.getAIDefaults();
            if (defaults.promptChat) ($('#set-ai-prompt-chat') as HTMLTextAreaElement).value = defaults.promptChat;
        });
    }

    async refreshModels(aiSettings: AISettings): Promise<void> {
        const urlInput = $('#set-ai-url') as HTMLInputElement;
        const modelSelect = $('#set-ai-model') as HTMLSelectElement;
        const refreshBtn = $('#btn-refresh-models');

        if (!urlInput || !modelSelect) return;

        const url = urlInput.value.trim() || 'http://localhost:11434';

        try {
            refreshBtn?.querySelector('i')?.classList.add('animate-spin');
            const models: OllamaModel[] = await window.api.getOllamaModels(url);

            if (models && models.length > 0) {
                modelSelect.innerHTML = models.map(m =>
                    `<option value="${m.name}" ${m.name === aiSettings?.model ? 'selected' : ''}>${m.name}</option>`
                ).join('');
                this.updateStatusBadge(true);
            } else {
                modelSelect.innerHTML = '<option value="">No models found</option>';
                this.updateStatusBadge(false);
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
            modelSelect.innerHTML = `<option value="${aiSettings?.model || ''}">${aiSettings?.model || 'Connection failed'}</option>`;
            this.updateStatusBadge(false);
        } finally {
            refreshBtn?.querySelector('i')?.classList.remove('animate-spin');
        }

        await this.updateHealthStatus();
    }

    updateStatusBadge(connected: boolean | null): void {
        const statusContainer = $('#ai-status-container');
        if (!statusContainer) return;

        if (connected === null) {
            statusContainer.innerHTML = `
                <div class="flex-row align-center gap-3 p-4 rounded-lg bg-surface-elevated">
                    <div class="w-3 h-3 rounded-full bg-warning animate-pulse"></div>
                    <span class="font-medium text-warning">Checking connection...</span>
                </div>
            `;
        } else if (connected) {
            statusContainer.innerHTML = `
                <div class="flex-row align-center gap-3 p-4 rounded-lg bg-success/10">
                    <div class="w-3 h-3 rounded-full bg-success animate-pulse"></div>
                    <span class="font-medium text-success">Connected to Ollama</span>
                </div>
            `;
        } else {
            statusContainer.innerHTML = `
                <div class="flex-row align-center gap-3 p-4 rounded-lg bg-danger/10">
                    <div class="w-3 h-3 rounded-full bg-danger"></div>
                    <span class="font-medium text-danger">Not Connected</span>
                </div>
            `;
        }
    }

    async updateHealthStatus(): Promise<void> {
        const container = $('#ai-health-container');
        if (!container) return;

        try {
            const health: AIHealth = await window.api.getAIHealth();

            container.innerHTML = `
                <div class="grid grid-cols-2 gap-4">
                    <div class="p-3 rounded-lg bg-surface-elevated">
                        <p class="text-sm text-muted mb-1">Connection</p>
                        <p class="font-medium ${health.isConnected ? 'text-success' : 'text-danger'}">
                            ${health.isConnected ? '● Online' : '○ Offline'}
                        </p>
                    </div>
                    <div class="p-3 rounded-lg bg-surface-elevated">
                        <p class="text-sm text-muted mb-1">Circuit Breaker</p>
                        <p class="font-medium ${health.circuitOpen ? 'text-warning' : 'text-success'}">
                            ${health.circuitOpen ? '⚠ Open (failing fast)' : '✓ Closed (normal)'}
                        </p>
                    </div>
                    <div class="p-3 rounded-lg bg-surface-elevated">
                        <p class="text-sm text-muted mb-1">Server URL</p>
                        <p class="font-medium text-sm truncate">${health.baseUrl || 'Not configured'}</p>
                    </div>
                    <div class="p-3 rounded-lg bg-surface-elevated">
                        <p class="text-sm text-muted mb-1">Model</p>
                        <p class="font-medium text-sm">${health.model || 'None selected'}</p>
                    </div>
                    ${health.lastError ? `
                        <div class="p-3 rounded-lg bg-danger/10 col-span-2">
                            <p class="text-sm text-muted mb-1">Last Error</p>
                            <p class="font-medium text-danger text-sm">${health.lastError}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        } catch (error: any) {
            container.innerHTML = `
                <p class="text-danger">Failed to fetch health status: ${error.message}</p>
            `;
        }
    }

    async saveSettings(): Promise<void> {
        const settings: AISettings = {
            url: ($('#set-ai-url') as HTMLInputElement)?.value.trim() || 'http://localhost:11434',
            model: ($('#set-ai-model') as HTMLSelectElement)?.value || '',
            enabled: ($('#set-ai-enabled') as HTMLInputElement)?.checked ?? true,
            promptTx: ($('#set-ai-prompt-tx') as HTMLTextAreaElement)?.value || '',
            promptInsight: ($('#set-ai-prompt-insight') as HTMLTextAreaElement)?.value || '',
            promptChat: ($('#set-ai-prompt-chat') as HTMLTextAreaElement)?.value || ''
        };

        try {
            const result = await window.api.saveAISettings(settings);
            if (result.success) {
                this.app.notifications.toast('Saved', 'AI configuration saved', 'success');
                // Update AI status in sidebar
                this.app.updateAIStatusIndicator();
            } else {
                this.app.notifications.toast('Error', result.error || 'Failed to save', 'error');
            }
        } catch (error: any) {
            this.app.notifications.toast('Error', error.message, 'error');
        }
    }
}
