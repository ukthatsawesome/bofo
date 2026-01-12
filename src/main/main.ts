import { app, BrowserWindow, Menu, nativeImage, ipcMain, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import { registerIpcHandlers, performAutoBackup } from './ipc/handlers';
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
            nodeIntegration: false
        }
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
        { role: 'togglefullscreen' }
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
                            detail: 'A simple and efficient tool to manage your finances.'
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
    if (process.platform === 'win32') {
        app.setAppUserModelId('com.bofo.finance');
    }

    // Wait for database to be ready (encrypted and bootstrapped)
    try {
        await dbInitialized;
    } catch (err) {
        console.error('[Main] Database failed to initialize:', err);
    }

    registerIpcHandlers();

    // Listen for web server control
    ipcMain.on('restart-web-server', () => {
        restartWebServer();
    });

    setupMenu();
    createWindow();

    // Start web server if enabled in settings
    startWebServer();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', async () => {
    await performAutoBackup();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
