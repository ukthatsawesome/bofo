import { useState, useEffect } from 'preact/hooks';
import { AISettings } from '../../../../shared/types';

export function useAISettings() {
    const [settings, setSettings] = useState<AISettings>({
        enabled: false,
        url: '', // Will be populated by backend defaults
        model: '',
        promptTx: '',
        promptInsight: '',
        promptChat: ''
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isChecking, setIsChecking] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<boolean | null>(null);
    const [models, setModels] = useState<string[]>([]);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const data = await (window as any).api.getAISettings();
            setSettings(data);

            // If enabled, check connection and models
            if (data.enabled) {
                checkConnection(data.url);
                fetchModels(data.url);
            }
        } catch (err) {
            console.error('Failed to load AI settings', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchModels = async (url?: string) => {
        try {
            const modelList = await (window as any).api.getAIModels(url || settings.url);
            setModels(modelList || []);
        } catch (err) {
            console.error('Failed to fetch AI models', err);
            setModels([]);
        }
    };

    const checkConnection = async (url?: string) => {
        setIsChecking(true);
        try {
            // Note: The API might just return true/false
            const ok = await (window as any).api.checkAIConnection(url || settings.url);
            setConnectionStatus(!!ok);
        } catch (err) {
            setConnectionStatus(false);
        } finally {
            setIsChecking(false);
        }
    };

    const saveSettings = async (newSettings: AISettings) => {
        try {
            await (window as any).api.saveAISettings(newSettings);
            setSettings(newSettings);
            // Re-check if URL changed
            if (newSettings.enabled) {
                checkConnection(newSettings.url);
                fetchModels(newSettings.url);
            }
            return true;
        } catch (err) {
            console.error('Failed to save AI settings', err);
            return false;
        }
    };

    useEffect(() => {
        loadSettings();
    }, []);

    return {
        settings,
        setSettings,
        isLoading,
        isChecking,
        connectionStatus,
        models,
        checkConnection,
        fetchModels,
        saveSettings,
        refresh: loadSettings
    };
}
