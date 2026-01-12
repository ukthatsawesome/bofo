import { $, UIUtils } from '../../core/dom.js';

export const RemoteSettingsMixin = {
    async populateRemoteSettings() {
        const { state } = this.app;

        // Poplulate inputs
        $('#set-remote-access-enabled').checked = state.settings.remote_access_enabled === 'true';
        $('#set-remote-access-port').value = state.settings.remote_access_port || '5174';
        $('#set-remote-access-key').value = state.settings.remote_access_key || '';

        // Bind generate key button
        const btnGen = $('#btn-remote-gen-key');
        if (btnGen) {
            btnGen.replaceWith(btnGen.cloneNode(true)); // Clear listeners
            $('#btn-remote-gen-key').addEventListener('click', () => {
                const key = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                $('#set-remote-access-key').value = key;
            });
        }

        this.updateRemoteConnectionInfo();
    },

    async updateRemoteConnectionInfo() {
        const isEnabled = $('#set-remote-access-enabled').checked;
        const infoBox = $('#remote-connection-info');

        if (isEnabled && window.api.getHostInfo) {
            const hostInfo = await window.api.getHostInfo();
            const port = $('#set-remote-access-port').value || '5174';

            if (hostInfo.ips && hostInfo.ips.length > 0) {
                // Show the address users should type in their browser
                // In dev mode (Vite), they visit 5173. In production, they visit the backend port (default 5174)
                const host = hostInfo.ips[0];
                const isVite = location.port === '5173';
                const displayPort = isVite ? '5173' : port;
                const displayProtocol = isVite ? location.protocol : 'http:';

                const displayUrl = `${displayProtocol}//${host}:${displayPort}`;

                $('#remote-host-address').textContent = displayUrl;
                UIUtils.setHidden('#remote-connection-info', false);
            }
        } else {
            UIUtils.setHidden('#remote-connection-info', true);
        }
    },

    async handleSaveRemoteSettings() {
        const enabled = $('#set-remote-access-enabled').checked;
        const port = $('#set-remote-access-port').value || '5174';
        const key = $('#set-remote-access-key').value;

        if (enabled && !key) {
            return this.app.notifications.toast('Error', 'Access Key is required when enabled', 'error');
        }

        try {
            await window.api.saveSettings({
                remote_access_enabled: enabled.toString(),
                remote_access_port: port,
                remote_access_key: key
            });

            await this.app.state.loadSettings();

            // Trigger server restart in main process
            if (window.api.restartWebServer) {
                // Not in preload yet, let's use a generic method or add it to preload
                // Actually, let's just use ipcRenderer via window.api if we exposed it
                // Or just send a setting change and let main process watch (but main process doesn't watch DB changes automatically)
                // So we'll use our new IPC message
                window.api.restartWebServer?.(); // If we add to preload
                // Alternative: window.ipcRenderer.send('restart-web-server');
                // Since we used contextBridge, we need specific exposure.
            }

            this.app.notifications.toast('Saved', 'Remote access settings updated', 'success');
            this.updateRemoteConnectionInfo();
        } catch (err) {
            this.app.notifications.toast('Error', err.message, 'error');
        }
    }
};
