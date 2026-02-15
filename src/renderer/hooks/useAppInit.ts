import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { financeStore } from '../core/financeStore';
import { api } from '../core/lib/api';
import { SETTING_KEYS } from '../../shared/settings/keys';

// Global app initialization state
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
                // 1. Listen for DB Status from Main Process
                // In the legacy app, this was via IPC 'app:db-status'.
                // We should move this to a request-response or keep the listener.
                // For now, we'll optimistically assume we can start listening.

                unsubscribeDbStatus = api.onDbStatus((status: string, message?: string) => {
                    if (!mounted) return;
                    handleStatus(status, message);
                });

                // Check status immediately in case we missed the event
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
                        appState.value = { ...appState.value, error: message || 'Database Initialization Failed' };
                    } else {
                        console.log(`[AppInit] Ignoring status: ${status}`);
                    }
                }

                // 2. Setup Theme
                const initTheme = async () => {
                    const settings = await api.getSettings();
                    const theme = settings[SETTING_KEYS.APPEARANCE.THEME] || 'system';
                    localStorage.setItem(THEME_PREF_KEY, theme);
                    applyTheme(theme);

                    // Listen for system theme changes
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
                        // We need to store this unsubscribe to clean it up
                        // But useAppInit is a one-time setup usually.
                        // Ideally we add it to the cleanup list.
                        // However, strictly speaking, useAppInit's effect cleanup handles unmounting.
                        // Let's create a local var for it to add to cleanup.
                        return unsubscribeTheme;
                    }
                    return null;
                };

                const themeUnsub = await initTheme();

                appState.value = { ...appState.value, isThemeReady: true };

                // Add to cleanup
                if (themeUnsub) {
                    // We need to modify the cleanup function return... 
                    // But we are inside async init(). 
                    // We should store it in a mutable var accessible by cleanup.
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
            // Stage 1: Load critical data (blocking)
            await financeStore.loadEssentialData();
            appState.value = { ...appState.value, isDataLoaded: true };

            // Stage 2: Load secondary data (non-blocking / background)
            // We don't await this, ensuring UI renders immediately after Stage 1
            financeStore.loadSecondaryData().catch(err => {
                console.error("Background data load failed", err);
            });

        } catch (e: any) {
            console.error("Failed to load initial data", e);
            appState.value = { ...appState.value, error: "Failed to load application data" };
        }
    };

    return appState.value;
};

// Helper for theme (can be moved to a useTheme hook later)
const applyTheme = (theme: string) => {
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const effectiveTheme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem(THEME_CACHE_KEY, effectiveTheme);
    // Also notify main process if needed, or Main does it automatically?
    // Main actually sends 'native-theme-changed'.
};
