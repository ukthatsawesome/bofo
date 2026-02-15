import { z } from 'zod';
import { SETTING_KEYS } from './keys';
import { DEFAULTS, DEFAULT_CURRENCY, DEFAULT_AI_URL, DEFAULT_AI_MODEL } from './defaults';

// Core settings schema - Using centralized defaults
export const SettingsSchema = z.object({
    // Budget
    [SETTING_KEYS.BUDGET.PERIOD]: z.enum(['weekly', 'monthly', 'yearly']).default('monthly'),
    [SETTING_KEYS.BUDGET.ROLLOVER]: z.enum(['true', 'false']).default('false'),

    // Forecast
    [SETTING_KEYS.FORECAST.HORIZON]: z.string().regex(/^\d+$/).default(String(DEFAULTS.FORECAST.HORIZON)),
    [SETTING_KEYS.FORECAST.UNCERTAIN_INCOME]: z.enum(['include', 'exclude', 'ask']).default('ask'),
    [SETTING_KEYS.FORECAST.INFLATION_ENABLED]: z.enum(['true', 'false']).default('false'),
    [SETTING_KEYS.FORECAST.INFLATION_RATE]: z.string().regex(/^\d+(\.\d+)?$/).default(String(DEFAULTS.FORECAST.INFLATION_RATE)),
    [SETTING_KEYS.FORECAST.INCLUDE_RECURRING]: z.enum(['true', 'false']).default('true'),

    // Currency - Use centralized defaults
    [SETTING_KEYS.CURRENCY.BASE]: z.string().default(DEFAULT_CURRENCY),
    [SETTING_KEYS.CURRENCY.PRECISION]: z.string().regex(/^\d+$/).default(DEFAULTS.CURRENCY.PRECISION),
    [SETTING_KEYS.CURRENCY.SYMBOL_PLACEMENT]: z.enum(['before', 'after']).default(DEFAULTS.CURRENCY.SYMBOL_PLACEMENT),
    [SETTING_KEYS.CURRENCY.API_PROVIDER]: z.string().default('frankfurter'),
    [SETTING_KEYS.CURRENCY.CUSTOM_URL]: z.string().optional().default(''),
    [SETTING_KEYS.CURRENCY.AUTO_SYNC]: z.enum(['true', 'false']).default('false'),
    [SETTING_KEYS.CURRENCY.LAST_SYNC]: z.string().optional().default(''),

    // Appearance - Use centralized defaults
    [SETTING_KEYS.APPEARANCE.THEME]: z.enum(['light', 'dark', 'system']).default(DEFAULTS.APPEARANCE.THEME),
    [SETTING_KEYS.APPEARANCE.LANDING_VIEW]: z.string().default(DEFAULTS.APPEARANCE.LANDING_VIEW),

    // Safety
    [SETTING_KEYS.SAFETY.BACKUP_ON_CLOSE]: z.enum(['true', 'false']).default(DEFAULTS.SAFETY.BACKUP_ON_CLOSE),
    [SETTING_KEYS.SAFETY.AUTO_BACKUP_ENABLED]: z.enum(['true', 'false']).default(DEFAULTS.SAFETY.AUTO_BACKUP),
    [SETTING_KEYS.SAFETY.AUTO_BACKUP_DIRECTORY]: z.string().optional().default(''),
    [SETTING_KEYS.SAFETY.LAST_BACKUP]: z.string().optional().default(''),

    // Remote
    [SETTING_KEYS.REMOTE.ENABLED]: z.enum(['true', 'false']).default('false'),
    [SETTING_KEYS.REMOTE.PORT]: z.string().regex(/^\d+$/).default('5174'),
    [SETTING_KEYS.REMOTE.KEY]: z.string().optional().default(''),
    [SETTING_KEYS.REMOTE.ORIGINS]: z.string().optional().default(''),
    [SETTING_KEYS.REMOTE.EXTERNAL]: z.enum(['true', 'false']).default('true'),

    // AI - Use centralized defaults
    [SETTING_KEYS.AI.ENABLED]: z.enum(['true', 'false']).default('false'),
    [SETTING_KEYS.AI.URL]: z.string().url().default(DEFAULT_AI_URL),
    [SETTING_KEYS.AI.MODEL]: z.string().default(DEFAULT_AI_MODEL),
    [SETTING_KEYS.AI.PROMPT_TX]: z.string().optional().default(''),
    [SETTING_KEYS.AI.PROMPT_INSIGHT]: z.string().optional().default(''),
    [SETTING_KEYS.AI.PROMPT_CHAT]: z.string().optional().default(''),
});

export type Settings = z.infer<typeof SettingsSchema>;

// Helper to validate a partial update
export const validateSetting = (key: string, value: unknown) => {
    const shape = SettingsSchema.shape;
    if (key in shape) {
        return shape[key as keyof typeof shape].parse(value);
    }
    return value;
};
