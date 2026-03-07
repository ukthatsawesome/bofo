/**
 * Date Utilities for strictly UTC handling
 *
 * Financial applications require consistent dates regardless of the user's local timezone.
 * These utilities ensure that dates are always processed as UTC midnight.
 */

export function toISODateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseISODate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

export function getTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function isValidISODateString(dateString: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  const date = parseISODate(dateString);

  return toISODateString(date) === dateString;
}

export function addDaysUTC(date: Date, days: number): Date {
  const newDate = new Date(date);
  newDate.setUTCDate(newDate.getUTCDate() + days);
  return newDate;
}
