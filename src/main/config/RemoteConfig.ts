import { app } from 'electron';
import * as crypto from 'crypto';
import { FinanceModel } from '../models/finance';
import { SETTING_KEYS } from '../../shared/settings/keys';
import { Logger } from '../utils/logger';

export interface RemoteConfig {
    enabled: boolean;
    port: number;
    apiKey: string;
    allowedOrigins: Set<string>;
    external: boolean;
}

export class RemoteConfigService {
    private static DEFAULT_PORT = 5174;

    /**
     * Retrieves the effective remote configuration.
     * Generates and saves a secure API key if one is missing or is the legacy default.
     */
    static async getEffectiveConfig(): Promise<RemoteConfig> {
        const settings = await FinanceModel.getAllSettings();
        const isDev = !app.isPackaged;

        // 1. Enabled State
        // In dev, we might verify if we want to force enable or strictly follow settings
        const enabled = settings[SETTING_KEYS.REMOTE.ENABLED] === 'true';

        // 2. Port
        let port = parseInt(settings[SETTING_KEYS.REMOTE.PORT] as string);
        if (isNaN(port) || port <= 0) {
            port = this.DEFAULT_PORT;
        }

        // 3. API Key (Security Critical)
        let apiKey = settings[SETTING_KEYS.REMOTE.KEY] as string;

        // Check for missing or unstable/insecure legacy default
        if (!apiKey || apiKey === 'bofo-default-key') {
            Logger.info('[RemoteConfig] Detected missing or insecure API key. Generating new secure key...');
            apiKey = crypto.randomUUID(); // Generate secure UUID

            // Persist the new key so the user can see it in Settings
            try {
                await FinanceModel.updateSetting(SETTING_KEYS.REMOTE.KEY, apiKey);
                Logger.info('[RemoteConfig] New secure API key saved.');
            } catch (err) {
                Logger.error('[RemoteConfig] Failed to save new API key:', err);
                // We still use the generated key in memory for this session to be safe, 
                // even if saving failed (though user won't know it next time).
            }
        }

        // 4. Allowed Origins
        const originsStr = (settings[SETTING_KEYS.REMOTE.ORIGINS] as string) || '';
        const allowedOrigins = new Set(
            originsStr
                .split(',')
                .map((o) => o.trim())
                .filter(Boolean)
        );

        if (isDev) {
            allowedOrigins.add('http://localhost:5173');
            allowedOrigins.add('http://127.0.0.1:5173');
        }

        // 5. External Access
        const external = settings[SETTING_KEYS.REMOTE.EXTERNAL] === 'true';

        return {
            enabled,
            port,
            apiKey,
            allowedOrigins,
            external
        };
    }
}
