/**
 * API Service Factory
 * 
 * Determines the correct API provider based on the runtime environment.
 * UI components should import 'api' from here, not window.api.
 */

import { HttpApiProvider } from './httpProvider.js';

// Static imports to avoid Top-Level Await compatibility issues
import { ElectronApiProvider } from './electronProvider.js';

// Feature detection: 'window.api' is injected by Electron's preload script.
// We check if it exists and has the 'invoke' method which implies IPC support.
const isElectron = window.api && typeof window.api.getTransactions === 'function';

let apiInstance;

if (isElectron) {
    // In Electron, we use the injected provider
    // Note: ElectronApiProvider is just a reference to window.api
    apiInstance = ElectronApiProvider;
    console.log('[API] Using Electron IPC Provider');
} else {
    apiInstance = new HttpApiProvider();
    console.log('[API] Using Web HTTP Provider');
}

export const api = apiInstance;
