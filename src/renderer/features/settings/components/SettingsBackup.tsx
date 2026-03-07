import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { UiCard } from '@/components/ui/UiCard';
import { UiButton } from '@/components/ui/UiButton';
import { Input } from '@/components/ui/Input';
import {
  Download,
  Upload,
  FileText,
  Sheet,
  FolderOpen,
  Database,
  RefreshCw,
  AlertTriangle,
} from 'lucide-preact';
import { clsx } from 'clsx';
import { SectionTitle, Caption } from '@/components/ui/Typography';
import { SETTING_KEYS } from '../../../../shared/settings/keys';
import { notify } from '@/core/lib/notify';

export const SettingsBackup = () => {
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [backupDir, setBackupDir] = useState('');
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [importStep, setImportStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState('');

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
      notify.success('Export Successful', 'Your data has been exported');
    } catch (error: any) {
      if (error.message !== 'cancelled') notify.error('Export Failed', error.message);
    }
  };

  const startImport = async () => {
    const proceed = await notify.confirm(
      'Import Data',
      'This will replace ALL existing data. We recommend exporting a backup first. Continue?',
      'warning'
    );
    if (proceed) {
      setImportStep(2);
    }
  };

  const confirmImport = async () => {
    if (confirmText !== 'REPLACE') {
      notify.error('Confirmation Required', 'Please type REPLACE to confirm');
      return;
    }

    try {
      const result = await (window as any).api.importData();
      if (result?.success) {
        notify.success('Import Successful', 'Reloading application...');
        window.location.reload();
      }
    } catch (error: any) {
      if (error.message !== 'cancelled') notify.error('Import Failed', error.message);
    }

    setImportStep(1);
    setConfirmText('');
  };

  const cancelImport = () => {
    setImportStep(1);
    setConfirmText('');
  };

  const toggleAutoBackup = async (checked: boolean) => {
    setAutoBackupEnabled(checked);
    await (window as any).api.updateSetting({
      key: SETTING_KEYS.SAFETY.AUTO_BACKUP_ENABLED,
      value: checked ? 'true' : 'false',
    });
  };

  const pickBackupDir = async () => {
    try {
      const result = await (window as any).api.pickBackupDirectory();
      if (result) {
        setBackupDir(result);
        await (window as any).api.updateSetting({
          key: SETTING_KEYS.SAFETY.AUTO_BACKUP_DIRECTORY,
          value: result,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const runBackupNow = async () => {
    if (!backupDir) {
      notify.error('Directory Required', 'Please select a backup directory first');
      return;
    }
    setLoading(true);
    try {
      await (window as any).api.runBackupNow(backupDir);
      const now = new Date().toISOString();
      setLastBackup(now);
      notify.success('Backup Complete', 'Backup has been created successfully');
    } catch (error: any) {
      notify.error('Backup Failed', error.message);
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
            <UiButton
              variant="secondary"
              className="w-full justify-start"
              icon={<Download size={18} />}
              onClick={() => handleExport('json')}
            >
              Export Full Backup (.json)
            </UiButton>
            <UiButton
              variant="secondary"
              className="w-full justify-start"
              icon={<FileText size={18} />}
              onClick={() => handleExport('csv')}
            >
              Export Transactions (.csv)
            </UiButton>
            <UiButton
              variant="secondary"
              className="w-full justify-start"
              icon={<Sheet size={18} />}
              onClick={() => handleExport('excel')}
            >
              Export to Excel (.xlsx)
            </UiButton>
            <hr className="border-border my-4" />
            <UiButton
              variant="secondary"
              className="w-full justify-start text-danger hover:text-danger hover:bg-danger/10"
              icon={<Upload size={18} />}
              onClick={startImport}
            >
              Import Backup (.json)
            </UiButton>

            {/* Step 2: Confirm Import */}
            {importStep === 2 && (
              <div className="mt-4 p-4 bg-danger/10 border border-danger/20 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-danger font-semibold">
                  <AlertTriangle size={18} />
                  Warning: This will replace ALL data
                </div>
                <p className="text-sm text-text-muted">
                  Type <span className="font-mono font-bold text-danger">REPLACE</span> to confirm:
                </p>
                <Input
                  value={confirmText}
                  onInput={(e) => setConfirmText((e.target as HTMLInputElement).value)}
                  placeholder="Type REPLACE"
                  className="font-mono"
                />
                <div className="flex gap-2">
                  <UiButton variant="ghost" className="flex-1" onClick={cancelImport}>
                    Cancel
                  </UiButton>
                  <UiButton
                    variant="primary"
                    className="flex-1 bg-danger hover:bg-danger/90"
                    onClick={confirmImport}
                  >
                    Confirm Import
                  </UiButton>
                </div>
              </div>
            )}
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

            <div
              className={clsx(
                'space-y-4 transition-opacity',
                !autoBackupEnabled && 'opacity-50 pointer-events-none'
              )}
            >
              <div>
                <label className="text-sm font-medium mb-1 block">Backup Location</label>
                <div className="flex gap-2">
                  <Input value={backupDir} readOnly className="flex-1" />
                  <UiButton
                    variant="secondary"
                    icon={<FolderOpen size={18} />}
                    onClick={pickBackupDir}
                  />
                </div>
              </div>

              <div className="bg-surface-base p-4 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs text-text-muted uppercase tracking-wider">
                    Last Backup
                  </div>
                  <div className="font-mono text-sm mt-1">
                    {lastBackup ? new Date(lastBackup).toLocaleString() : 'Never'}
                  </div>
                </div>
                <UiButton
                  size="sm"
                  variant="outline"
                  onClick={runBackupNow}
                  isLoading={loading}
                  icon={<RefreshCw size={14} />}
                >
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
