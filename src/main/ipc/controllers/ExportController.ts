
import { BaseController } from './BaseController';
import { Route } from '../router';
import { dialog } from 'electron';
import { DateUtils } from '../../../shared/utils/dateUtils';
import { Logger } from '../../utils/logger';
import { runInWorker } from '../../utils/workerPool';
import { validateSafePath } from '../../utils/security';
import * as fs from 'fs';
import * as path from 'path';
import { SETTING_KEYS } from '../../../shared/settings/keys';

export class ExportController extends BaseController {

    registerRoutes(): Record<string, Route> {
        return {
            'get-backup-data': () => this.getFinanceModel().exportData(),
            'import-backup-data': (_, data) => this.getFinanceModel().importData(data),

            'export-data': async () => {
                try {
                    const model = this.getFinanceModel();
                    const { filePath } = await dialog.showSaveDialog({
                        buttonLabel: 'Export Data',
                        defaultPath: `bofo-export-${DateUtils.today()}.json`,
                        filters: [{ name: 'JSON', extensions: ['json'] }],
                    });

                    if (!filePath) return false;

                    const dbSize = await model.getDatabaseSize();
                    const LARGE_DB_THRESHOLD = 100 * 1024 * 1024; // 100MB

                    if (dbSize > LARGE_DB_THRESHOLD) {
                        Logger.info(`[Export] Large database detected (${Math.round(dbSize / 1024 / 1024)}MB), using streaming export`);
                        const tableInfo = await model.getExportTableInfo();
                        const tableData: Array<{ tableName: string; data: unknown[] }> = [];

                        for (const table of tableInfo) {
                            const data = await model.exportTableChunk(table.table, table.whereClause, 1000000, 0);
                            const keyName = table.table.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
                            tableData.push({ tableName: keyName, data });
                        }

                        const result = await runInWorker('exportWorker', {
                            type: 'json-streaming-export',
                            filePath,
                            tableData,
                        });

                        if (!result.success) {
                            Logger.error('Streaming export worker failed:', result.error);
                            return false;
                        }
                    } else {
                        const data = await model.exportData();
                        const result = await runInWorker('exportWorker', {
                            type: 'json-export',
                            data,
                            filePath,
                        });

                        if (!result.success) {
                            Logger.error('Export worker failed:', result.error);
                            return false;
                        }
                    }
                    return true;
                } catch (err) {
                    Logger.error('Export error:', err);
                    return false;
                }
            },

            'import-data': async () => {
                const { filePaths, canceled } = await dialog.showOpenDialog({
                    title: 'Import Backup',
                    buttonLabel: 'Import',
                    filters: [{ name: 'JSON Backup', extensions: ['json'] }],
                    properties: ['openFile'],
                });

                if (canceled || !filePaths?.length) {
                    return { success: false, message: 'Import cancelled' };
                }

                try {
                    const fileContent = await fs.promises.readFile(filePaths[0], 'utf8');
                    const data = JSON.parse(fileContent);
                    if (!data.accounts && !data.transactions) {
                        return { success: false, message: 'Invalid backup file format' };
                    }
                    await this.getFinanceModel().importData(data);
                    return { success: true, message: 'Data imported successfully!' };
                } catch (err: any) {
                    Logger.error('Import error:', err);
                    return { success: false, message: `Import failed: ${err.message}` };
                }
            },

            'export-excel': async () => {
                try {
                    const { filePath, canceled } = await dialog.showSaveDialog({
                        buttonLabel: 'Export Excel',
                        defaultPath: `bofo-export-${DateUtils.today()}.xlsx`,
                        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
                    });

                    if (canceled || !filePath) return false;

                    const model = this.getFinanceModel();
                    const sheets = [
                        { name: 'Accounts', data: await model.getAllAccounts(), headers: ['id', 'name', 'type', 'balance', 'initial_balance', 'currency', 'status'] },
                        { name: 'Transactions', data: await model.getAllTransactions(), headers: ['id', 'start_date', 'type', 'category', 'amount', 'currency', 'account_id', 'to_account_id', 'description', 'frequency', 'is_active'] },
                        { name: 'Categories', data: await model.getAllCategories(), headers: ['id', 'type', 'name', 'status', 'is_default', 'color', 'icon'] },
                        { name: 'Budgets', data: await model.getAllBudgets(), headers: ['id', 'category', 'amount', 'period', 'start_date', 'end_date', 'created_at'] },
                        { name: 'Goals', data: await model.getAllGoals(), headers: ['id', 'name', 'description', 'target_amount', 'current_amount', 'monthly_contribution', 'target_date', 'status', 'priority'] },
                        { name: 'Recurring Charges', data: await model.getAllRecurringCharges(), headers: ['id', 'category', 'name', 'amount', 'frequency', 'due_day', 'next_due_date', 'is_active', 'notes'] },
                        { name: 'Bill Types', data: await model.getBillTypes(), headers: ['id', 'name', 'unit_name', 'cost_per_unit', 'category_name', 'account_id', 'auto_transaction'] },
                        { name: 'Bill Readings', data: await model.getBillReadings({}), headers: ['id', 'bill_type_id', 'date', 'units_used', 'total_cost', 'notes'] },
                    ];

                    const result = await runInWorker('exportWorker', {
                        type: 'excel-export',
                        filePath,
                        options: { sheets },
                    });

                    if (!result.success) {
                        Logger.error('Excel export worker failed:', result.error);
                        return false;
                    }
                    return true;
                } catch (err) {
                    Logger.error('Excel export error:', err);
                    return false;
                }
            },

            'pick-backup-directory': async () => {
                const { filePaths, canceled } = await dialog.showOpenDialog({
                    title: 'Select Backup Directory',
                    properties: ['openDirectory', 'createDirectory'],
                });
                return canceled || !filePaths?.length ? null : filePaths[0];
            },

            'run-backup-now': async () => {
                try {
                    const model = this.getFinanceModel();
                    const settings = await model.getAllSettings();
                    const backupDir = settings[SETTING_KEYS.SAFETY.AUTO_BACKUP_DIRECTORY];
                    if (!backupDir || !fs.existsSync(backupDir))
                        return { success: false, message: 'Invalid backup directory' };

                    if (!validateSafePath(backupDir, 'dir')) {
                        Logger.error('[Backup] Blocked unsafe backup directory:', backupDir);
                        return { success: false, message: 'Backup directory path is unsafe' };
                    }

                    const data = await model.exportData();
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
                    const filePath = path.join(backupDir, `bofo-backup-${timestamp}.json`);

                    const result = await runInWorker('exportWorker', {
                        type: 'json-export',
                        data,
                        filePath,
                    });

                    if (!result.success) {
                        Logger.error('[Backup] Worker failed:', result.error);
                        return { success: false, message: result.error || 'Backup failed' };
                    }

                    await model.updateSetting(SETTING_KEYS.SAFETY.LAST_BACKUP, new Date().toISOString());
                    return { success: true, message: 'Backup saved' };
                } catch (err: any) {
                    return { success: false, message: err.message };
                }
            },
        };
    }
}
