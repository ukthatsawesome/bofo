import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { UiCard } from '@/components/ui/UiCard';
import { UiSelect } from '@/components/ui/UiSelect';
import { financeStore } from '@/core/financeStore';
import { Moon, Sun, Globe } from 'lucide-preact';
import { SectionTitle, Caption } from '@/components/ui/Typography';

export const SettingsPreferences = () => {
    // We can assume financeStore.settings has been loaded by App init, 
    // but financeStore doesn't expose a raw settings signal directly in the same way.
    // Let's check financeStore contents or just use window.api for now to be safe.

    const [theme, setTheme] = useState<string>('system');
    const [currency, setCurrency] = useState<string>('USD');
    const [loading, setLoading] = useState(false);

    // Initial Load
    useEffect(() => {
        const load = async () => {
            const settings = await (window as any).api.getSettings();
            setTheme(settings.theme || 'system');
            setCurrency(settings.currency_base || 'USD');
        };
        load();
    }, []);

    const handleThemeChange = async (newTheme: string) => {
        setLoading(true);
        try {
            await (window as any).api.updateSetting({ key: 'theme', value: newTheme });
            setTheme(newTheme);
            (window as any).location.reload(); // Simple reload to apply theme for now
        } finally {
            setLoading(false);
        }
    };

    const handleCurrencyChange = async (newCurrency: string) => {
        setLoading(true);
        try {
            await (window as any).api.updateSetting({ key: 'currency_base', value: newCurrency });
            setCurrency(newCurrency);
            // Ideally trigger a store refresh
        } finally {
            setLoading(false);
        }
    };

    const themes = [
        { label: 'System Default', value: 'system' },
        { label: 'Light Mode', value: 'light' },
        { label: 'Dark Mode', value: 'dark' },
    ];

    const currencies = [
        { label: 'USD - US Dollar', value: 'USD' },
        { label: 'EUR - Euro', value: 'EUR' },
        { label: 'GBP - British Pound', value: 'GBP' },
        { label: 'JPY - Japanese Yen', value: 'JPY' },
        // Add more if available from a shared constant
    ];

    return (
        <div className="space-y-6">
            <div>
                <SectionTitle>Preferences</SectionTitle>
                <Caption className="mt-1">Customize your app experience</Caption>
            </div>

            <UiCard title="Appearance" icon={<Sun size={20} />}>
                <div className="max-w-md">
                    <UiSelect
                        label="Theme"
                        options={themes}
                        value={theme}
                        onChange={(e) => handleThemeChange((e.target as HTMLSelectElement).value)}
                        disabled={loading}
                    />
                    <p className="text-xs text-text-muted mt-2">
                        Choose your preferred visual theme. System default follows your OS settings.
                    </p>
                </div>
            </UiCard>

            <UiCard title="Localization" icon={<Globe size={20} />}>
                <div className="max-w-md">
                    <UiSelect
                        label="Base Currency"
                        options={currencies}
                        value={currency}
                        onChange={(e) => handleCurrencyChange((e.target as HTMLSelectElement).value)}
                        disabled={loading}
                    />
                    <p className="text-xs text-text-muted mt-2">
                        This is the primary currency used for aggregation and reports.
                    </p>
                </div>
            </UiCard>
        </div>
    );
};
