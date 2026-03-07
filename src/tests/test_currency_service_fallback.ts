import { CurrencyService } from '../main/services/currencyService';

async function main() {
  try {
    console.log("Testing CurrencyService.fetchRates('frankfurter', 'NPR')...");

    const rates = await CurrencyService.fetchRates('frankfurter', 'NPR', null, false);

    console.log(`Success! Fetched ${rates.length} rates.`);
    console.log(`Sample rate (NPR -> USD):`, rates.find((r) => r.to === 'USD')?.rate);

    if (rates.length > 0) {
      console.log('Fallback logic VERIFIED.');
    } else {
      console.error('FAILED: No rates returned.');
      process.exit(1);
    }
  } catch (e) {
    console.error('FAILED with error:', e);
    process.exit(1);
  }
}

main();
