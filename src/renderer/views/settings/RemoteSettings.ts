import { $, UIUtils } from '../../core/dom';
import type { SettingsView } from '../SettingsView';

interface HostInfo {
    ips: string[];
}

export const RemoteSettingsMixin = {
    async populateRemoteSettings(this: SettingsView) {
        const { state } = this.app;

        // Populate inputs
        const enabledCheckbox = $('#set-remote-access-enabled') as HTMLInputElement;
        const portInput = $('#set-remote-access-port') as HTMLInputElement;
        const keyInput = $('#set-remote-access-key') as HTMLInputElement;

        if (enabledCheckbox) enabledCheckbox.checked = state.settings.remote_access_enabled === 'true';
        if (portInput) portInput.value = state.settings.remote_access_port || '5174';
        if (keyInput) keyInput.value = state.settings.remote_access_key || '';

        // Bind generate key button
        const btnGen = $('#btn-remote-gen-key');
        if (btnGen) {
            // TypeScript doesn't like cloning and replacing to remove listeners easily, but this works
            const newBtn = btnGen.cloneNode(true) as HTMLElement;
            btnGen.parentNode?.replaceChild(newBtn, btnGen);

            newBtn.addEventListener('click', () => {
                const key = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                if (keyInput) keyInput.value = key;
            });
        }

        this.updateRemoteConnectionInfo();
    },

    async updateRemoteConnectionInfo(this: SettingsView) {
        const isEnabled = ($('#set-remote-access-enabled') as HTMLInputElement)?.checked;
        const infoBox = $('#remote-connection-info');

        if (isEnabled && window.api.getHostInfo) {
            const hostInfo: HostInfo = await window.api.getHostInfo();
            const port = ($('#set-remote-access-port') as HTMLInputElement)?.value || '5174';

            if (hostInfo.ips && hostInfo.ips.length > 0) {
                // Show the address users should type in their browser
                // In dev mode (Vite), they visit 5173. In production, they visit the backend port (default 5174)
                const host = hostInfo.ips[0];
                const isVite = location.port === '5173';
                const displayPort = isVite ? '5173' : port;
                const displayProtocol = isVite ? location.protocol : 'http:';

                const displayUrl = `${displayProtocol}//${host}:${displayPort}`;

                const addressEl = $('#remote-host-address');
                if (addressEl) addressEl.textContent = displayUrl;

                UIUtils.setHidden('#remote-connection-info', false);
            }
        } else {
            UIUtils.setHidden('#remote-connection-info', true);
        }
    },

    async handleSaveRemoteSettings(this: SettingsView) {
        const enabled = ($('#set-remote-access-enabled') as HTMLInputElement)?.checked;
        const port = ($('#set-remote-access-port') as HTMLInputElement)?.value || '5174';
        const key = ($('#set-remote-access-key') as HTMLInputElement)?.value;

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
                window.api.restartWebServer?.();
            }

            this.app.notifications.toast('Saved', 'Remote access settings updated', 'success');
            this.updateRemoteConnectionInfo();
        } catch (err: any) {
            this.app.notifications.toast('Error', err.message, 'error');
        }
    }
};
