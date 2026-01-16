export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export interface CurrencyApiProvider {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  ratesEndpoint: string;
  license: string;
  requiresKey: boolean;
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'dh' },
  { code: 'ILS', name: 'Israeli Shekel', symbol: '₪' },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'रू' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs' },
];

// Predefined open-source currency API providers
export const CURRENCY_API_PROVIDERS: CurrencyApiProvider[] = [
  {
    id: 'frankfurter',
    name: 'Frankfurter (ECB)',
    description: 'European Central Bank rates, updated daily',
    baseUrl: 'https://api.frankfurter.app',
    ratesEndpoint: '/latest?from={base}',
    license: 'Open Source (MIT)',
    requiresKey: false,
  },
  {
    id: 'exchangerate-api',
    name: 'ExchangeRate-API (Free)',
    description: 'Free tier with daily updates',
    baseUrl: 'https://open.er-api.com/v6',
    ratesEndpoint: '/latest/{base}',
    license: 'Free for personal use',
    requiresKey: false,
  },
  {
    id: 'custom',
    name: 'Custom API',
    description: 'Provide your own API endpoint',
    baseUrl: '',
    ratesEndpoint: '',
    license: 'User-defined',
    requiresKey: false,
  },
];

// Helper functions
export function getCurrencyByCode(code: string): Currency | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

export function getCurrencySymbol(code: string): string {
  const currency = getCurrencyByCode(code);
  return currency ? currency.symbol : code;
}

export function isSupportedCurrency(code: string): boolean {
  return CURRENCIES.some((c) => c.code === code);
}
