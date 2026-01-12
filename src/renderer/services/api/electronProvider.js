/**
 * Electron API Provider
 * 
 * Thin wrapper around the IPC implementations exposed by preload.js.
 * Primarily serves as a typed interface for the Main Process.
 */

// In Electron, the 'api' object is injected into window by preload.js
export const ElectronApiProvider = (typeof window !== 'undefined') ? window.api : null;

// If we wanted to add client-side logging or interceptors,
// we would wrap it here. For now, direct access is most efficient.
