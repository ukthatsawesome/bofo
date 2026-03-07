/**
 * Date Utilities - The Single Source of Truth for Time
 *
 * All dates in Bofo are stored as YYYY-MM-DD strings in the database.
 * This utility ensures that:
 * 1. All conversions happen in UTC (preventing timezone off-by-one errors)
 * 2. Format is strictly consistent
 * 3. Math (addDays, diff) is consistent
 */

export interface DateRange {
  start: string;
  end: string;
}

export class DateUtils {
  /**
   * Get today's date string (YYYY-MM-DD) relative to UTC
   */
  static today(): string {
    return this.toISODateString(new Date());
  }

  /**
   * Convert a Date object to YYYY-MM-DD string using strictly UTC methods
   */
  static toISODateString(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Parse a YYYY-MM-DD string into a Date object at 00:00:00 UTC
   */
  static parseISODate(dateString: string): Date {
    if (!this.isValidDateString(dateString)) {
      throw new Error(`Invalid date string: ${dateString}`);
    }
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  /**
   * Check if a string is a valid YYYY-MM-DD date
   */
  static isValidDateString(dateString: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;

    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  /**
   * Add N days to a date string
   */
  static addDays(dateString: string, days: number): string {
    const date = this.parseISODate(dateString);
    date.setUTCDate(date.getUTCDate() + days);
    return this.toISODateString(date);
  }

  /**
   * Add N months to a date string (handling end-of-month overflow)
   */
  static addMonths(dateString: string, months: number): string {
    const date = this.parseISODate(dateString);
    const originalDay = date.getUTCDate();

    date.setUTCMonth(date.getUTCMonth() + months);

    if (date.getUTCDate() !== originalDay) {
      date.setUTCDate(0);
    }

    return this.toISODateString(date);
  }

  /**
   * Get the first day of the month for a given date
   */
  static getMonthStart(dateString: string = this.today()): string {
    const date = this.parseISODate(dateString);
    date.setUTCDate(1);
    return this.toISODateString(date);
  }

  /**
   * Get the last day of the month for a given date
   */
  static getMonthEnd(dateString: string = this.today()): string {
    const date = this.parseISODate(dateString);
    return this.toISODateString(
      new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    );
  }

  /**
   * Get start and end dates for a month
   */
  static getMonthBoundaries(dateString: string = this.today()): DateRange {
    return {
      start: this.getMonthStart(dateString),
      end: this.getMonthEnd(dateString),
    };
  }

  /**
   * Format for display (e.g. "Jan 01, 2024")
   * Uses browser locale but forces UTC values
   */
  static formatForDisplay(dateString: string, locale: string = 'en-US'): string {
    if (!dateString) return '-';
    try {
      const date = this.parseISODate(dateString);
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        timeZone: 'UTC',
      }).format(date);
    } catch (e) {
      return dateString;
    }
  }

  /**
   * Create string from components
   */
  static fromComponents(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
}
