import { app } from 'electron';

const isDev = app ? !app.isPackaged : process.env.NODE_ENV === 'development';

export const Logger = {
  info: (...args: any[]) => {
    if (isDev) console.log('[Info]', ...args);
  },
  warn: (...args: any[]) => {
    if (isDev) console.warn('[Warn]', ...args);
  },
  error: (...args: any[]) => {
    console.error('[Error]', ...args);
  },

  debug: (...args: any[]) => {
    if (isDev) console.debug('[Debug]', ...args);
  },
};
