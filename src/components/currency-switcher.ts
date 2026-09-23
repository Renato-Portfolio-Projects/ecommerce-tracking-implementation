import { CURRENCIES, type CurrencyCode } from '../store/currencies';
import { storedCurrencyOr } from '../engine/money';

/**
 * The header's currency selector. A priced element on the page carries every currency's already
 * formatted string as `data-prices` JSON (from `pricesInAllCurrencies` in src/engine/money.ts), so
 * switching currency only ever swaps which string is shown, never does the conversion itself in
 * the browser. The choice is saved in localStorage, not a cookie, and read back on the next visit.
 *
 * A returning visitor who chose a currency other than CAD sees a brief flash of CAD prices before
 * this script corrects them, since the page is static and cannot know the choice until it runs.
 * That trade-off is accepted for a demo store.
 */

const STORAGE_KEY = 'second-impression:currency';

function currentCurrency(): CurrencyCode {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    saved = null;
  }
  return storedCurrencyOr(saved, CURRENCIES[0].code);
}

function applyCurrency(currency: CurrencyCode): void {
  for (const element of document.querySelectorAll<HTMLElement>('[data-prices]')) {
    const prices = JSON.parse(element.dataset.prices!) as Record<CurrencyCode, string>;
    element.textContent = prices[currency];
  }
}

/** Wires the header's currency selector: starts it from what was saved, then saves and applies a change. */
export function initCurrencySwitcher(): void {
  const select = document.querySelector<HTMLSelectElement>('#currency-select');
  if (!select) return;

  const currency = currentCurrency();
  select.value = currency;
  applyCurrency(currency);

  select.addEventListener('change', () => {
    const chosen = select.value as CurrencyCode;
    try {
      localStorage.setItem(STORAGE_KEY, chosen);
    } catch {
      // A visitor blocking storage still gets to switch currency for this page view.
    }
    applyCurrency(chosen);
  });
}
