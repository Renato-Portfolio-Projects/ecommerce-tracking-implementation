import { CURRENCIES, type CurrencyCode } from '../store/currencies';

/**
 * Money is stored as a whole number of cents, never as a decimal: a price of $38.00 is stored
 * as 3800. Computers cannot hold decimals like 0.1 exactly (0.1 + 0.2 comes out as
 * 0.30000000000000004), but adding and multiplying whole numbers is always exact, so a total
 * can never drift by a cent.
 *
 * Every price is stored in Canadian dollars (CAD). Every conversion starts from CAD, and the
 * store never converts between two other currencies.
 */

export function isCurrencyCode(value: string): value is CurrencyCode {
  return CURRENCIES.some((currency) => currency.code === value);
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

/**
 * Every offered currency's formatted price for one CAD amount, keyed by currency code. Calls the
 * two functions above once per currency and does no arithmetic of its own, for example:
 *
 *   pricesInAllCurrencies(3800) // { CAD: '$38.00', USD: 'US$27.74', EUR: '€25.08', GBP: '£21.28' }
 *
 * A page calls this once, when it is built, for every price it shows, and puts the whole result
 * in the page as data (see the `data-prices` attribute in src/components/Header.astro and the
 * pages that show a price). The currency selector's own script then never converts a price
 * itself: switching currency only ever picks which of these already-formatted strings to display.
 */
export function pricesInAllCurrencies(cents: number): Record<CurrencyCode, string> {
  return Object.fromEntries(
    CURRENCIES.map((currency) => [currency.code, formatMoney(convertFromCad(cents, currency.code), currency.code)]),
  ) as Record<CurrencyCode, string>;
}

/**
 * The currency a visitor has chosen, from whatever the browser handed back for what they last chose. `raw` is
 * untrusted: on a first visit it is `null`, and at any other visit it could in principle be missing, blank, or
 * left over from a version of the store that offered different currencies. This is the one place that decision
 * is made, so nothing downstream has to re-check it. `isCurrencyCode` (above) is what actually knows the four
 * codes the store offers; this function only adds the null/undefined check. It gives the code if the store offers
 * it, and nothing at all if not, with no fallback, because a visitor who has not chosen is different from one who
 * chose the store's own currency: the first is offered the starting currency for their country, and the second
 * keeps what they picked. For example:
 *
 *   chosenCurrency('USD') // 'USD', a currency the store offers
 *   chosenCurrency(null)  // undefined, nothing was saved yet
 *   chosenCurrency('JPY') // undefined, not one of the four the store offers
 *   chosenCurrency('usd') // undefined, codes are matched case-sensitively
 */
export function chosenCurrency(raw: string | null | undefined): CurrencyCode | undefined {
  return raw !== null && raw !== undefined && isCurrencyCode(raw) ? raw : undefined;
}

/**
 * The currency in an answer from /api/currency. The answer comes over the network, so it is untrusted: it must
 * be an object with a `currency` that is one of the four the store offers, and anything else gives nothing.
 */
export function currencyFromAnswer(data: unknown): CurrencyCode | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const { currency } = data as Record<string, unknown>;
  return typeof currency === 'string' ? chosenCurrency(currency) : undefined;
}
