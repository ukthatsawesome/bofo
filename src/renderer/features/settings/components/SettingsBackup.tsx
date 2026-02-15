import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { UiCard } from '@/components/ui/UiCard';
import { UiButton } from '@/components/ui/UiButton';
import { Input } from '@/components/ui/Input';
import { Download, Upload, FileText, Sheet, FolderOpen, Database, RefreshCw } from 'lucide-preact';
import { clsx } from 'clsx';
import { SectionTitle, Caption } from '@/components/ui/Typography';
import { SETTING_KEYS } from '../../../../shared/settings/keys';

export const SettingsBackup = () => {
    // Auto backup state
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
    const [backupDir, setBackupDir] = useState('');
    const [lastBackup, setLastBackup] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const load = async () => {
            const settings = await (window as any).api.getSettings();
            setAutoBackupEnabled(settings[SETTING_KEYS.SAFETY.AUTO_BACKUP_ENABLED] === 'true');
            setBackupDir(settings[SETTING_KEYS.SAFETY.AUTO_BACKUP_DIRECTORY] || '');
            setLastBackup(settings[SETTING_KEYS.SAFETY.LAST_BACKUP] || null);
        };
        load();
    }, []);

    const handleExport = async (type: 'json' | 'csv' | 'excel') => {
        try {
            if (type === 'json') await (window as any).api.exportData();
            if (type === 'csv') await (window as any).api.exportCSV();
            if (type === 'excel') await (window as any).api.exportExcel();
            alert('Export successful');
        } catch (error: any) {
            if (error.message !== 'cancelled') alert(error.message);
        }
    };

    const handleImport = async () => {
        if (!confirm('This will REPLACE all existing data. Continue?')) return;
        try {
            const result = await (window as any).api.importData();
            if (result?.success) {
                alert('Import successful. Reloading...');
                window.location.reload();
            }
        } catch (error: any) {
            if (error.message !== 'cancelled') alert(error.message);
        }
    };

    const toggleAutoBackup = async (checked: boolean) => {
        setAutoBackupEnabled(checked);
        await (window as any).api.updateSetting({
            key: SETTING_KEYS.SAFETY.AUTO_BACKUP_ENABLED,
            value: checked ? 'true' : 'false'
        });
    };

    const pickBackupDir = async () => {
        try {
            const result = await (window as any).api.pickBackupDirectory();
            if (result) {
                setBackupDir(result);
                await (window as any).api.updateSetting({
                    key: SETTING_KEYS.SAFETY.AUTO_BACKUP_DIRECTORY,
                    value: result
                });
            }
        } catch (err) {
            console.error(err);
        }
    };

    const runBackupNow = async () => {
        if (!backupDir) return alert('Select backup directory first');
        setLoading(true);
        try {
            await (window as any).api.runBackupNow(backupDir);
            const now = new Date().toISOString();
            setLastBackup(now);
            // handlers.ts updates LAST_BACKUP, so strictly we don't need to manually set it here?
            // But for UI responsiveness we can. API doesn't return the new time?
            // Actually handlers.ts *does* update it. We can re-fetch or just set local state.
            // Let's assume the runBackupNow call was successful.
            // Note: runBackupNow handler updates the setting in DB.
            // We'll update UI state, but won't manually call updateSetting again to avoid race/redundancy.
            // await (window as any).api.updateSetting({ key: 'last_backup_time', value: now });
            alert('Backup created successfully');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <SectionTitle>Backup & Data</SectionTitle>
                <Caption className="mt-1">Manage your data exports and recovery options</Caption>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <UiCard title="Manual Export" icon={<Download size={20} />}>
                    <div className="space-y-3">
                        <UiButton variant="secondary" className="w-full justify-start" icon={<Download size={18} />} onClick={() => handleExport('json')}>
                            Export Full Backup (.json)
                        </UiButton>
                        <UiButton variant="secondary" className="w-full justify-start" icon={<FileText size={18} />} onClick={() => handleExport('csv')}>
                            Export Transactions (.csv)
                        </UiButton>
                        <UiButton variant="secondary" className="w-full justify-start" icon={<Sheet size={18} />} onClick={() => handleExport('excel')}>
                            Export to Excel (.xlsx)
                        </UiButton>
                        <hr className="border-border my-4" />
                        <UiButton variant="secondary" className="w-full justify-start text-danger hover:text-danger hover:bg-danger/10" icon={<Upload size={18} />} onClick={handleImport}>
                            Import Backup (.json)
                        </UiButton>
                    </div>
                </UiCard>

                <UiCard title="Auto-Backup" icon={<Database size={20} />}>
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 p-4 bg-surface-hover/50 rounded-lg border border-border/50">
                            <input
                                type="checkbox"
                                id="ab-enabled"
                                className="w-5 h-5 rounded border-border cursor-pointer accent-brand-primary"
                                checked={autoBackupEnabled}
                                onChange={(e) => toggleAutoBackup((e.target as HTMLInputElement).checked)}
                            />
                            <label htmlFor="ab-enabled" className="text-sm font-medium cursor-pointer flex-1">
                                Enable Daily Backups
                                <p className="text-xs text-text-muted font-normal mt-0.5">
                                    Automatically backup data when app starts
                                </p>
                            </label>
                        </div>

                        <div className={clsx("space-y-4 transition-opacity", !autoBackupEnabled && "opacity-50 pointer-events-none")}>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Backup Location</label>
                                <div className="flex gap-2">
                                    <Input value={backupDir} readOnly className="flex-1" />
                                    <UiButton variant="secondary" icon={<FolderOpen size={18} />} onClick={pickBackupDir} />
                                </div>
                            </div>

                            <div className="bg-surface-base p-4 rounded-lg flex items-center justify-between">
                                <div>
                                    <div className="text-xs text-text-muted uppercase tracking-wider">Last Backup</div>
                                    <div className="font-mono text-sm mt-1">
                                        {lastBackup ? new Date(lastBackup).toLocaleString() : 'Never'}
                                    </div>
                                </div>
                                <UiButton size="sm" variant="outline" onClick={runBackupNow} isLoading={loading} icon={<RefreshCw size={14} />}>
                                    Run Now
                                </UiButton>
                            </div>
                        </div>
                    </div>
                </UiCard>
            </div>
        </div>
    );
};
