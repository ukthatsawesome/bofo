/**
 * API Service Factory
 *
 * Determines the correct API provider based on the runtime environment.
 * UI components should import 'api' from here, not window.api.
 */

import { HttpApiProvider } from './httpProvider';
import { ElectronApiProvider } from './electronProvider';
import type { API } from '../types';

const isElectron = window.api && typeof window.api.getTransactions === 'function';

let apiInstance: API;

if (isElectron) {
  apiInstance = ElectronApiProvider as API;
  console.log('[API] Using Electron IPC Provider');
} else {
  apiInstance = new HttpApiProvider() as unknown as API;
  console.log('[API] Using Web HTTP Provider');
}

export const api = apiInstance;
