import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { UiCard } from '@/components/ui/UiCard';
import { UiSelect } from '@/components/ui/UiSelect';
import { financeStore } from '@/core/financeStore';
import { Moon, Sun, Globe } from 'lucide-preact';
import { SectionTitle, Caption } from '@/components/ui/Typography';
import { api } from '@/core/lib/api';
import { CURRENCIES } from '../../../../shared/currencies';
import { SETTING_KEYS } from '../../../../shared/settings/keys';

const THEME_PREF_KEY = 'bofo_theme_preference';
const THEME_CACHE_KEY = 'bofo_theme_cache';

export const SettingsPreferences = () => {
  const [theme, setTheme] = useState<string>('system');
  const [currency, setCurrency] = useState<string>('USD');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const settings = await api.getSettings();
      setTheme(settings[SETTING_KEYS.APPEARANCE.THEME] || 'system');
      setCurrency(settings[SETTING_KEYS.CURRENCY.BASE] || 'USD');
    };
    load();
  }, []);

  const handleThemeChange = async (newTheme: string) => {
    setLoading(true);
    try {
      await api.updateSetting({ key: SETTING_KEYS.APPEARANCE.THEME, value: newTheme });
      setTheme(newTheme);

      const effectiveTheme =
        newTheme === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : newTheme;
      document.documentElement.setAttribute('data-theme', effectiveTheme);
      document.documentElement.classList.toggle('dark', effectiveTheme === 'dark');
      localStorage.setItem(THEME_PREF_KEY, newTheme);
      localStorage.setItem(THEME_CACHE_KEY, effectiveTheme);
    } finally {
      setLoading(false);
    }
  };

  const handleCurrencyChange = async (newCurrency: string) => {
    setLoading(true);
    try {
      await api.updateSetting({ key: SETTING_KEYS.CURRENCY.BASE, value: newCurrency });
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

  const currencies = CURRENCIES.map((c) => ({
    label: `${c.code} - ${c.name}`,
    value: c.code,
  }));

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
