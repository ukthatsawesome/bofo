import { describe, it, expect } from 'vitest';
import { toISODateString, parseISODate, isValidISODateString, getTodayUTC, addDaysUTC } from '../renderer/lib/dateUtils';

describe('dateUtils', () => {
    it('toISODateString formats dates correctly in UTC', () => {
        // Create a date that is definitely different in UTC vs some local timezones
        // e.g., 2023-01-01T23:00:00 UTC is still 2023-01-01
        const d = new Date('2023-01-01T23:59:59Z');
        expect(toISODateString(d)).toBe('2023-01-01');

        const d2 = new Date('2023-01-02T00:00:00Z');
        expect(toISODateString(d2)).toBe('2023-01-02');
    });

    it('parseISODate creates UTC dates at midnight', () => {
        const d = parseISODate('2023-05-15');
        expect(d.toISOString()).toBe('2023-05-15T00:00:00.000Z');
        expect(d.getUTCFullYear()).toBe(2023);
        expect(d.getUTCMonth()).toBe(4); // 0-indexed
        expect(d.getUTCDate()).toBe(15);
    });

    it('isValidISODateString validates correctly', () => {
        expect(isValidISODateString('2023-01-01')).toBe(true);
        expect(isValidISODateString('2023-12-31')).toBe(true);
        expect(isValidISODateString('2023-02-28')).toBe(true);
        expect(isValidISODateString('2023-02-30')).toBe(false); // Invalid date
        expect(isValidISODateString('invalid')).toBe(false);
        expect(isValidISODateString('2023/01/01')).toBe(false);
    });

    it('addDaysUTC adds days correctly', () => {
        const start = parseISODate('2023-01-31');
        const end = addDaysUTC(start, 1);
        expect(toISODateString(end)).toBe('2023-02-01');
    });

    it('getTodayUTC returns a date at midnight UTC', () => {
        const today = getTodayUTC();
        expect(today.getUTCHours()).toBe(0);
        expect(today.getUTCMinutes()).toBe(0);
        expect(today.getUTCSeconds()).toBe(0);
        expect(today.getUTCMilliseconds()).toBe(0);
    });
});
