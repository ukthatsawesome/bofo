import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { UiCard } from '@/components/ui/UiCard';
import { UiSelect } from '@/components/ui/UiSelect';
import { UiButton } from '@/components/ui/UiButton';
import { TrendingUp, Save } from 'lucide-preact';
import { SectionTitle, Caption } from '@/components/ui/Typography';

export const SettingsForecast = () => {
    const [range, setRange] = useState('12');
    const [includeRecurring, setIncludeRecurring] = useState(true);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const load = async () => {
            const settings = await (window as any).api.getSettings();
            setRange(settings.forecast_range_default || '12');
            setIncludeRecurring(settings.forecast_include_recurring !== '0');
        };
        load();
    }, []);

    const handleSave = async () => {
        setLoading(true);
        try {
            await (window as any).api.updateSetting({ key: 'forecast_range_default', value: range });
            await (window as any).api.updateSetting({ key: 'forecast_include_recurring', value: includeRecurring ? '1' : '0' });

            // Re-fetch logic if needed, or just toast
            alert('Forecast settings saved');
        } catch (err) {
            console.error(err);
            alert('Failed to save settings');
        } finally {
            setLoading(false);
        }
    };

    const rangeOptions = [
        { label: '6 Months', value: '6' },
        { label: '12 Months (1 Year)', value: '12' },
        { label: '24 Months (2 Years)', value: '24' },
        { label: '60 Months (5 Years)', value: '60' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <SectionTitle>Forecast Configuration</SectionTitle>
                <Caption className="mt-1">Adjust how your financial future is calculated</Caption>
            </div>

            <UiCard title="Projection Settings" icon={<TrendingUp size={20} />}>
                <div className="max-w-md space-y-6">
                    <UiSelect
                        label="Default Projection Range"
                        options={rangeOptions}
                        value={range}
                        onChange={(e) => setRange((e.target as HTMLSelectElement).value)}
                    />

                    <div className="flex items-center gap-3 p-4 bg-surface-hover/50 rounded-lg border border-border/50">
                        <input
                            type="checkbox"
                            id="fc-recur"
                            className="w-5 h-5 rounded border-border cursor-pointer accent-brand-primary"
                            checked={includeRecurring}
                            onChange={(e) => setIncludeRecurring((e.target as HTMLInputElement).checked)}
                        />
                        <label htmlFor="fc-recur" className="text-sm font-medium cursor-pointer flex-1">
                            Include Recurring Charges
                            <p className="text-xs text-text-muted font-normal mt-0.5">
                                Automatically project future bills based on active recurring charges
                            </p>
                        </label>
                    </div>

                    <div className="pt-2">
                        <UiButton onClick={handleSave} isLoading={loading} icon={<Save size={18} />}>
                            Save Configuration
                        </UiButton>
                    </div>
                </div>
            </UiCard>
        </div>
    );
};
