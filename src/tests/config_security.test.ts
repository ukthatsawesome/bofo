import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemoteConfigService } from '../main/config/RemoteConfig';
import { FinanceModel } from '../main/models/finance';
import { SETTING_KEYS } from '../shared/settings/keys';

// Mock Electron
vi.mock('electron', () => ({
    app: {
        isPackaged: false
    }
}));

// Mock Logger
vi.mock('../utils/logger', () => ({
    Logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
}));

// Mock FinanceModel
vi.mock('../main/models/finance', () => ({
    FinanceModel: {
        getAllSettings: vi.fn(),
        updateSetting: vi.fn(),
    }
}));

describe('RemoteConfigService Security', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should generate a new secure key if key is missing', async () => {
        // Mock empty settings
        (FinanceModel.getAllSettings as any).mockResolvedValue({});

        const config = await RemoteConfigService.getEffectiveConfig();

        // Verify key is generated
        expect(config.apiKey).toBeDefined();
        expect(config.apiKey.length).toBeGreaterThan(30); // UUID length
        expect(config.apiKey).not.toBe('bofo-default-key');

        // Verify key is saved
        expect(FinanceModel.updateSetting).toHaveBeenCalledWith(
            SETTING_KEYS.REMOTE.KEY,
            expect.any(String)
        );
    });

    it('should generate a new secure key if key is default insecure one', async () => {
        // Mock default settings
        (FinanceModel.getAllSettings as any).mockResolvedValue({
            [SETTING_KEYS.REMOTE.KEY]: 'bofo-default-key'
        });

        const config = await RemoteConfigService.getEffectiveConfig();

        // Verify new key is generated
        expect(config.apiKey).not.toBe('bofo-default-key');
        expect(FinanceModel.updateSetting).toHaveBeenCalled();
    });

    it('should use existing key if it is secure', async () => {
        const secureKey = 'some-secure-uuid-value';
        (FinanceModel.getAllSettings as any).mockResolvedValue({
            [SETTING_KEYS.REMOTE.KEY]: secureKey
        });

        const config = await RemoteConfigService.getEffectiveConfig();

        expect(config.apiKey).toBe(secureKey);
        expect(FinanceModel.updateSetting).not.toHaveBeenCalled();
    });

    it('should default to port 5174', async () => {
        (FinanceModel.getAllSettings as any).mockResolvedValue({});
        const config = await RemoteConfigService.getEffectiveConfig();
        expect(config.port).toBe(5174);
    });
});
