export interface DefaultSetting {
    key: string;
    value: string;
    category: string;
}

export const DEFAULT_SETTINGS: DefaultSetting[] = [
    { key: 'budget_period', value: 'monthly', category: 'budget' },
    { key: 'budget_rollover', value: 'false', category: 'budget' },
    { key: 'forecast_horizon', value: '6', category: 'forecast' },
    { key: 'forecast_uncertain_income', value: 'ask', category: 'forecast' },
    { key: 'forecast_inflation_enabled', value: 'false', category: 'forecast' },
    { key: 'forecast_inflation_rate', value: '2.5', category: 'forecast' },
    { key: 'currency_base', value: 'USD', category: 'currency' },
    { key: 'currency_precision', value: '2', category: 'currency' },
    { key: 'currency_symbol_placement', value: 'before', category: 'currency' },
    { key: 'currency_api_provider', value: 'frankfurter', category: 'currency' },
    { key: 'currency_api_url', value: '', category: 'currency' },
    { key: 'currency_auto_sync', value: 'false', category: 'currency' },
    { key: 'currency_last_sync', value: '', category: 'currency' },
    { key: 'theme', value: 'dark', category: 'appearance' },
    { key: 'landing_view', value: 'dashboard', category: 'appearance' },
    { key: 'backup_on_close', value: 'true', category: 'safety' },
    { key: 'remote_access_enabled', value: 'false', category: 'remote' },
    { key: 'remote_access_port', value: '5174', category: 'remote' },
    { key: 'remote_access_key', value: '', category: 'remote' },
];
