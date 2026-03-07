import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { financeStore } from '../core/financeStore';
import { api } from '../core/lib/api';
import { SETTING_KEYS } from '../../shared/settings/keys';

interface AppState {
  isDBReady: boolean;
  isThemeReady: boolean;
  isDataLoaded: boolean;
  error: string | null;
}

export const appState = signal<AppState>({
  isDBReady: false,
  isThemeReady: false,
  isDataLoaded: false,
  error: null,
});

const THEME_PREF_KEY = 'bofo_theme_preference';
const THEME_CACHE_KEY = 'bofo_theme_cache';

export const useAppInit = () => {
  useEffect(() => {
    let mounted = true;
    let unsubscribeDbStatus: (() => void) | null = null;
    let unsubscribeTheme: (() => void) | null = null;

    const init = async () => {
      try {
        unsubscribeDbStatus = api.onDbStatus((status: string, message?: string) => {
          if (!mounted) return;
          handleStatus(status, message);
        });

        const status = await api.getDbStatus();
        handleStatus(status);

        function handleStatus(status: string, message?: string) {
          console.log(`[AppInit] Handling status: ${status}, message: ${message}`);
          if (status === 'ready') {
            if (!appState.value.isDBReady) {
              console.log('[AppInit] DB Ready. Loading data...');
              appState.value = { ...appState.value, isDBReady: true };
              loadInitialData();
            }
          } else if (status === 'error') {
            console.error('[AppInit] DB Error detected');
            appState.value = {
              ...appState.value,
              error: message || 'Database Initialization Failed',
            };
          } else {
            console.log(`[AppInit] Ignoring status: ${status}`);
          }
        }

        const initTheme = async () => {
          const settings = await api.getSettings();
          const theme = settings[SETTING_KEYS.APPEARANCE.THEME] || 'system';
          localStorage.setItem(THEME_PREF_KEY, theme);
          applyTheme(theme);

          if (api.onNativeThemeChanged) {
            const unsubscribeTheme = api.onNativeThemeChanged((isDark: boolean) => {
              const currentPreference = localStorage.getItem(THEME_PREF_KEY) || theme;
              if (currentPreference === 'system') {
                const effectiveTheme = isDark ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', effectiveTheme);
                document.documentElement.classList.toggle('dark', isDark);
                localStorage.setItem(THEME_CACHE_KEY, effectiveTheme);
              }
            });

            return unsubscribeTheme;
          }
          return null;
        };

        const themeUnsub = await initTheme();

        appState.value = { ...appState.value, isThemeReady: true };

        if (themeUnsub) {
          unsubscribeTheme = themeUnsub;
        }
      } catch (e: any) {
        if (mounted) {
          appState.value = { ...appState.value, error: e.message };
        }
      }
    };

    init();

    return () => {
      mounted = false;
      if (unsubscribeDbStatus) unsubscribeDbStatus();
      if (unsubscribeTheme) unsubscribeTheme();
    };
  }, []);

  const loadInitialData = async () => {
    try {
      await financeStore.loadEssentialData();
      appState.value = { ...appState.value, isDataLoaded: true };

      financeStore.loadSecondaryData().catch((err) => {
        console.error('Background data load failed', err);
      });
    } catch (e: any) {
      console.error('Failed to load initial data', e);
      appState.value = { ...appState.value, error: 'Failed to load application data' };
    }
  };

  return appState.value;
};

const applyTheme = (theme: string) => {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const effectiveTheme = isDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', effectiveTheme);
  document.documentElement.classList.toggle('dark', isDark);
  localStorage.setItem(THEME_CACHE_KEY, effectiveTheme);
  // Also notify main process if needed, or Main does it automatically?
  // Main actually sends 'native-theme-changed'.
};
