import { describe, it, expect } from 'vitest';
import { DateUtils } from './dateUtils';

describe('DateUtils', () => {
    describe('toDateString', () => {
        it('should convert date to YYYY-MM-DD string', () => {
            const date = new Date('2024-03-15T10:30:00Z');
            expect(DateUtils.toDateString(date)).toBe('2024-03-15');
        });

        it('should handle dates at start of year', () => {
            const date = new Date('2024-01-01T00:00:00Z');
            expect(DateUtils.toDateString(date)).toBe('2024-01-01');
        });

        it('should handle dates at end of year', () => {
            const date = new Date('2024-12-31T23:59:59Z');
            expect(DateUtils.toDateString(date)).toBe('2024-12-31');
        });
    });

    describe('today', () => {
        it('should return today\'s date as YYYY-MM-DD', () => {
            const result = DateUtils.today();
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

            // Verify it matches current date
            const now = new Date();
            expect(result).toBe(DateUtils.toDateString(now));
        });
    });

    describe('getMonthStart', () => {
        it('should get first day of month', () => {
            const date = new Date('2024-03-15');
            const start = DateUtils.getMonthStart(date);
            expect(start.getDate()).toBe(1);
            expect(start.getMonth()).toBe(2); // March (0-indexed)
            expect(start.getFullYear()).toBe(2024);
        });

        it('should default to current month if no date provided', () => {
            const start = DateUtils.getMonthStart();
            expect(start.getDate()).toBe(1);
        });
    });

    describe('getMonthEnd', () => {
        it('should get last day of month for 31-day month', () => {
            const date = new Date('2024-03-15');
            const end = DateUtils.getMonthEnd(date);
            expect(end.getDate()).toBe(31);
            expect(end.getMonth()).toBe(2); // March
        });

        it('should get last day of month for 30-day month', () => {
            const date = new Date('2024-04-15');
            const end = DateUtils.getMonthEnd(date);
            expect(end.getDate()).toBe(30);
            expect(end.getMonth()).toBe(3); // April
        });

        it('should handle February in leap year', () => {
            const date = new Date('2024-02-15');
            const end = DateUtils.getMonthEnd(date);
            expect(end.getDate()).toBe(29);
            expect(end.getMonth()).toBe(1); // February
        });

        it('should handle February in non-leap year', () => {
            const date = new Date('2023-02-15');
            const end = DateUtils.getMonthEnd(date);
            expect(end.getDate()).toBe(28);
            expect(end.getMonth()).toBe(1); // February
        });
    });

    describe('getMonthBoundaries', () => {
        it('should get month boundaries as ISO strings', () => {
            const date = new Date('2024-03-15');
            const boundaries = DateUtils.getMonthBoundaries(date);
            expect(boundaries.start).toBe('2024-03-01');
            expect(boundaries.end).toBe('2024-03-31');
        });

        it('should handle February leap year correctly', () => {
            const date = new Date('2024-02-15');
            const boundaries = DateUtils.getMonthBoundaries(date);
            expect(boundaries.start).toBe('2024-02-01');
            expect(boundaries.end).toBe('2024-02-29');
        });

        it('should handle February non-leap year correctly', () => {
            const date = new Date('2023-02-15');
            const boundaries = DateUtils.getMonthBoundaries(date);
            expect(boundaries.start).toBe('2023-02-01');
            expect(boundaries.end).toBe('2023-02-28');
        });

        it('should default to current month if no date provided', () => {
            const boundaries = DateUtils.getMonthBoundaries();
            expect(boundaries.start).toMatch(/^\d{4}-\d{2}-01$/);
            expect(boundaries.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });

    describe('getMonthBoundariesForYearMonth', () => {
        it('should get boundaries for specific year and month', () => {
            const boundaries = DateUtils.getMonthBoundariesForYearMonth(2024, 2);
            expect(boundaries.start).toBe('2024-02-01');
            expect(boundaries.end).toBe('2024-02-29');
        });

        it('should handle single-digit months correctly', () => {
            const boundaries = DateUtils.getMonthBoundariesForYearMonth(2024, 1);
            expect(boundaries.start).toBe('2024-01-01');
            expect(boundaries.end).toBe('2024-01-31');
        });

        it('should handle December correctly', () => {
            const boundaries = DateUtils.getMonthBoundariesForYearMonth(2024, 12);
            expect(boundaries.start).toBe('2024-12-01');
            expect(boundaries.end).toBe('2024-12-31');
        });
    });

    describe('pad', () => {
        it('should pad single digits with leading zero', () => {
            expect(DateUtils.pad(5)).toBe('05');
            expect(DateUtils.pad(1)).toBe('01');
            expect(DateUtils.pad(9)).toBe('09');
        });

        it('should not pad double digits', () => {
            expect(DateUtils.pad(12)).toBe('12');
            expect(DateUtils.pad(25)).toBe('25');
            expect(DateUtils.pad(99)).toBe('99');
        });

        it('should handle zero', () => {
            expect(DateUtils.pad(0)).toBe('00');
        });
    });

    describe('fromComponents', () => {
        it('should construct date string from components', () => {
            expect(DateUtils.fromComponents(2024, 3, 5)).toBe('2024-03-05');
        });

        it('should pad single-digit months and days', () => {
            expect(DateUtils.fromComponents(2024, 1, 1)).toBe('2024-01-01');
        });

        it('should handle double-digit months and days', () => {
            expect(DateUtils.fromComponents(2024, 12, 31)).toBe('2024-12-31');
        });
    });
});
