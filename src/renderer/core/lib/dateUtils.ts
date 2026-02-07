/**
 * Date Utilities for strictly UTC handling
 * 
 * Financial applications require consistent dates regardless of the user's local timezone.
 * These utilities ensure that dates are always processed as UTC midnight.
 */

// Format a date object to "YYYY-MM-DD" string using UTC coordinates
export function toISODateString(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Parse "YYYY-MM-DD" string into a Date object at 00:00:00 UTC
export function parseISODate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    // Create date using UTC arguments (month is 0-indexed)
    return new Date(Date.UTC(year, month - 1, day));
}

// Get today's date at 00:00:00 UTC
export function getTodayUTC(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

// Check if a date string is valid "YYYY-MM-DD"
export function isValidISODateString(dateString: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
    const date = parseISODate(dateString);
    // Check if it parses back to the same string (handles invalid days like Feb 30)
    return toISODateString(date) === dateString;
}

// Add days to a UTC date
export function addDaysUTC(date: Date, days: number): Date {
    const newDate = new Date(date);
    newDate.setUTCDate(newDate.getUTCDate() + days);
    return newDate;
}
