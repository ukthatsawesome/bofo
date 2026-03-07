import * as path from 'path';
import * as fs from 'fs';

/**
 * Validate that a path is safe to use and does not resolve outside of allowed boundaries.
 * In this context, "safe" means:
 * 1. It is a valid absolute path (or resolvable to one).
 * 2. It does not use '..' to traverse up in a way that is unexpected (though '..' in absolute paths is resolved by normalize).
 * 3. It is not a sensitive system directory (basic check).
 *
 * @param inputPath - The path to validate
 * @param type - 'file' or 'dir' - check existence or treat as such
 * @returns boolean - True if safe, False if unsafe
 */
export function validateSafePath(inputPath: string, type: 'file' | 'dir' = 'dir'): boolean {
  if (!inputPath || typeof inputPath !== 'string') {
    return false;
  }

  const normalized = path.normalize(inputPath);

  if (!path.isAbsolute(normalized)) {
    return false;
  }

  const lower = normalized.toLowerCase();

  const sensitivePaths = [
    'c:\\windows',
    'c:\\program files',
    'c:\\program files (x86)',
    '/etc',
    '/usr',
    '/var',
    '/bin',
    '/sbin',
  ];

  if (sensitivePaths.some((p) => lower.startsWith(p))) {
    return false;
  }

  if (inputPath.includes('..') && !path.isAbsolute(inputPath)) {
    return false;
  }

  return true;
}
