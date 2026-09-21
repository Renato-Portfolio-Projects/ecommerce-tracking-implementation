// The currencies Second Impression shows prices in, and which one a visitor starts in. This is the
// store's own data. The arithmetic that uses it is in src/engine/money.ts.
//
// Every price is stored in Canadian dollars (CAD). Every conversion starts from CAD, and the
// store never converts between two other currencies.

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
