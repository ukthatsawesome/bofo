
import { useEffect, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { FinanceService } from '../core/lib/api/FinanceService'; // We'll need to strictly type this service next
import { financeStore } from '../core/financeStore';

// Global app initialization state
export const appState = signal({
    isDBReady: false,
    isThemeReady: false,
    isDataLoaded: false,
    error: null as string | null,
});

export const useAppInit = () => {
    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                // 1. Listen for DB Status from Main Process
                // In the legacy app, this was via IPC 'app:db-status'.
                // We should move this to a request-response or keep the listener.
                // For now, we'll optimistically assume we can start listening.

                window.api.onDbStatus((status: string, message?: string) => {
                    if (!mounted) return;
                    handleStatus(status, message);
                });

                // Check status immediately in case we missed the event
                const status = await window.api.getDbStatus();
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
                // Request initial theme
                const currentTheme = await window.api.getSettings().then(s => s.theme || 'system').catch(() => 'system');
                // Apply theme logic (refactored from legacy)
                applyTheme(currentTheme);

                // Listen for system changes if 'system' is selected
                // functionality needs to be ported here or handled by the store
                appState.value = { ...appState.value, isThemeReady: true };

            } catch (e: any) {
                if (mounted) {
                    appState.value = { ...appState.value, error: e.message };
                }
            }
        };

        init();

        return () => {
            mounted = false;
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
    document.documentElement.classList.toggle('dark', isDark);
    // Also notify main process if needed, or Main does it automatically?
    // Main actually sends 'native-theme-changed'.
};
