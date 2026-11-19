import type { Contact } from '../engine/checkout-form.js';
import type { PricedOrder } from '../engine/pricing.js';
import { purchaseParams } from './purchase-announcements.js';
import { hashedUserData, type HashedUserData } from './hash.js';
import { takeOrderLists } from './order-lists.js';
import { rememberAnnounced, wasAnnounced } from './purchase-marker.js';
import { pushEvent } from './push-event.js';

/**
 * Turns the thank-you page's announcement that it has shown an order into a `purchase`. The page announces it only once the
 * server has confirmed the order and the page has drawn it (a missing, wrong or expired token, and a store that could not be
 * reached, show a message and announce nothing), and it carries the order as the server priced it and the contact, because the
 * email and the phone have to be fingerprinted before anything reaches the dataLayer. Nothing of the address or the card is in it.
 *
 * A purchase is announced once for each order in a browser, not once for each load of the page, because the page can be reloaded
 * and its link works for 7 days. Three layers keep a repeat from being counted twice, and this is the one that stops the browser
 * sending it: the browser remembers which orders it has announced (src/tracking/purchase-marker.ts). The other two work further
 * on, for a browser that has no memory of the order, such as another browser or one that keeps nothing: the `transaction_id`, which
 * Google Analytics counts once, and the `event_id` (`purchase_` and the order number), which Meta pairs a browser event and a
 * server event by. Items carry the list each was picked from only when the checkout left a note for them in this tab
 * (src/tracking/order-lists.ts), so another tab, another browser or a browser that keeps nothing announces them without.
 *
 * A real purchase must never be lost to a browser setting. The fingerprints need a secure page, so a purchase whose email and phone
 * could not be fingerprinted is announced without `user_data`, and the fault is reported in the console by its kind and without the
 * address; a browser that will not say whether it has announced the order is taken not to have; and an order is remembered only once
 * its purchase has really been written to the dataLayer, so a load that could not write it leaves the next one to try.
 *
 * This file is loaded by the thank-you page only (thank-you.astro), so that no other page carries it, or the code that makes
 * fingerprints.
 */

/** What the thank-you page announces once the order is on the page (`thank-you:order-shown`, in components/thank-you.ts). */
export interface OrderShown {
  orderNumber: string;
  order: PricedOrder;
  contact: Contact;
}

/** Announces the purchase, once for each order in this browser. Never throws into the page. */
export async function announcePurchase(shown: OrderShown): Promise<void> {
  // The note is for one order, so it is taken (and removed) whether or not the order is announced now, and no note is left for the next.
  const lists = takeOrderLists();
  if (wasAnnounced(shown.orderNumber)) return;

  let userData: HashedUserData | undefined;
  try {
    const hashed = await hashedUserData({ email: shown.contact?.email, phone: shown.contact?.phone });
    if (Object.keys(hashed).length > 0) userData = hashed;
  } catch (error) {
    // Only the kind of fault is reported, never its message, which a browser could word with what was being hashed.
    const kind = error instanceof Error ? error.name : 'unknown';
    console.error(`purchase: the email and phone could not be fingerprinted (${kind}), so the purchase was announced without user_data.`);
  }

  const params = purchaseParams(shown.orderNumber, shown.order, lists, userData);
  if (params === undefined) return;
  if (pushEvent('purchase', params).pushed) rememberAnnounced(shown.orderNumber);
}

/** Listens, once, for the thank-you page's announcement that an order is on the page. */
export function initPurchaseTracking(): void {
  document.addEventListener('thank-you:order-shown', (event) => {
    const detail = (event as CustomEvent<OrderShown | null>).detail;
    if (detail) void announcePurchase(detail);
  });
}
