
/**
 * IPC Handlers - Streamlined with Controller Pattern
 *
 * This module registers all IPC handlers for the Electron main process
 * by delegating to specialized Controllers.
 */

import { ipcMain } from 'electron';
import { IpcRouter } from './router';
import { TransactionController } from './controllers/TransactionController';
import { AccountController } from './controllers/AccountController';
import { BudgetController } from './controllers/BudgetController';
import { GoalController } from './controllers/GoalController';
import { SettingsController } from './controllers/SettingsController';
import { BillController } from './controllers/BillController';
import { RecurringController } from './controllers/RecurringController';
import { BofoAIController } from './controllers/BofoAIController';
import { ExchangeRateController } from './controllers/ExchangeRateController';
import { ExportController } from './controllers/ExportController';
import { AnomalyController } from './controllers/AnomalyController';
import { FinanceController } from './controllers/FinanceController';
import { CategoryController } from './controllers/CategoryController';
import { AuditController } from './controllers/AuditController';

// We need to keep performAutoBackup for main.ts usage if it calls it directly.
// The original file exported `performAutoBackup`.
// I should move `performAutoBackup` to ExportController as a static method or standalone export 
// BUT `handlers.ts` is likely imported by `main.ts` to call `registerIpcHandlers`.

// Let's import the performAutoBackup if I moved it, or implement it here using the controller logic.
// For now, I'll re-implement it using the Controller's logic or a shared helper. 
// Actually, `performAutoBackup` in original file was just a function. 
// I'll keep it here but refactor it to use the new structure or ExportController.
// Actually, I didn't export `performAutoBackup` in `ExportController.ts`. I should check.
// I didn't. I'll add it to `ExportController.ts` or just import it from there if I did. 
// Wait, I implemented `run-backup-now` route in `ExportController` but not the auto backup function.
// Let's add `performAutoBackup` to `handlers.ts` as a wrapper or import from a new location.
// Since `handlers.ts` is the entry point, I can keep `performAutoBackup` here but use the logic from `ExportController`?
// No, `performAutoBackup` is a scheduled task, not an IPC handler.
// I will keep `performAutoBackup` source here for now but cleaned up, or move to `ExportController` as static. 

import { Logger } from '../utils/logger';
import { validateSafePath } from '../utils/security';
import * as fs from 'fs';
import * as path from 'path';
import { runInWorker } from '../utils/workerPool';

export function registerIpcHandlers(excludeChannels: string[] = []): void {
  Logger.info('[Handlers] Starting IPC Handler registration...');
  const router = new IpcRouter([
    new AccountController(),
    new BudgetController(),
    new GoalController(),
    new SettingsController(),
    new BillController(),
    new RecurringController(),
    new BofoAIController(),
    new ExchangeRateController(),
    new ExportController(),
    new AnomalyController(),
    new FinanceController(),
    new CategoryController(),
    new AuditController(),
    new TransactionController(),
  ]);

  router.registerAll();
}

// Re-implement performAutoBackup for main.ts compatibility
export async function performAutoBackup() {
  try {
    // Lazy load model
    const { FinanceModel } = require('../models/finance');
    const settings = await FinanceModel.getAllSettings();
    if (settings.auto_backup_enabled !== 'true' || !settings.auto_backup_directory) return;
    if (!fs.existsSync(settings.auto_backup_directory)) return;

    if (!validateSafePath(settings.auto_backup_directory, 'dir')) {
      Logger.error('[Backup] Blocked unsafe auto-backup directory:', settings.auto_backup_directory);
      return;
    }

    const lastBackup = settings.auto_backup_last;
    if (lastBackup && new Date(lastBackup).toDateString() === new Date().toDateString()) return;

    const data = await FinanceModel.exportData();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filePath = path.join(settings.auto_backup_directory, `bofo-backup-${timestamp}.json`);

    const result = await runInWorker('exportWorker', {
      type: 'json-export',
      data,
      filePath,
    });

    if (!result.success) {
      Logger.error('[AutoBackup] Worker failed:', result.error);
      return;
    }

    await FinanceModel.updateSetting('auto_backup_last', new Date().toISOString());
  } catch (err) {
    Logger.error('Auto-backup failed:', err);
  }
}
