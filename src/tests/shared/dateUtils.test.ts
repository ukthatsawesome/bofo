import { describe, it, expect } from 'vitest';
import { DateUtils } from '../../shared/utils/dateUtils';

describe('DateUtils', () => {
    describe('toISODateString', () => {
        it('should convert date to YYYY-MM-DD string', () => {
            const date = new Date('2024-03-15T10:30:00Z');
            expect(DateUtils.toISODateString(date)).toBe('2024-03-15');
        });

        it('should handle dates at start of year', () => {
            const date = new Date('2024-01-01T00:00:00Z');
            expect(DateUtils.toISODateString(date)).toBe('2024-01-01');
        });

        it('should handle dates at end of year', () => {
            const date = new Date('2024-12-31T23:59:59Z');
            expect(DateUtils.toISODateString(date)).toBe('2024-12-31');
        });
    });

    describe('today', () => {
        it('should return today\'s date as YYYY-MM-DD', () => {
            const result = DateUtils.today();
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

            // Should match UTC date of now
            const now = new Date();
            const year = now.getUTCFullYear();
            const month = String(now.getUTCMonth() + 1).padStart(2, '0');
            const day = String(now.getUTCDate()).padStart(2, '0');
            expect(result).toBe(`${year}-${month}-${day}`);
        });
    });

    describe('getMonthStart', () => {
        it('should get first day of month', () => {
            // 2024-03-15
            const start = DateUtils.getMonthStart('2024-03-15');
            expect(start).toBe('2024-03-01');
        });
    });

    describe('getMonthEnd', () => {
        it('should get last day of month for 31-day month', () => {
            const end = DateUtils.getMonthEnd('2024-03-15');
            expect(end).toBe('2024-03-31');
        });

        it('should get last day of month for 30-day month', () => {
            const end = DateUtils.getMonthEnd('2024-04-15');
            expect(end).toBe('2024-04-30');
        });

        it('should handle February in leap year', () => {
            const end = DateUtils.getMonthEnd('2024-02-15');
            expect(end).toBe('2024-02-29');
        });
    });

    describe('getMonthBoundaries', () => {
        it('should get month boundaries as ISO strings', () => {
            const boundaries = DateUtils.getMonthBoundaries('2024-03-15');
            expect(boundaries.start).toBe('2024-03-01');
            expect(boundaries.end).toBe('2024-03-31');
        });
    });

    describe('fromComponents', () => {
        it('should construct date string from components', () => {
            expect(DateUtils.fromComponents(2024, 3, 5)).toBe('2024-03-05');
        });

        it('should pad single-digit months and days', () => {
            expect(DateUtils.fromComponents(2024, 1, 1)).toBe('2024-01-01');
        });
    });
});
