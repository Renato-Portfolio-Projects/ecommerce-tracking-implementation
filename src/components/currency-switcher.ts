import { CURRENCIES, type CurrencyCode } from '../store/currencies';
import { chosenCurrency } from '../engine/money';
import { fetchDefault, knownDefault } from './default-currency';

/**
 * The header's currency selector. A priced element on the page carries every currency's already
 * formatted string as `data-prices` JSON (from `pricesInAllCurrencies` in src/engine/money.ts), so
 * switching currency only ever swaps which string is shown, never does the conversion itself in
 * the browser. The string replaces the element's whole text, so it carries any words that go with the
 * price (a product page's earlier price is "was $42.00" in every currency). The one exception is the
 * cart: its lines exist only in the browser, from the saved cart, so cart-ui.ts works out their prices
 * itself (through `cartView`) in the currency given by `currentCurrency`, and redraws when this
 * selector announces `currency:changed`. The choice is saved in localStorage, not a cookie, and read
 * back on the next visit.
 *
 * Who decides which currency is shown, in this order: what the visitor chose (this visit, or saved from an
 * earlier one); else the starting currency for their country, which the server works out and
 * default-currency.ts fetches and remembers for the tab; else Canadian dollars, the store's own. The starting
 * currency is asked for only when nothing has been chosen, and it never overrides a choice, even one made while
 * the answer was on its way.
 *
 * A visitor with nothing chosen and nothing remembered sees the prices in Canadian dollars first, as the page is
 * built, and they change to their own currency when the answer arrives, which is a fraction of a second on a
 * working connection. A returning visitor who chose a currency other than CAD sees the same brief flash, since
 * the page is static and cannot know the choice until it runs. That trade-off is accepted for a demo store.
 */

const STORAGE_KEY = 'second-impression:currency';

/** The currency chosen on this page view, kept so a browser that will not save it still shows one currency everywhere. */
let chosenNow: CurrencyCode | undefined;

/** What the visitor chose, this visit or earlier, or nothing if they have not chosen one. */
function choice(): CurrencyCode | undefined {
  if (chosenNow) return chosenNow;
  try {
    return chosenCurrency(localStorage.getItem(STORAGE_KEY));
  } catch {
    return undefined;
  }
}

/** The currency to show now: the visitor's choice, else the starting currency for their country, else Canadian dollars. The cart reads it too. */
export function currentCurrency(): CurrencyCode {
  return choice() ?? knownDefault() ?? CURRENCIES[0].code;
}

function applyCurrency(currency: CurrencyCode): void {
  for (const element of document.querySelectorAll<HTMLElement>('[data-prices]')) {
    const prices = JSON.parse(element.dataset.prices!) as Record<CurrencyCode, string>;
    element.textContent = prices[currency];
  }
}

/** Shows a currency on the page: the selector, every price, and, by announcing it, the cart. */
function show(select: HTMLSelectElement, currency: CurrencyCode): void {
  select.value = currency;
  applyCurrency(currency);
  // Tells anything else that shows money, so far the cart, to redraw. It works in every browser: the
  // cart's prices are worked out in the browser, not swapped in from the page like the others.
  document.dispatchEvent(new CustomEvent('currency:changed'));
}

/** Wires the header's currency selector: starts it from what was chosen or is known, asks for the starting currency if it must, and saves and applies a change. */
export function initCurrencySwitcher(): void {
  const select = document.querySelector<HTMLSelectElement>('#currency-select');
  if (!select) return;

  const currency = currentCurrency();
  select.value = currency;
  applyCurrency(currency);

  // Nothing chosen and nothing known for this tab: ask the server once. If the visitor picks a currency while the
  // answer is on its way, or has one by the time it comes, the answer is dropped.
  if (choice() === undefined && knownDefault() === undefined) {
    void fetchDefault().then((starting) => {
      if (starting !== undefined && choice() === undefined && starting !== select.value) show(select, starting);
    });
  }

  select.addEventListener('change', () => {
    const chosen = select.value as CurrencyCode;
    chosenNow = chosen;
    try {
      localStorage.setItem(STORAGE_KEY, chosen);
    } catch {
      // A visitor blocking storage still gets to switch currency for this page view.
    }
    show(select, chosen);
  });
}
