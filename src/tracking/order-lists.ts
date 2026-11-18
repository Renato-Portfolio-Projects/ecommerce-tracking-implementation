import { cartLineKey, isValidListContext, type CartLine } from '../engine/cart.js';
import type { ListContext } from '../engine/catalog.js';
import type { ListsByVariant } from './items.js';

/**
 * The note that carries the list each cart line was picked from, from the checkout to the thank-you page. An order sent
 * to the server carries only each line's SKU, colour, size and quantity, so the server cannot say which list a purchase's
 * items came from, which the tracking plan says they carry through to `purchase`. The checkout writes the note when the
 * server confirms the order, just before the cart is emptied, and the thank-you page reads it once, when it announces the
 * purchase, and removes it. It lives in sessionStorage, which is this tab's own, so it goes when the tab is closed, and a
 * thank-you page opened in another tab or on another device has no note, and its purchase has no list fields. Each entry
 * is found by the line's variant SKU, so two orders in two tabs never mix up their lists.
 *
 * Tracking must never break shopping, so every way the browser can refuse storage (a call that throws, or merely
 * reaching for it) is caught here, and what is lost is only the list fields.
 */

/** Where the note is kept. See docs/browser-storage.md. */
export const ORDER_LISTS_KEY = 'second-impression:order-lists';

/** Only the three list fields are kept, so nothing else that a line carries ends up in the note. */
function cleanList(list: ListContext): ListContext {
  return { listId: list.listId, listName: list.listName, index: list.index };
}

/** Writes the note for the lines of an order: each line's list under its variant SKU. Lines with no list are left out, and no list at all clears an older note. */
export function rememberOrderLists(lines: CartLine[]): void {
  const lists: ListsByVariant = {};
  for (const line of lines) {
    if (line.list !== undefined && isValidListContext(line.list)) lists[cartLineKey(line)] = cleanList(line.list);
  }
  try {
    if (Object.keys(lists).length === 0) sessionStorage.removeItem(ORDER_LISTS_KEY);
    else sessionStorage.setItem(ORDER_LISTS_KEY, JSON.stringify(lists));
  } catch {
    // The tab will not keep it. The purchase is announced without the lists, which is all that is lost.
  }
}

/** Reads what is written in a note. Anything missing, damaged or not a real list gives nothing for that entry instead of throwing. */
function parseLists(raw: string | null): ListsByVariant {
  if (raw === null || raw === '') return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return {};
  const lists: ListsByVariant = {};
  for (const [variant, list] of Object.entries(data)) {
    // JSON.parse makes "__proto__" an ordinary key, and assigning it would change the object's prototype instead.
    if (variant === '__proto__') continue;
    if (isValidListContext(list)) lists[variant] = cleanList(list);
  }
  return lists;
}

/** Reads the note and removes it, so that a purchase uses it once. Nothing readable gives an empty note. */
export function takeOrderLists(): ListsByVariant {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(ORDER_LISTS_KEY);
  } catch {
    return {};
  }
  try {
    sessionStorage.removeItem(ORDER_LISTS_KEY);
  } catch {
    // It stays until the tab is closed. The next order writes over it.
  }
  return parseLists(raw);
}
