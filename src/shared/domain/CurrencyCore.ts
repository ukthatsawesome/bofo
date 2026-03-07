/**
 * CurrencyCore - The Single Source of Truth for Financial Math
 *
 * Ensures identical rounding, conversion, and formatting across
 * both the Main process (Database interactions) and Renderer (UI).
 *
 * Concepts:
 * - Amount: Integer value (e.g. cents) or Float?
 *   - Legacy codebase mixed them.
 *   - New Standard: We generally handle FLOATS in the UI for convenience,
 *     but can convert to INTs for storage if needed.
 *   - THIS CLASS normalizes the "Float Issue" by ensuring 2-decimal precision.
 */

export class CurrencyCore {
  /**
   * Normalize an amount to exactly 2 decimal places.
   * Handles floating point errors (e.g. 0.1 + 0.2 = 0.3000000004)
   */
  static normalize(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  /**
   * Convert currency using a known rate.
   * Returns 0 if rate is missing/invalid, or returns original if rate is 1.
   */
  static convert(amount: number, rate: number): number {
    if (!rate || isNaN(rate)) return amount;
    return this.normalize(amount * rate);
  }

  /**
   * Get a formatted string for display.
   * Supports various currency codes.
   */
  static format(amount: number, currencyCode: string = 'USD', locale: string = 'en-US'): string {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch (e) {
      return `${currencyCode} ${amount.toFixed(2)}`;
    }
  }

  /**
   * Parse a formatted currency string back to a number.
   * Removes symbols and commas.
   */
  static parse(input: string): number {
    if (!input) return 0;

    const clean = input.replace(/[^0-9.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : this.normalize(num);
  }

  /**
   * Get symbol for a currency code
   */
  static getSymbol(currencyCode: string = 'USD', locale: string = 'en-US'): string {
    try {
      const parts = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
      }).formatToParts(0);
      const symbolParams = parts.find((part) => part.type === 'currency');
      return symbolParams ? symbolParams.value : currencyCode;
    } catch {
      return '$';
    }
  }
}
