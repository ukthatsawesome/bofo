import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  ipcMain,
  MenuItemConstructorOptions,
  nativeTheme,
} from 'electron';
import * as path from 'path';
import { Logger } from './utils/logger';
import { registerIpcHandlers, performAutoBackup } from './ipc/handlers';
import { IpcRouter } from './ipc/router';
import { SettingsController } from './ipc/controllers/SettingsController';
import { TransactionController } from './ipc/controllers/TransactionController';
import { FinanceController } from './ipc/controllers/FinanceController';
import { startWebServer, restartWebServer } from './webServer';
import { dbInitialized } from './database/db';

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      if (windows[0].isMinimized()) windows[0].restore();
      windows[0].focus();
    }
  });
}

/**
 * Gets the correct icon path for both development and production
 */
function getIconPath(): string {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets', 'icons', iconName);
  } else {
    return path.join(__dirname, '../../assets/icons', iconName);
  }
}

function createWindow(): void {
  const iconPath = getIconPath();
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  win.setAutoHideMenuBar(true);
  win.setMenuBarVisibility(false);

  if (!app.isPackaged) {
    setTimeout(() => win.webContents.openDevTools(), 500);
  }
}

function setupMenu(): void {
  const isDev = !app.isPackaged;
  const viewSubmenu: MenuItemConstructorOptions[] = [
    { role: 'reload' },
    { role: 'forceReload' },
    { type: 'separator' },
    { role: 'resetZoom' },
    { role: 'zoomIn' },
    { role: 'zoomOut' },
    { type: 'separator' },
    { role: 'togglefullscreen' },
  ];

  if (isDev) {
    viewSubmenu.push({ type: 'separator' });
    viewSubmenu.push({ role: 'toggleDevTools' });
  }

  const template: MenuItemConstructorOptions[] = [
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { label: 'View', submenu: viewSubmenu },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Bofo',
          click: async () => {
            const { dialog } = require('electron');
            dialog.showMessageBox({
              type: 'info',
              title: 'About Bofo',
              message: 'Bofo - Personal Finance Manager',
              detail: 'A simple and efficient tool to manage your finances.',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.bofo.finance');
  }

  // Phase 1: Create Window IMMEDIATELY (Non-blocking)
  createWindow();

  // Phase 2: Async DB Initialization
  try {
    const windows = BrowserWindow.getAllWindows();
    const win = windows[0];

    // Inform renderer we are connecting (if it's listening)
    if (win) {
      win.webContents.on('did-finish-load', () => {
        win.webContents.send('app:db-status', 'connecting');
      });
    }

    Logger.info('[Main] Waiting for database...');
    await dbInitialized;
    Logger.info('[Main] Database ready.');

    if (win) {
      win.webContents.send('app:db-status', 'ready');
    }
  } catch (err) {
    Logger.error('[Main] Database failed to initialize:', err);
    // Send error to UI
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('app:db-status', 'error', (err as Error).message);
    }
  }

  try {
    // Phase 1: Initialize Router
    const settingsController = new SettingsController();
    const transactionController = new TransactionController();
    const financeController = new FinanceController();
    const router = new IpcRouter([settingsController, transactionController, financeController]);

    // Register new controller routes
    router.registerAll();
    Logger.info('[Main] IPC Router initialized successfully.');

    // Identify which channels were handled to prevent duplication in legacy
    const handled = router.getRegisteredChannels();
    registerIpcHandlers(handled);

  } catch (err) {
    Logger.error('[Main] IPC Router failed to initialize, falling back to legacy handlers:', err);
    // Fallback: register everything via legacy method
    registerIpcHandlers();
  }

  // Listen for web server control
  ipcMain.on('restart-web-server', () => {
    restartWebServer();
  });

  nativeTheme.on('updated', () => {
    const isDark = nativeTheme.shouldUseDarkColors;
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('native-theme-changed', isDark);
    });
  });

  setupMenu();
  // createWindow(); // Moved to Phase 1

  // Start web server if enabled in settings
  startWebServer();

  // Optional: Sync exchange rates on startup if enabled and stale
  performStartupRateSync();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * Sync exchange rates on startup if auto-sync is enabled and rates are stale
 */
async function performStartupRateSync(): Promise<void> {
  try {
    const { FinanceModel } = require('./models/finance');
    const settings = await FinanceModel.getAllSettings();

    // Check if auto-sync on startup is enabled (opt-in)
    if (settings.exchange_rate_sync_on_startup !== 'true') {
      return;
    }

    // Check if rates are stale
    const syncStatus = await FinanceModel.getRateSyncStatus();
    if (!syncStatus.isStale) {
      Logger.info('[Main] Exchange rates are up to date, skipping startup sync');
      return;
    }

    Logger.info('[Main] Exchange rates are stale, performing startup sync...');

    const CurrencyService = require('./services/currencyService').CurrencyService;
    const provider = settings.currency_api_provider || 'frankfurter';
    const baseCurrency = settings.currency_base || 'USD';
    const customUrl = settings.currency_custom_url || null;

    const rates = await CurrencyService.fetchRates(provider, baseCurrency, customUrl, false);
    const usedCurrencies = await FinanceModel.getUsedCurrencies();
    usedCurrencies.push(baseCurrency);

    const relevantRates = CurrencyService.filterRelevantRates(rates, usedCurrencies);
    await FinanceModel.setExchangeRatesBulk(relevantRates, 'api');
    await FinanceModel.updateSetting('currency_last_sync', new Date().toISOString());

    Logger.info(`[Main] Synced ${relevantRates.length} exchange rates on startup`);
  } catch (err) {
    Logger.warn('[Main] Startup rate sync failed:', (err as Error).message);
  }
}

app.on('window-all-closed', async () => {
  await performAutoBackup();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
