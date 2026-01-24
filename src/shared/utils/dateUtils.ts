/**
 * Date Utilities
 * 
 * Centralized date manipulation functions to ensure consistency
 * and prevent timezone-related bugs across the application.
 * 
 * All functions handle dates in a UTC-safe manner and return
 * ISO 8601 formatted strings (YYYY-MM-DD) where applicable.
 */

export class DateUtils {
    /**
     * Converts Date to YYYY-MM-DD string (UTC-safe)
     * 
     * Replaces the common pattern: date.toISOString().split('T')[0]
     * 
     * @param date - The date to convert
     * @returns ISO date string in YYYY-MM-DD format
     * 
     * @example
     * DateUtils.toDateString(new Date('2024-03-15T10:30:00Z'))
     * // Returns: '2024-03-15'
     */
    static toDateString(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    /**
     * Gets today's date as YYYY-MM-DD
     * 
     * @returns Today's date in YYYY-MM-DD format
     * 
     * @example
     * DateUtils.today()
     * // Returns: '2024-03-15' (current date)
     */
    static today(): string {
        return this.toDateString(new Date());
    }

    /**
     * Gets the first day of the month for a given date
     * 
     * @param date - Reference date (defaults to current date)
     * @returns Date object set to the first day of the month at midnight
     * 
     * @example
     * DateUtils.getMonthStart(new Date('2024-03-15'))
     * // Returns: Date object for '2024-03-01T00:00:00'
     */
    static getMonthStart(date: Date = new Date()): Date {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    /**
     * Gets the last day of the month for a given date
     * 
     * @param date - Reference date (defaults to current date)
     * @returns Date object set to the last day of the month at midnight
     * 
     * @example
     * DateUtils.getMonthEnd(new Date('2024-02-15'))
     * // Returns: Date object for '2024-02-29T00:00:00' (leap year)
     */
    static getMonthEnd(date: Date = new Date()): Date {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0);
    }

    /**
     * Gets month boundaries as ISO date strings
     * 
     * Replaces multiple instances of manual month start/end calculations
     * 
     * @param date - Reference date (defaults to current date)
     * @returns Object with start and end dates in YYYY-MM-DD format
     * 
     * @example
     * DateUtils.getMonthBoundaries(new Date('2024-02-15'))
     * // Returns: { start: '2024-02-01', end: '2024-02-29' }
     */
    static getMonthBoundaries(date: Date = new Date()): { start: string; end: string } {
        return {
            start: this.toDateString(this.getMonthStart(date)),
            end: this.toDateString(this.getMonthEnd(date))
        };
    }

    /**
     * Gets month boundaries for a specific year and month
     * 
     * @param year - Four-digit year
     * @param month - Month number (1-12, not 0-11)
     * @returns Object with start and end dates in YYYY-MM-DD format
     * 
     * @example
     * DateUtils.getMonthBoundariesForYearMonth(2024, 2)
     * // Returns: { start: '2024-02-01', end: '2024-02-29' }
     */
    static getMonthBoundariesForYearMonth(year: number, month: number): { start: string; end: string } {
        const date = new Date(year, month - 1, 1);
        return this.getMonthBoundaries(date);
    }

    /**
     * Pads a number with leading zero if single digit
     * 
     * Helper for manual date string construction
     * 
     * @param n - Number to pad
     * @returns String with leading zero if needed
     * 
     * @example
     * DateUtils.pad(5)  // Returns: '05'
     * DateUtils.pad(12) // Returns: '12'
     */
    static pad(n: number): string {
        return n.toString().padStart(2, '0');
    }

    /**
     * Constructs a date string from year, month, and day components
     * 
     * @param year - Four-digit year
     * @param month - Month number (1-12)
     * @param day - Day of month (1-31)
     * @returns ISO date string in YYYY-MM-DD format
     * 
     * @example
     * DateUtils.fromComponents(2024, 3, 5)
     * // Returns: '2024-03-05'
     */
    static fromComponents(year: number, month: number, day: number): string {
        return `${year}-${this.pad(month)}-${this.pad(day)}`;
    }
}
