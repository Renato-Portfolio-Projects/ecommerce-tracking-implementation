import { currencyFromAnswer } from '../engine/money';
import type { CurrencyCode } from '../store/currencies';

/**
 * The starting currency for a visitor who has not chosen one: the currency the server works out from the country
 * Vercel says the connection comes from (`/api/currency`, src/server/currency.ts). This is the only code in the
 * browser that asks for it, and the only code that keeps it. The browser never receives the country, only the
 * currency, and the currency is kept in `sessionStorage` for the tab, so the server is asked once per tab and not
 * once per page. It is deliberately not kept as the visitor's choice (the saved choice, which currency-switcher.ts
 * writes only when they pick one from the selector), so a default that was wrong for them is never mistaken for
 * something they decided. If the browser will not keep it, it lasts for the page.
 */

export const DEFAULT_CURRENCY_KEY = 'second-impression:default-currency';

const ENDPOINT = '/api/currency';
const GIVE_UP_AFTER_MS = 3000;

/** The starting currency this page knows, either read from the tab's storage or just fetched. */
let known: CurrencyCode | undefined;

/** The starting currency already known for this tab, if any. It reads the tab's storage the first time only. */
export function knownDefault(): CurrencyCode | undefined {
  if (known === undefined) {
    try {
      known = currencyFromAnswer({ currency: sessionStorage.getItem(DEFAULT_CURRENCY_KEY) });
    } catch {
      // The browser will not say. Nothing is known, and the server is asked.
    }
  }
  return known;
}

/**
 * Asks the server for the starting currency and remembers the answer. It gives nothing, and remembers nothing, if
 * the server cannot be reached in three seconds, says anything but a success, or answers with something that is
 * not one of the store's currencies, so a failure leaves the store as it was and is tried again on the next page.
 */
export async function fetchDefault(): Promise<CurrencyCode | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GIVE_UP_AFTER_MS);
  try {
    const response = await fetch(ENDPOINT, { signal: controller.signal, credentials: 'omit', cache: 'no-store' });
    if (!response.ok) return undefined;
    const currency = currencyFromAnswer(await response.json());
    if (currency === undefined) return undefined;
    known = currency;
    try {
      sessionStorage.setItem(DEFAULT_CURRENCY_KEY, currency);
    } catch {
      // Nothing can be kept. It is remembered for this page, and asked for again on the next.
    }
    return currency;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
