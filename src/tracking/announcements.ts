import type { CartChanges, CartLine } from '../engine/cart.js';
import type { ListContext } from '../engine/catalog.js';
import { checkCoupon } from '../engine/coupons.js';
import type { PricedOrder } from '../engine/pricing.js';
import type { CurrencyCode } from '../store/currencies.js';
import type { HashedUserData } from './hash.js';
import {
  itemFromTrackable,
  trackedLines,
  trackedOrderLines,
  type ListsByVariant,
  type TrackableProduct,
  type TrackedItem,
} from './items.js';
import type { Promotion } from './promotions.js';

/**
 * What each announcement from a page carries, built from what the page carries as data, so that the code
 * that listens to the page and the tests both use one description of it. pushEvent checks the result against
 * the tracking plan.
 */

/** A product in a list: what the page carries about it, and the list it is in with its place there. */
export interface ListedProduct {
  trackable: TrackableProduct;
  list: ListContext;
}

/** A type and not an interface, so that it can be handed to pushEvent as the plain record it is. */
export type ListAnnouncement = {
  item_list_id: string;
  item_list_name: string;
  items: TrackedItem[];
};

/** A list that was seen: its id and name and every product in it, in the currency shown. Nothing for a list with no products. */
export function viewItemListParams(products: ListedProduct[], currency: CurrencyCode): ListAnnouncement | undefined {
  if (products.length === 0) return undefined;
  const { listId, listName } = products[0].list;
  return {
    item_list_id: listId,
    item_list_name: listName,
    items: products.map(({ trackable, list }) => itemFromTrackable(trackable, currency, list)),
  };
}

/** A card that was clicked: the list it is in, and the one product with its place there. */
export function selectItemParams(product: ListedProduct, currency: CurrencyCode): ListAnnouncement {
  return {
    item_list_id: product.list.listId,
    item_list_name: product.list.listName,
    items: [itemFromTrackable(product.trackable, currency, product.list)],
  };
}

/** A promotion that was seen. The popup's carries how it was opened; the hero banner has no source. */
export function viewPromotionParams(promotion: Promotion, source?: string): Record<string, string> {
  return source === undefined ? { ...promotion } : { ...promotion, source };
}

/** A promotion that was clicked. The plan sends the source with a view only. */
export function selectPromotionParams(promotion: Promotion): Record<string, string> {
  return { ...promotion };
}

/** What a shopping announcement carries: the currency, the value of the items in it, and the items. */
export type ShoppingAnnouncement = { currency: CurrencyCode; value: number; items: TrackedItem[] };

/** A product page that loaded: the one product, its price in the currency shown, and that price as the value. No colour or size is chosen yet. */
export function viewItemParams(trackable: TrackableProduct, currency: CurrencyCode): ShoppingAnnouncement {
  const item = itemFromTrackable(trackable, currency);
  return { currency, value: item.price, items: [item] };
}

/**
 * Cart lines that went into the cart, came out of it, or are being looked at: the lines as items with their variant,
 * quantity and the list they were picked from, and the value of them all, priced by the cart's own pricing. Nothing for
 * no lines, so an empty cart announces nothing.
 */
export function cartParams(lines: CartLine[], currency: CurrencyCode): ShoppingAnnouncement | undefined {
  const { items, value } = trackedLines(lines, currency);
  return items.length === 0 ? undefined : { currency, value, items };
}

/** A change of currency the visitor made: the one they left and the one they picked. Nothing when the two are the same. */
export function selectCurrencyParams(
  from: CurrencyCode,
  to: CurrencyCode,
): { currency_from: CurrencyCode; currency_to: CurrencyCode } | undefined {
  return from === to ? undefined : { currency_from: from, currency_to: to };
}

/** A click on a labelled call to action: the label is where it happened. Nothing for a missing or blank label. */
export function ctaClickParams(label: string | undefined): { cta_location: string } | undefined {
  return label === undefined || label.trim() === '' ? undefined : { cta_location: label };
}

/** One announcement that a change to the cart makes: the event, and what it carries. */
export interface CartChangeAnnouncement {
  event: 'add_to_cart' | 'remove_from_cart';
  params: ShoppingAnnouncement;
}

/**
 * What a change to the cart announces: an `add_to_cart` for the units that went in and a `remove_from_cart` for the
 * units that came out, in that order, each only when units moved. A change with no `changes` is the cart being
 * emptied because an order was placed (see cart-client.ts), which is not the shopper taking anything out, so it
 * announces nothing.
 */
export function cartChangeAnnouncements(changes: CartChanges | undefined, currency: CurrencyCode): CartChangeAnnouncement[] {
  if (changes === undefined) return [];
  const announcements: CartChangeAnnouncement[] = [];
  const added = cartParams(changes.added, currency);
  if (added) announcements.push({ event: 'add_to_cart', params: added });
  const removed = cartParams(changes.removed, currency);
  if (removed) announcements.push({ event: 'remove_from_cart', params: removed });
  return announcements;
}

/** What the store can say about the payment: it takes cards and nothing else. The card's brand is not sent. Google's own example of this value is "Credit Card". */
export const PAYMENT_TYPE = 'Credit Card';

/** What a step of the checkout carries: what any shopping announcement does, and the code that is applied when one is. */
export type CheckoutAnnouncement = ShoppingAnnouncement & { coupon?: string };

/**
 * The cart's lines as a checkout step carries them, after the discount of `coupon` if the store accepts it. The code is
 * named only when it was applied, as the store spells it, so an expired or unknown code is never sent. Nothing for an
 * empty cart.
 */
function checkoutParams(lines: CartLine[], currency: CurrencyCode, coupon: string | undefined): CheckoutAnnouncement | undefined {
  const tracked = trackedLines(lines, currency, coupon);
  if (tracked.items.length === 0) return undefined;
  return {
    currency,
    value: tracked.value,
    items: tracked.items,
    ...(tracked.coupon === undefined ? {} : { coupon: tracked.coupon }),
  };
}

/** The checkout page loaded with items in the cart. The value is what the items cost, without shipping or tax. */
export function beginCheckoutParams(lines: CartLine[], currency: CurrencyCode, coupon?: string): CheckoutAnnouncement | undefined {
  return checkoutParams(lines, currency, coupon);
}

/** The address step was completed: the checkout's carry, and the name of the shipping method chosen in it. */
export function addShippingInfoParams(
  lines: CartLine[],
  currency: CurrencyCode,
  shippingTier: string,
  coupon?: string,
): (CheckoutAnnouncement & { shipping_tier: string }) | undefined {
  const base = checkoutParams(lines, currency, coupon);
  return base === undefined ? undefined : { ...base, shipping_tier: shippingTier };
}

/** The payment step was completed: the checkout's carry, and the kind of payment. */
export function addPaymentInfoParams(
  lines: CartLine[],
  currency: CurrencyCode,
  coupon?: string,
): (CheckoutAnnouncement & { payment_type: string }) | undefined {
  const base = checkoutParams(lines, currency, coupon);
  return base === undefined ? undefined : { ...base, payment_type: PAYMENT_TYPE };
}

/** A discount code that was submitted: how it went, and the code itself unless the store does not know it. */
export type CouponAnnouncement = { status: 'success' | 'expired' | 'invalid'; coupon?: string };

/**
 * What a submitted discount code announces. `status` is the order review's own word for how it went (`valid`,
 * `expired` or `invalid`, the words of `checkCoupon`), and `code` the code it recognised. The code is checked again
 * here against the store's own list, and sent as the store spells it, so nothing that was typed can get through: a code
 * the store does not know is reported by its status alone, since the box takes any text and Google's policy is that
 * nothing it could recognise as personal information is sent. Nothing for an empty box, for another status, or for a
 * status and a code that disagree (the review cannot make one).
 */
export function applyCouponParams(status: string, code?: string): CouponAnnouncement | undefined {
  if (status === 'invalid') return { status: 'invalid' };
  if (status !== 'valid' && status !== 'expired') return undefined;
  const check = checkCoupon(code);
  if (check.status !== 'valid' && check.status !== 'expired') return undefined;
  if (check.status !== status) return undefined;
  return { status: status === 'valid' ? 'success' : 'expired', coupon: check.coupon.code };
}

/** A lead as the dataLayer gets it: the code the popup issued, how the popup was opened, and the email's fingerprint when the page could make one. */
export type LeadAnnouncement = { coupon: string; source: string; user_data?: HashedUserData };

/**
 * The lead the popup announced. Only the code and how the popup was opened are taken from what the popup announces:
 * the first name, the email as typed and the marketing tick are not carried. The fingerprint is made by the caller,
 * which has to wait for the browser to make it, and is added when there is one.
 */
export function generateLeadParams(lead: { code: string; source: string }, userData?: HashedUserData): LeadAnnouncement {
  return {
    coupon: lead.code,
    source: lead.source,
    ...(userData === undefined ? {} : { user_data: userData }),
  };
}

/** A purchase as the dataLayer gets it. */
export type PurchaseAnnouncement = {
  transaction_id: string;
  currency: CurrencyCode;
  value: number;
  tax: number;
  shipping: number;
  coupon?: string;
  items: TrackedItem[];
  user_data?: HashedUserData;
};

/**
 * The order the server confirmed, with the numbers it priced it with, divided by 100 and not worked out again here: the
 * value is the items after the discount, without shipping or tax, and each is in the currency the order was placed in,
 * whatever the page shows now. The order number is the transaction ID. A purchase with no transaction ID would be taken
 * for every other without one, so with a blank number there is nothing to announce. `lists` is the note the checkout left
 * of where each line was picked from, and `userData` the fingerprints the caller made; either may be missing.
 */
export function purchaseParams(
  orderNumber: string,
  order: PricedOrder,
  lists: ListsByVariant = {},
  userData?: HashedUserData,
): PurchaseAnnouncement | undefined {
  if (orderNumber.trim() === '') return undefined;
  return {
    transaction_id: orderNumber,
    currency: order.currency,
    value: order.itemsNet / 100,
    tax: order.tax / 100,
    shipping: order.shipping / 100,
    ...(order.appliedCoupon === undefined ? {} : { coupon: order.appliedCoupon.code }),
    items: trackedOrderLines(order.lines, lists),
    ...(userData === undefined ? {} : { user_data: userData }),
  };
}
