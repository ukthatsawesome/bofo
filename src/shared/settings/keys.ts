export const SETTING_KEYS = {
    BUDGET: {
        PERIOD: 'budget.period',
        ROLLOVER: 'budget.rollover',
    },
    FORECAST: {
        HORIZON: 'forecast.horizon',
        UNCERTAIN_INCOME: 'forecast.uncertain_income',
        INFLATION_ENABLED: 'forecast.inflation_enabled',
        INFLATION_RATE: 'forecast.inflation_rate',
        INCLUDE_RECURRING: 'forecast.include_recurring',
    },
    CURRENCY: {
        BASE: 'currency.base',
        PRECISION: 'currency.precision',
        SYMBOL_PLACEMENT: 'currency.symbol_placement',
        API_PROVIDER: 'currency.api_provider',
        CUSTOM_URL: 'currency.custom_url',
        AUTO_SYNC: 'currency.auto_sync_on_startup',
        LAST_SYNC: 'currency.last_sync',
    },
    APPEARANCE: {
        THEME: 'appearance.theme',
        LANDING_VIEW: 'appearance.landing_view',
    },
    SAFETY: {
        BACKUP_ON_CLOSE: 'safety.backup_on_close',
        LAST_BACKUP: 'safety.last_backup_run',
        AUTO_BACKUP_ENABLED: 'safety.auto_backup_enabled',
        AUTO_BACKUP_DIRECTORY: 'safety.auto_backup_directory',
    },
    REMOTE: {
        ENABLED: 'remote.enabled',
        PORT: 'remote.port',
        KEY: 'remote.key',
        ORIGINS: 'remote.origins',
        EXTERNAL: 'remote.external',
    },
    AI: {
        ENABLED: 'ai.enabled',
        URL: 'ai.url',
        MODEL: 'ai.model',
        PROMPT_TX: 'ai.prompt.tx',
        PROMPT_INSIGHT: 'ai.prompt.insight',
        PROMPT_CHAT: 'ai.prompt.chat',
    }
} as const;

export const SETTING_CATEGORIES = {
    BUDGET: 'budget',
    FORECAST: 'forecast',
    CURRENCY: 'currency',
    APPEARANCE: 'appearance',
    SAFETY: 'safety',
    REMOTE: 'remote',
    AI: 'ai',
} as const;
