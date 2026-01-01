const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { registerIpcHandlers } = require('./ipc/handlers');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, '../../assets/icons/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Hide menu bar by default, toggled with Alt
    win.setAutoHideMenuBar(true);
    win.setMenuBarVisibility(false);

    // Open DevTools only in development
    if (!app.isPackaged) {
        win.webContents.openDevTools();
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
    registerIpcHandlers();
    setupMenu();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
