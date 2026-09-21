/**
 * Money is stored as a whole number of cents, never as a decimal: a price of $38.00 is stored
 * as 3800. Computers cannot hold decimals like 0.1 exactly (0.1 + 0.2 comes out as
 * 0.30000000000000004), but adding and multiplying whole numbers is always exact, so a total
 * can never drift by a cent.
 *
 * Every price is stored in Canadian dollars (CAD). Every conversion starts from CAD, and the
 * store never converts between two other currencies.
 */

export type CurrencyCode = 'CAD' | 'USD' | 'EUR' | 'GBP';

export interface Currency {
  code: CurrencyCode;
  name: string;
  /** Demo rate: how many of this currency 1 CAD is worth. Fixed, not live. */
  rate: number;
}

export const BASE_CURRENCY: CurrencyCode = 'CAD';

export const CURRENCIES: Currency[] = [
  { code: 'CAD', name: 'Canadian dollar', rate: 1 },
  { code: 'USD', name: 'US dollar', rate: 0.73 },
  { code: 'EUR', name: 'Euro', rate: 0.66 },
  { code: 'GBP', name: 'British pound', rate: 0.56 },
];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return CURRENCIES.some((currency) => currency.code === value);
}

/** The countries that use the euro: the euro area, 21 countries since Bulgaria joined on 1 January 2026. */
export const EURO_AREA_COUNTRIES: { code: string; name: string }[] = [
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'EE', name: 'Estonia' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MT', name: 'Malta' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'PT', name: 'Portugal' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'ES', name: 'Spain' },
];

/**
 * The currency to show a visitor first, from the country code Vercel gives for their connection:
 * Canada CAD, the United Kingdom GBP, the euro-area countries EUR, and everyone else, the United
 * States included, USD. USD is the fallback because it is the most widely understood foreign
 * currency. It is only a starting point: the visitor can switch until checkout starts. The code
 * is country-level only and is never stored. A missing or unrecognisable value gives USD.
 */
export function defaultCurrencyFor(visitorCountry: string | null | undefined): CurrencyCode {
  const country = (visitorCountry ?? '').trim().toUpperCase();
  if (country === 'CA') return 'CAD';
  if (country === 'GB') return 'GBP';
  if (EURO_AREA_COUNTRIES.some((candidate) => candidate.code === country)) return 'EUR';
  return 'USD';
}

/**
 * Turns a short decimal such as 0.73 or 14.975 into a whole number (7300 or 14975).
 * Throws if the value has more decimal places than allowed, so nothing is silently lost.
 */
export function scaleToInteger(value: number, decimals: number): number {
  const scaled = Math.round(value * 10 ** decimals);
  if (Math.abs(value * 10 ** decimals - scaled) > 1e-6) {
    throw new Error(`${value} has more than ${decimals} decimal places`);
  }
  return scaled;
}

/** Divides two whole numbers and rounds to the nearest whole number, with halves rounding up. */
export function divideRounded(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || numerator < 0) {
    throw new Error(`${numerator} is not a non-negative whole number`);
  }
  if (!Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new Error(`${denominator} is not a positive whole number`);
  }
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

/** Converts CAD cents into another currency's cents, rounded to the nearest cent. */
export function convertFromCad(cents: number, currency: CurrencyCode): number {
  if (!Number.isSafeInteger(cents)) throw new Error(`${cents} is not a whole number of cents`);
  const { rate } = CURRENCIES.find((candidate) => candidate.code === currency)!;
  return divideRounded(cents * scaleToInteger(rate, 4), 10_000);
}

export function formatMoney(cents: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(cents / 100);
}
