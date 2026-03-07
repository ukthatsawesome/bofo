/**
 * Electron API Provider
 *
 * Thin wrapper around the IPC implementations exposed by preload.js.
 * Primarily serves as a typed interface for the Main Process.
 */

import type { API } from '../types';

export const ElectronApiProvider = typeof window !== 'undefined' ? window.api : null;
