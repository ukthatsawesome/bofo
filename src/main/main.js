const { app, BrowserWindow, Menu, nativeImage } = require('electron');
const path = require('path');
const { registerIpcHandlers, performAutoBackup } = require('./ipc/handlers');

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
 * In production, icons are in resources/assets/icons (from extraResources)
 */
function getIconPath() {
    const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';

    if (app.isPackaged) {
        // In production, extraResources are in resources folder
        return path.join(process.resourcesPath, 'assets', 'icons', iconName);
    } else {
        // In development, use the source path
        return path.join(__dirname, '../../assets/icons', iconName);
    }
}

function createWindow() {
    const iconPath = getIconPath();
    console.log('[Main] Icon path:', iconPath);

    // Create native image for better Windows taskbar support
    let icon;
    try {
        icon = nativeImage.createFromPath(iconPath);
        if (icon.isEmpty()) {
            console.log('[Main] Warning: Icon image is empty');
        }
    } catch (err) {
        console.log('[Main] Error loading icon:', err.message);
    }

    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: icon || iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });



    // DEVELOPMENT: Load Vite Dev Server
    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
        console.log('[Main] Loading Vite Dev Server:', process.env.VITE_DEV_SERVER_URL);
    }
    // PRODUCTION / PREVIEW: Load built file
    else {
        // Point to the built index.html in dist/renderer
        const indexPath = path.join(__dirname, '../../dist/renderer/index.html');
        win.loadFile(indexPath);
        console.log('[Main] Loading built file:', indexPath);
    }

    // Hide menu bar by default, toggled with Alt
    win.setAutoHideMenuBar(true);
    win.setMenuBarVisibility(false);

    // Open DevTools only in development
    if (!app.isPackaged) {
        setTimeout(() => win.webContents.openDevTools(), 500);
    }
}

function setupMenu() {
    const isDev = !app.isPackaged;

    // Build View submenu explicitly
    const viewSubmenu = [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
    ];

    // Add DevTools only in development
    if (isDev) {
        viewSubmenu.push({ type: 'separator' });
        viewSubmenu.push({ role: 'toggleDevTools' });
    }

    const template = [
        { role: 'fileMenu' },
        { role: 'editMenu' },
        {
            label: 'View',
            submenu: viewSubmenu
        },
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

app.whenReady().then(() => {
    // Set app ID for Windows taskbar - must match appId in package.json build config
    if (process.platform === 'win32') {
        app.setAppUserModelId('com.bofo.finance');
    }

    registerIpcHandlers();
    setupMenu();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', async () => {
    // Perform auto-backup before quitting
    await performAutoBackup();

    if (process.platform !== 'darwin') {
        app.quit();
    }
});
