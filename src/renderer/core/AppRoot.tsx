
import { h } from 'preact';
import { Routes } from '../routes/Routes';
import { useAppInit } from '../hooks/useAppInit';

// --- Styles ---
import '../assets/styles/app/validation.css';
import '../assets/styles/app/transfer-preview.css';

/**
 * AppRoot - The Modern Entry Point
 * 
 * Replaces the legacy "God Object" initialization with a functional hook.
 * Handles the application lifecycle:
 * 1. Waiting for DB connection
 * 2. Applying Theme
 * 3. Loading Initial Data
 */
export const AppRoot = () => {
    const { isDBReady, isDataLoaded, error } = useAppInit();

    // Show Error Screen
    if (error) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-100">
                <div className="text-center p-8 bg-white dark:bg-surface-800 rounded-lg shadow-xl max-w-md">
                    <h1 className="text-2xl font-bold mb-4">Startup Error</h1>
                    <p className="mb-6 opacity-80">{error}</p>
                    <button
                        onClick={() => window.api.restartWebServer()}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                    >
                        Restart App
                    </button>
                </div>
            </div>
        );
    }

    // Show Loading Screen until DB and Data are ready
    if (!isDBReady || !isDataLoaded) {
        // We can render a splash screen here, or let the index.html loader persist
        // by returning null (checking if that hides the static loader? 
        // usually index.html loader is removed when AppRoot mounts, 
        // but since we return null, we might want to render an explicit loader to be safe)
        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-surface-50 dark:bg-surface-900 text-primary">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="animate-pulse opacity-70">Initializing Bofo...</p>
            </div>
        );
    }

    // Main App
    return (
        <div className="h-full w-full">
            <Routes />
        </div>
    );
};
