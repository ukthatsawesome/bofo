import { IpcMainInvokeEvent } from 'electron';
import { IController } from '../router';
import { validateSafePath } from '../../utils/security';

// Lazy load model to avoid circular deps if needed, or just standard import
// Assuming FinanceModel is available. 
import { FinanceModel } from '../../models/finance';
import type { FinanceModel as FinanceModelType } from '../../models/finance'; // If it was a class, but it's an object export

export class SettingsController implements IController {
  
  registerRoutes() {
    return {
      'get-settings': this.getSettings.bind(this),
      'update-setting': this.updateSetting.bind(this),
      'save-settings': this.saveSettings.bind(this),
    };
  }

  async getSettings(event: IpcMainInvokeEvent) {
    return await FinanceModel.getAllSettings();
  }

  async updateSetting(event: IpcMainInvokeEvent, { key, value }: { key: string; value: string }) {
    // Security Check
    if (key === 'auto_backup_directory' && value) {
      if (!validateSafePath(value, 'dir')) {
        throw new Error('Invalid or unsafe path provided for backup directory.');
      }
    }

    return await FinanceModel.updateSetting(key, value);
  }

  async saveSettings(event: IpcMainInvokeEvent, settings: Record<string, unknown>) {
    // Validate entire object if it contains sensitive keys
    if (settings['auto_backup_directory']) {
       if (!validateSafePath(String(settings['auto_backup_directory']), 'dir')) {
         throw new Error('Invalid or unsafe path provided for backup directory.');
       }
    }
    
    return await FinanceModel.saveSettings(settings);
  }
}
