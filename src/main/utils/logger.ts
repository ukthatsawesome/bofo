import { app } from 'electron';

const isDev = !app.isPackaged;

export const Logger = {
    info: (...args: any[]) => {
        if (isDev) console.log('[Info]', ...args);
    },
    warn: (...args: any[]) => {
        if (isDev) console.warn('[Warn]', ...args);
    },
    error: (...args: any[]) => {
        // Always log errors, potentially to a file in production (handled by electron-log usually, but keeping simple here)
        console.error('[Error]', ...args);
    },
    // Allow explicit debug logs even in prod if needed by specific flag (optional)
    debug: (...args: any[]) => {
        if (isDev) console.debug('[Debug]', ...args);
    }
};
