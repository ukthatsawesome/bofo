/**
 * Settings - Backup & Data Management Section
 * Handles data export/import and auto-backup functionality
 */

import { $ } from '../../core/dom.js';

export const BackupSettingsMixin = {
    // Export/Import handlers
    async handleExportData() {
        const { notifications } = this.app;
        try {
            await window.api.exportData();
            notifications.toast('Exported', 'Data backup saved successfully', 'success');
        } catch (error) {
            if (error.message !== 'cancelled') {
                notifications.toast('Error', error.message, 'error');
            }
        }
    },

    async handleExportCSV() {
        const { notifications } = this.app;
        try {
            await window.api.exportCSV();
            notifications.toast('Exported', 'CSV export saved successfully', 'success');
        } catch (error) {
            if (error.message !== 'cancelled') {
                notifications.toast('Error', error.message, 'error');
            }
        }
    },

    async handleExportExcel() {
        const { notifications } = this.app;
        try {
            await window.api.exportExcel();
            notifications.toast('Exported', 'Excel workbook saved successfully', 'success');
        } catch (error) {
            if (error.message !== 'cancelled') {
                notifications.toast('Error', error.message, 'error');
            }
        }
    },

    async handleImportData() {
        const { notifications } = this.app;

        const confirmed = await notifications.confirm(
            'Import Data',
            'This will REPLACE all existing data. Are you sure you want to continue?',
            { confirmText: 'Yes, Import', cancelText: 'Cancel', danger: true }
        );

        if (!confirmed) return;

        try {
            const result = await window.api.importData();
            if (result) {
                await this.app.loadData();
                notifications.toast('Imported', 'Data restored successfully', 'success');
            }
        } catch (error) {
            if (error.message !== 'cancelled') {
                notifications.toast('Error', error.message, 'error');
            }
        }
    },

    // Auto-backup handlers
    async populateAutoBackupSettings() {
        try {
            const settings = await window.api.getSettings();
            const enabled = settings.auto_backup_enabled === '1' || settings.auto_backup_enabled === 1;
            const directory = settings.auto_backup_directory || '';
            const lastBackup = settings.last_backup_time || null;

            const enabledCheckbox = $('#auto-backup-enabled');
            const dirInput = $('#auto-backup-directory');
            const dirGroup = $('#auto-backup-dir-group');
            const statusGroup = $('#auto-backup-status');
            const lastBackupEl = $('#last-backup-time');

            if (enabledCheckbox) enabledCheckbox.checked = enabled;
            if (dirInput) dirInput.value = directory;
            if (dirGroup) dirGroup.style.display = enabled ? 'block' : 'none';
            if (statusGroup) statusGroup.style.display = enabled ? 'block' : 'none';

            if (lastBackupEl) {
                lastBackupEl.textContent = lastBackup
                    ? new Date(lastBackup).toLocaleString()
                    : 'Never';
            }
        } catch (error) {
            console.error('Failed to load backup settings:', error);
        }
    },

    async handleAutoBackupToggle() {
        const enabled = $('#auto-backup-enabled')?.checked;
        const dirGroup = $('#auto-backup-dir-group');
        const statusGroup = $('#auto-backup-status');

        if (dirGroup) dirGroup.style.display = enabled ? 'block' : 'none';
        if (statusGroup) statusGroup.style.display = enabled ? 'block' : 'none';

        await window.api.updateSetting({ key: 'auto_backup_enabled', value: enabled ? '1' : '0' });
        this.app.notifications.toast('Updated', `Auto-backup ${enabled ? 'enabled' : 'disabled'}`, 'success');
    },

    async handlePickBackupDirectory() {
        const { notifications } = this.app;
        try {
            const result = await window.api.pickBackupDirectory();
            if (result) {
                const dirInput = $('#auto-backup-directory');
                if (dirInput) dirInput.value = result;
                await window.api.updateSetting({ key: 'auto_backup_directory', value: result });
                notifications.toast('Updated', 'Backup directory set', 'success');
            }
        } catch (error) {
            if (error.message !== 'cancelled') {
                notifications.toast('Error', error.message, 'error');
            }
        }
    },

    async handleRunBackupNow() {
        const { notifications } = this.app;
        const directory = $('#auto-backup-directory')?.value;

        if (!directory) {
            notifications.toast('Error', 'Please select a backup directory first', 'warning');
            return;
        }

        try {
            await window.api.runBackupNow(directory);
            const now = new Date().toISOString();
            await window.api.updateSetting({ key: 'last_backup_time', value: now });

            const lastBackupEl = $('#last-backup-time');
            if (lastBackupEl) lastBackupEl.textContent = new Date(now).toLocaleString();

            notifications.toast('Success', 'Backup completed', 'success');
        } catch (error) {
            notifications.toast('Error', error.message, 'error');
        }
    }
};
