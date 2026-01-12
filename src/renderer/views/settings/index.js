/**
 * Settings Modules Index
 * 
 * Exports all settings section mixins for use in SettingsView.
 * Each mixin contains the methods and state for a specific settings section.
 * 
 * Note: AI Settings is handled separately in the AI Settings view for better decoupling.
 */

import { AccountsSettingsMixin } from './AccountsSettings.js';
import { CategoriesSettingsMixin } from './CategoriesSettings.js';
import { BillsSettingsMixin } from './BillsSettings.js';
import { ExchangeRatesSettingsMixin } from './ExchangeRatesSettings.js';
import { BackupSettingsMixin } from './BackupSettings.js';
import { RemoteSettingsMixin } from './RemoteSettings.js';

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
export function applySettingsMixins(target) {
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
            if (typeof mixin[key] !== 'function') {
                target[key] = mixin[key];
            }
        }

        // Bind methods to target
        for (const key of Object.keys(mixin)) {
            if (typeof mixin[key] === 'function') {
                target[key] = mixin[key].bind(target);
            }
        }
    }
}
