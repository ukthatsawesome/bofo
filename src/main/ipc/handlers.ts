/**
 * IPC Handlers - Streamlined with Controller Pattern
 *
 * This module registers all IPC handlers for the Electron main process
 * and orchestrates background tasks like automated backups.
 */

import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Utils
import { Logger } from '../utils/logger';
import { validateSafePath } from '../utils/security';
import { runInWorker } from '../utils/workerPool';
import { isDbReady } from '../database/db';

// Controllers
import { AccountController } from './controllers/AccountController';
import { AnomalyController } from './controllers/AnomalyController';
import { AuditController } from './controllers/AuditController';
import { BillController } from './controllers/BillController';
import { BofoAIController } from './controllers/BofoAIController';
import { BudgetController } from './controllers/BudgetController';
import { CategoryController } from './controllers/CategoryController';
import { ExchangeRateController } from './controllers/ExchangeRateController';
import { ExportController } from './controllers/ExportController';
import { FinanceController } from './controllers/FinanceController';
import { GoalController } from './controllers/GoalController';
import { RecurringController } from './controllers/RecurringController';
import { SettingsController } from './controllers/SettingsController';
import { TransactionController } from './controllers/TransactionController';

// Core
import { IpcRouter } from './router';

// ==================== IPC Registration ====================

/**
 * Registers all IPC handlers with the main process.
 * Delegates to the IpcRouter which manages Controller lifecycles.
 */
export function registerIpcHandlers(excludeChannels: string[] = []): void {
  Logger.info('[Handlers] Initializing IPC Controller Router...');

  const controllers = [
    new AccountController(),
    new AnomalyController(),
    new AuditController(),
    new BillController(),
    new BofoAIController(),
    new BudgetController(),
    new CategoryController(),
    new ExchangeRateController(),
    new ExportController(),
    new FinanceController(),
    new GoalController(),
    new RecurringController(),
    new SettingsController(),
    new TransactionController(),
  ];

  const router = new IpcRouter(controllers);

  if (excludeChannels.length > 0) {
    Logger.info(`[Handlers] Excluding channels: ${excludeChannels.join(', ')}`);
    // Note: IpcRouter implementation would need to support this, 
    // currently preserving signature for compatibility.
  }

  router.registerAll();
  Logger.info(`[Handlers] Successfully registered ${controllers.length} controllers.`);
}

// ==================== Background Tasks ====================

/**
 * Performs an automated backup of the financial data.
 * Checks settings, validates security, runs the export in a worker thread,
 * and updates the last backup timestamp.
 */
export async function performAutoBackup(): Promise<void> {
  try {
    if (!isDbReady()) {
      Logger.warn('[AutoBackup] Skipping backup: database not ready');
      return;
    }
    // Lazy load model to minimize startup overhead if not needed immediately
    const { FinanceModel } = require('../models/finance');
    const settings = await FinanceModel.getAllSettings();

    // 1. Check if auto-backup is enabled and configured
    if (settings.auto_backup_enabled !== 'true' || !settings.auto_backup_directory) {
      return;
    }

    // 2. Validate directory existence
    if (!fs.existsSync(settings.auto_backup_directory)) {
      Logger.warn(`[AutoBackup] Directory does not exist: ${settings.auto_backup_directory}`);
      return;
    }

    // 3. Security check
    if (!validateSafePath(settings.auto_backup_directory, 'dir')) {
      Logger.error('[AutoBackup] Blocked unsafe auto-backup directory:', settings.auto_backup_directory);
      return;
    }

    // 4. Check if backup already ran today
    const lastBackup = settings.auto_backup_last;
    if (lastBackup && new Date(lastBackup).toDateString() === new Date().toDateString()) {
      return;
    }

    // 5. Execute Backup
    const data = await FinanceModel.exportData();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileName = `bofo-backup-${timestamp}.json`;
    const filePath = path.join(settings.auto_backup_directory, fileName);

    const result = await runInWorker('exportWorker', {
      type: 'json-export',
      data,
      filePath,
    });

    if (!result.success) {
      Logger.error('[AutoBackup] Worker export failed:', result.error);
      return;
    }

    // 6. Update last run time
    await FinanceModel.updateSetting('auto_backup_last', new Date().toISOString());
    Logger.info(`[AutoBackup] Successfully created backup: ${fileName}`);

  } catch (err) {
    Logger.error('[AutoBackup] Process failed:', err);
  }
}
