import { askForStartingCurrency, currentCurrency } from '../components/currency-switcher.js';
import type { CurrencyCode } from '../store/currencies.js';
import { settledAfter } from './settled.js';

/**
 * The wait that an announcement with a price makes before it is recorded, shared by every page's tracking (page-tracking.ts
 * for the browsing pages, and the checkout's and thank-you page's own), so that none keeps a copy of it. It needs the page's
 * currency switcher, so it cannot be tested without a page and is checked in a real browser.
 */

/** How long an announcement with a price waits for a first-time visitor's starting currency to arrive. */
const SETTLE_LIMIT_MS = 1500;

/** The currency to record a price in: the one the visitor ends up seeing, once the starting currency has arrived. */
export function whenCurrencySettled(): Promise<CurrencyCode> {
  return settledAfter(askForStartingCurrency(), SETTLE_LIMIT_MS).then(() => currentCurrency());
}
