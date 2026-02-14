import { h } from 'preact';
import { useState } from 'preact/hooks';
import { useAISettings } from '@/features/settings/hooks/useAISettings';
import { UiCard } from '@/components/ui/UiCard';
import { UiButton } from '@/components/ui/UiButton';
import { Input } from '@/components/ui/Input';
import { Save, RefreshCw, CheckCircle2, AlertCircle, Sparkles } from 'lucide-preact';
import { clsx } from 'clsx';

export const SettingsAI = () => {
    const {
        settings,
        setSettings,
        isLoading,
        isChecking,
        connectionStatus,
        models,
        checkConnection,
        saveSettings
    } = useAISettings();

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        const success = await saveSettings(settings);
        setIsSaving(false);
        if (success) {
            // Success notification could be added here
        }
    };

    const handleChange = (key: string, value: any) => {
        setSettings({ ...settings, [key]: value });
    };

    if (isLoading) {
        return <div className="p-10 text-center text-text-muted">Loading AI Settings...</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex justify-end sticky top-0 bg-surface-base/95 backdrop-blur z-10 py-2 border-b border-border/50 -mx-6 px-6 -mt-6 mb-6">
                <UiButton
                    icon={<Save size={18} />}
                    onClick={handleSave}
                    isLoading={isSaving}
                >
                    Save Changes
                </UiButton>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <UiCard title="Connection Settings">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-surface-base rounded-xl border border-border/50">
                                <div>
                                    <h3 className="text-sm font-bold">Enable AI Features</h3>
                                    <p className="text-xs text-text-muted">Use AI for transaction parsing and financial insights</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={settings.enabled}
                                        onChange={(e) => handleChange('enabled', (e.target as HTMLInputElement).checked)}
                                    />
                                    <div className="w-11 h-6 bg-surface-active peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary" />
                                </label>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">AI Engine URL</label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="http://localhost:11434"
                                        value={settings.url}
                                        onInput={(e) => handleChange('url', (e.target as HTMLInputElement).value)}
                                        className="flex-1"
                                    />
                                    <UiButton
                                        variant="outline"
                                        icon={<RefreshCw size={16} className={isChecking ? "animate-spin" : ""} />}
                                        onClick={() => checkConnection()}
                                        disabled={isChecking}
                                    >
                                        Test
                                    </UiButton>
                                </div>
                                <div className="flex items-center gap-2 px-1">
                                    {connectionStatus === true && (
                                        <div className="text-xs text-success flex items-center gap-1">
                                            <CheckCircle2 size={12} /> Connected successfully
                                        </div>
                                    )}
                                    {connectionStatus === false && (
                                        <div className="text-xs text-danger flex items-center gap-1">
                                            <AlertCircle size={12} /> Connection failed
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Model Name</label>
                                <select
                                    className="w-full h-11 px-4 rounded-xl border border-border bg-surface-base text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all appearance-none"
                                    value={settings.model}
                                    onChange={(e) => handleChange('model', (e.target as HTMLSelectElement).value)}
                                >
                                    <option value="">Select a model...</option>
                                    {models.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-text-muted px-1">Make sure you have pulled the model first (e.g. `ollama pull gemma2:2b` or `deepseek-r1:1.5b` )</p>
                            </div>
                        </div>
                    </UiCard>

                    <UiCard title="Advanced Prompting">
                        <div className="space-y-4">
                            <p className="text-xs text-text-muted mb-4">Customize how the AI interprets your data</p>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Transaction Parser Prompt</label>
                                <textarea
                                    className="w-full p-4 rounded-xl border border-border bg-surface-base text-sm min-h-[120px] focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none"
                                    value={settings.promptTx}
                                    onInput={(e) => handleChange('promptTx', (e.target as HTMLTextAreaElement).value)}
                                    placeholder="Leave empty to use system default..."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1">Financial Insights Prompt</label>
                                <textarea
                                    className="w-full p-4 rounded-xl border border-border bg-surface-base text-sm min-h-[120px] focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none"
                                    value={settings.promptInsight}
                                    onInput={(e) => handleChange('promptInsight', (e.target as HTMLTextAreaElement).value)}
                                    placeholder="Leave empty to use system default..."
                                />
                            </div>
                        </div>
                    </UiCard>
                </div>

                <div className="space-y-6">
                    <UiCard className="bg-brand-primary/5 border-brand-primary/20">
                        <div className="flex flex-col items-center text-center p-4 space-y-4">
                            <div className="w-16 h-16 rounded-3xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                                <Sparkles size={32} />
                            </div>
                            <div>
                                <h3 className="font-bold text-text-primary">AI Capabilities</h3>
                                <p className="text-xs text-text-muted mt-2">
                                    When enabled, Bofo can automatically categorize transactions from natural language and provide tailored financial advice based on your spending habits.
                                </p>
                            </div>
                        </div>
                    </UiCard>

                    <div className="p-4 bg-surface-card border border-border rounded-2xl">
                        <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Service Status</h4>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs">Ollama API</span>
                                <div className={clsx("w-2 h-2 rounded-full", connectionStatus ? "bg-success" : "bg-danger")} />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs">Model Loaded</span>
                                <div className={clsx("w-2 h-2 rounded-full", settings.model ? "bg-success" : "bg-surface-active")} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
