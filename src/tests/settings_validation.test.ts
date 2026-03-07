import { describe, it, expect } from 'vitest';
import { SettingsSchema, validateSetting } from '../shared/settings/schema';
import { DEFAULT_SETTINGS } from '../shared/settings/defaults';
import { SETTING_KEYS } from '../shared/settings/keys';

describe('Settings Architecture Phase 1', () => {
  it('should have a valid schema for all default settings', () => {
    for (const setting of DEFAULT_SETTINGS) {
      const shape = SettingsSchema.shape;
      const key = setting.key as keyof typeof shape;

      if (!(key in shape)) {
        continue;
      }

      const result = convertAndValidate(key, setting.value);
      expect(result.success, `Default value for ${key} ('${setting.value}') is invalid`).toBe(true);
    }
  });

  it('should validate canonical keys correctly', () => {
    expect(validateSetting(SETTING_KEYS.CURRENCY.BASE, 'USD')).toBe('USD');
    expect(() => validateSetting(SETTING_KEYS.CURRENCY.BASE, 123)).toThrow();

    expect(validateSetting(SETTING_KEYS.REMOTE.PORT, '5174')).toBe('5174');
    expect(() => validateSetting(SETTING_KEYS.REMOTE.PORT, 'abc')).toThrow();

    expect(validateSetting(SETTING_KEYS.REMOTE.EXTERNAL, 'true')).toBe('true');
    expect(validateSetting(SETTING_KEYS.REMOTE.EXTERNAL, 'false')).toBe('false');
    expect(() => validateSetting(SETTING_KEYS.REMOTE.EXTERNAL, 'maybe')).toThrow();
  });
});

function convertAndValidate(key: string, value: string) {
  try {
    validateSetting(key, value);
    return { success: true };
  } catch (e) {
    return { success: false, error: e };
  }
}
