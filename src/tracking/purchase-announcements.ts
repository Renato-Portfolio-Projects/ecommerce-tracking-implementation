import type { PricedLine, PricedOrder } from '../engine/pricing.js';
import type { CurrencyCode } from '../store/currencies.js';
import type { HashedUserData } from './hash.js';
import { itemFromPriced, type ListsByVariant, type TrackedItem } from './items.js';

/**
 * What the purchase carries, built from the order the server confirmed. It is built here, and not in announcements.ts, which every store
 * page loads, so that only the thank-you page is sent it (src/tracking/purchase-tracking.ts loads this file). pushEvent checks the
 * result against the tracking plan.
 */

/**
 * The lines of an order the server priced, as items: each in the currency the order was placed in, with the discount
 * on one unit, and with the list it was picked from when `lists` names its variant SKU.
 */
export function trackedOrderLines(lines: PricedLine[], lists: ListsByVariant = {}): TrackedItem[] {
  return lines.map((line) => itemFromPriced(line, lists[line.variantSku]));
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
