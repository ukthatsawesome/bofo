import { CurrencyCore } from '../../../shared/domain/CurrencyCore';
import { DateUtils } from '../../../shared/utils/dateUtils';

export class Formatter {
  /**
   * Format currency
   */
  static currency(amount: number, currencyCode: string = 'USD'): string {
    return CurrencyCore.format(amount, currencyCode);
  }

  /**
   * Format date
   */
  static date(dateString: string | Date | null): string {
    if (!dateString) return '-';
    if (typeof dateString === 'string') {
      return DateUtils.formatForDisplay(dateString);
    }
    return DateUtils.formatForDisplay(DateUtils.toISODateString(dateString));
  }

  /**
   * Format percentage
   */
  static percent(value: number, decimals: number = 1): string {
    return `${value.toFixed(decimals)}%`;
  }
}
