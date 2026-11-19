/**
 * The marker that says which orders this browser has already announced as a purchase. The thank-you page can be reloaded,
 * and its link works for 7 days, so without it each load would announce the same purchase again. It is one of three
 * layers against a repeat: the transaction ID (Google Analytics counts a purchase with the same one once), the event_id
 * (`purchase_` and the order number, which Meta pairs a browser event and a server event by), and this, which stops the
 * browser sending a second one at all. It lives in localStorage, so a second tab and a later visit see it, and it holds
 * only order numbers, which are random and name no one, and the time each was announced.
 *
 * A real purchase must never be lost to a storage setting, so when the browser will not say, the answer is that it has
 * not been announced, and when it will not keep the answer, nothing is kept: the layers downstream catch a repeat.
 */

/** Where the marker is kept. See docs/browser-storage.md. */
export const PURCHASES_ANNOUNCED_KEY = 'second-impression:purchases-announced';

/** An order link works for 7 days, so an order is remembered for as long. */
export const REMEMBERED_FOR_MS = 7 * 24 * 60 * 60 * 1000;

/** The most orders kept, the newest. A browser that places more than this in 7 days is not a shopper. */
export const REMEMBERED_AT_MOST = 50;

interface Announced {
  order: string;
  at: number;
}

/** The orders written in the marker that are still remembered. Anything damaged, or forgotten by now, is left out instead of throwing. */
function parseAnnounced(raw: string | null, now: number): Announced[] {
  if (raw === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const kept: Announced[] = [];
  for (const entry of data) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { order, at } = entry as Record<string, unknown>;
    if (typeof order !== 'string' || order.trim() === '') continue;
    if (typeof at !== 'number' || !Number.isFinite(at)) continue;
    if (now - at >= REMEMBERED_FOR_MS) continue;
    kept.push({ order, at });
  }
  return kept;
}

function remembered(now: number): Announced[] {
  try {
    return parseAnnounced(localStorage.getItem(PURCHASES_ANNOUNCED_KEY), now);
  } catch {
    return [];
  }
}

/** True when this browser has announced this order within the last 7 days. False when it has not, and when it cannot tell. */
export function wasAnnounced(orderNumber: string, now: number = Date.now()): boolean {
  if (orderNumber.trim() === '') return false;
  return remembered(now).some((entry) => entry.order === orderNumber);
}

/** Remembers that this order was announced. Forgotten orders are dropped as it writes, and only the newest 50 are kept. Never throws. */
export function rememberAnnounced(orderNumber: string, now: number = Date.now()): void {
  if (orderNumber.trim() === '') return;
  const kept = remembered(now).filter((entry) => entry.order !== orderNumber);
  kept.push({ order: orderNumber, at: now });
  try {
    localStorage.setItem(PURCHASES_ANNOUNCED_KEY, JSON.stringify(kept.slice(-REMEMBERED_AT_MOST)));
  } catch {
    // The browser will not keep it. The purchase has been announced, and a repeat is caught further on.
  }
}
