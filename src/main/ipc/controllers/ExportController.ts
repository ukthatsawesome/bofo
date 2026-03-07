import { BaseController } from './BaseController';
import { Route } from '../router';
import { dialog } from 'electron';
import { DateUtils } from '../../../shared/utils/dateUtils';
import { Logger } from '../../utils/logger';
import { runInWorker } from '../../utils/workerPool';
import { validateSafePath } from '../../utils/security';
import { createDbHelpers } from '../../database/helpers';
import * as fs from 'fs';
import * as path from 'path';
import { once } from 'events';
import { SETTING_KEYS } from '../../../shared/settings/keys';

const { all } = createDbHelpers(require('../../database/db').dbInstance);

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
          const LARGE_DB_THRESHOLD = 100 * 1024 * 1024;

          if (dbSize > LARGE_DB_THRESHOLD) {
            Logger.info(
              `[Export] Large database detected (${Math.round(dbSize / 1024 / 1024)}MB), using true streaming export`
            );
            const tableInfo = await model.getExportTableInfo();
            const CHUNK_SIZE = 1000000;
            const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });

            const writeToStream = async (chunk: string) => {
              if (!stream.write(chunk)) {
                await Promise.race([
                  once(stream, 'drain'),
                  once(stream, 'error').then(([err]) => Promise.reject(err)),
                ]);
              }
            };

            try {
              await writeToStream('{\n');
              await writeToStream(`  "version": 2,\n`);
              await writeToStream(`  "exportedAt": "${new Date().toISOString()}",\n`);
              await writeToStream('  "data": {\n');

              for (let i = 0; i < tableInfo.length; i++) {
                const table = tableInfo[i];
                const keyName = table.table.replace(/_([a-z])/g, (_: string, c: string) =>
                  c.toUpperCase()
                );
                await writeToStream(`    "${keyName}": [`);

                let offset = 0;
                let wroteRow = false;
                let hasMore = true;

                while (hasMore) {
                  let chunk = await model.exportTableChunk(
                    table.table,
                    table.whereClause,
                    CHUNK_SIZE,
                    offset
                  );

                  const rawLength = chunk.length;

                  if (table.table === 'settings') {
                    chunk = (chunk as any[]).filter((s) => s.key !== SETTING_KEYS.REMOTE.KEY);
                  }

                  if (chunk.length > 0) {
                    const chunkStr = JSON.stringify(chunk);
                    const inner = chunkStr.length > 2 ? chunkStr.slice(1, -1) : '';
                    if (inner) {
                      if (wroteRow) await writeToStream(',');
                      await writeToStream(inner);
                      wroteRow = true;
                    }
                  }

                  offset += CHUNK_SIZE;

                  hasMore = rawLength === CHUNK_SIZE;
                }

                await writeToStream(']');
                if (i < tableInfo.length - 1) {
                  await writeToStream(',\n');
                } else {
                  await writeToStream('\n');
                }
              }

              await writeToStream('  }\n');
              await writeToStream('}\n');
              await new Promise<void>((resolve, reject) => {
                stream.end(() => resolve());
                stream.once('error', reject);
              });
            } catch (err: any) {
              stream.destroy();
              Logger.error('Streaming export failed:', err?.message || err);
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

          const hasData =
            data.accounts ||
            data.transactions ||
            (data.data && (data.data.accounts || data.data.transactions));
          if (!hasData) {
            return { success: false, message: 'Invalid backup file format' };
          }
          const result = await this.getFinanceModel().importData(data);
          return result;
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
          const goalContributions = await all(
            `SELECT * FROM goal_contributions ORDER BY contributed_at DESC`
          );
          const sheets = [
            {
              name: 'Accounts',
              data: await model.getAllAccounts(),
              headers: ['id', 'name', 'type', 'balance', 'initial_balance', 'currency', 'status'],
            },
            {
              name: 'Transactions',
              data: await model.getAllTransactions(),
              headers: [
                'id',
                'start_date',
                'type',
                'category',
                'amount',
                'currency',
                'account_id',
                'to_account_id',
                'description',
                'frequency',
                'is_active',
              ],
            },
            {
              name: 'Categories',
              data: await model.getAllCategories(),
              headers: ['id', 'type', 'name', 'status', 'is_default', 'color', 'icon'],
            },
            {
              name: 'Budgets',
              data: await model.getAllBudgets(),
              headers: [
                'id',
                'category',
                'amount',
                'period',
                'start_date',
                'end_date',
                'created_at',
              ],
            },
            {
              name: 'Goals',
              data: await model.getAllGoals(),
              headers: [
                'id',
                'name',
                'description',
                'target_amount',
                'current_amount',
                'monthly_contribution',
                'target_date',
                'status',
                'priority',
              ],
            },
            {
              name: 'Goal Contributions',
              data: goalContributions,
              headers: ['id', 'goal_id', 'amount', 'source', 'notes', 'contributed_at'],
            },
            {
              name: 'Recurring Charges',
              data: await model.getAllRecurringCharges(),
              headers: [
                'id',
                'category',
                'name',
                'amount',
                'frequency',
                'due_day',
                'next_due_date',
                'is_active',
                'notes',
              ],
            },
            {
              name: 'Bill Types',
              data: await model.getBillTypes(),
              headers: [
                'id',
                'name',
                'unit_name',
                'cost_per_unit',
                'category_name',
                'account_id',
                'auto_transaction',
              ],
            },
            {
              name: 'Bill Readings',
              data: await model.getBillReadings({}),
              headers: ['id', 'bill_type_id', 'date', 'units_used', 'total_cost', 'notes'],
            },
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
