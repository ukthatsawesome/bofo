import { describe, it, expect } from 'vitest';
import { validateSafePath } from '../../main/utils/security';
import * as path from 'path';

describe('Security Utils - validateSafePath', () => {
  it('should return true for valid absolute paths', () => {
    const safePath =
      process.platform === 'win32' ? 'C:\\Users\\Guest\\Documents' : '/home/guest/docs';
    expect(validateSafePath(safePath, 'dir')).toBe(true);
  });

  it('should return false for relative paths', () => {
    expect(validateSafePath('./local/dir', 'dir')).toBe(false);
    expect(validateSafePath('simple_folder', 'dir')).toBe(false);
  });

  it('should return false for sensitive system paths', () => {
    if (process.platform === 'win32') {
      expect(validateSafePath('C:\\Windows\\System32', 'dir')).toBe(false);
      expect(validateSafePath('C:\\Program Files', 'dir')).toBe(false);
    } else {
      expect(validateSafePath('/etc/passwd', 'file')).toBe(false);
      expect(validateSafePath('/usr/bin', 'dir')).toBe(false);
    }
  });

  it('should handle traversal attempts in absolute paths', () => {
    if (process.platform === 'win32') {
      const sneaky = 'C:\\Users\\Guest\\..\\..\\Windows\\System32';
      expect(validateSafePath(sneaky, 'dir')).toBe(false);
    } else {
      const sneaky = '/home/user/../../etc/passwd';
      expect(validateSafePath(sneaky, 'file')).toBe(false);
    }
  });
});
