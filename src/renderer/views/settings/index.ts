/**
 * Settings Modules Index
 * 
 * Exports all settings section mixins for use in SettingsView.
 * Each mixin contains the methods and state for a specific settings section.
 * 
 * Note: AI Settings is handled separately in the AI Settings view for better decoupling.
 */

import { AccountsSettingsMixin } from './AccountsSettings';
import { CategoriesSettingsMixin } from './CategoriesSettings';
import { BillsSettingsMixin } from './BillsSettings';
import { ExchangeRatesSettingsMixin } from './ExchangeRatesSettings';
import { BackupSettingsMixin } from './BackupSettings';
import { RemoteSettingsMixin } from './RemoteSettings';

// Re-export for external use
export {
    AccountsSettingsMixin,
    CategoriesSettingsMixin,
    BillsSettingsMixin,
    ExchangeRatesSettingsMixin,
    BackupSettingsMixin,
    RemoteSettingsMixin
};

/**
 * Applies all settings mixins to a target class instance.
 * This allows the SettingsView to inherit all mixin methods.
 * 
 * @param {Object} target - The SettingsView instance
 */
export function applySettingsMixins(target: any) {
    const mixins = [
        AccountsSettingsMixin,
        CategoriesSettingsMixin,
        BillsSettingsMixin,
        ExchangeRatesSettingsMixin,
        BackupSettingsMixin,
        RemoteSettingsMixin
    ];

    for (const mixin of mixins) {
        // Copy state properties
        for (const key of Object.keys(mixin)) {
            if (typeof (mixin as any)[key] !== 'function') {
                target[key] = (mixin as any)[key];
            }
        }

        // Bind methods to target
        for (const key of Object.keys(mixin)) {
            if (typeof (mixin as any)[key] === 'function') {
                target[key] = (mixin as any)[key].bind(target);
            }
        }
    }
}
