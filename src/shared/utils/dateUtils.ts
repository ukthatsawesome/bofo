/**
 * Date Utilities
 *
 * Centralized date manipulation functions to ensure consistency
 * and prevent timezone-related bugs across the application.
 *
 * All functions handle dates in a UTC-safe manner and return
 * ISO 8601 formatted strings (YYYY-MM-DD) where applicable.
 */

export interface DateRange {
    start: string;
    end: string;
}

export class DateUtils {
    /**
     * Converts a Date object to a UTC-safe YYYY-MM-DD string.
     *
     * @param date - The date to convert.
     * @returns ISO date string in YYYY-MM-DD format.
     * 
     * @example
     * DateUtils.toDateString(new Date('2024-03-15T10:30:00Z'))
     * // Returns: '2024-03-15'
     */
    static toDateString(date: Date): string {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Gets today's date as a UTC-safe YYYY-MM-DD string.
     *
     * @returns Today's date in YYYY-MM-DD format.
     */
    static today(): string {
        return this.toDateString(new Date());
    }

    /**
     * Gets the first day of the month for a given date (UTC).
     *
     * @param date - Reference date. Defaults to current date.
     * @returns Date object set to the first day of the month at 00:00:00 UTC.
     */
    static getMonthStart(date: Date = new Date()): Date {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    }

    /**
     * Gets the last day of the month for a given date (UTC).
     *
     * @param date - Reference date. Defaults to current date.
     * @returns Date object set to the last day of the month at 00:00:00 UTC.
     */
    static getMonthEnd(date: Date = new Date()): Date {
        // Date.UTC(..., month + 1, 0) returns the last day of the target month
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
    }

    /**
     * Gets the start and end dates of a month as ISO strings.
     *
     * @param date - Reference date. Defaults to current date.
     * @returns Object containing 'start' and 'end' date strings.
     * 
     * @example
     * DateUtils.getMonthBoundaries(new Date('2024-02-15'))
     * // Returns: { start: '2024-02-01', end: '2024-02-29' }
     */
    static getMonthBoundaries(date: Date = new Date()): DateRange {
        return {
            start: this.toDateString(this.getMonthStart(date)),
            end: this.toDateString(this.getMonthEnd(date)),
        };
    }

    /**
     * Gets month boundaries for a specific year and month (1-12).
     *
     * @param year - Four-digit year.
     * @param month - Month number (1-12).
     * @returns Object containing 'start' and 'end' date strings.
     */
    static getMonthBoundariesForYearMonth(year: number, month: number): DateRange {
        const date = new Date(Date.UTC(year, month - 1, 1));
        return this.getMonthBoundaries(date);
    }

    /**
     * Pads a number with a leading zero if single digit.
     *
     * @param n - Number to pad.
     * @returns Two-digit string.
     * 
     * @example
     * DateUtils.pad(5)  // '05'
     * DateUtils.pad(12) // '12'
     */
    static pad(n: number): string {
        return n.toString().padStart(2, '0');
    }

    /**
     * Constructs a date string from year, month, and day components.
     *
     * @param year - Four-digit year.
     * @param month - Month number (1-12).
     * @param day - Day of month (1-31).
     * @returns ISO date string in YYYY-MM-DD format.
     * 
     * @example
     * DateUtils.fromComponents(2024, 3, 5) // '2024-03-05'
     */
    static fromComponents(year: number, month: number, day: number): string {
        return `${year}-${this.pad(month)}-${this.pad(day)}`;
    }
}