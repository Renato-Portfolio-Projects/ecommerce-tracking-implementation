import type { CartLine } from '../engine/cart.js';
import { checkCoupon } from '../engine/coupons.js';
import type { CurrencyCode } from '../store/currencies.js';
import type { ShoppingAnnouncement } from './announcements.js';
import { trackedLines } from './items.js';

/**
 * What each announcement of the checkout page carries: the steps, and the discount codes shoppers apply. They are built here, and not in
 * announcements.ts, which every store page loads, so that only the checkout page is sent them (src/tracking/checkout-tracking.ts loads
 * this file). pushEvent checks the result against the tracking plan.
 */

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

/** What completing a step of the checkout announces: the event, and what it carries. */
export type StepAnnouncement =
  | { event: 'add_shipping_info'; params: NonNullable<ReturnType<typeof addShippingInfoParams>> }
  | { event: 'add_payment_info'; params: NonNullable<ReturnType<typeof addPaymentInfoParams>> };

/**
 * What completing a step announces. The address step, which includes the shipping method, is an `add_shipping_info`, and the
 * payment step an `add_payment_info`. The contact step announces nothing, because GA4 has no event for it, and neither does any
 * word that is not a step. Nothing for an empty cart. `shippingTier` is the name of the method that was chosen, and `coupon`
 * the code applied so far, if any: the order review applies a code after the steps, so a step carries one only when it is
 * completed again afterwards.
 */
export function stepCompletedAnnouncement(
  step: string,
  lines: CartLine[],
  currency: CurrencyCode,
  options: { shippingTier: string; coupon?: string },
): StepAnnouncement | undefined {
  if (step === 'address') {
    const params = addShippingInfoParams(lines, currency, options.shippingTier, options.coupon);
    return params === undefined ? undefined : { event: 'add_shipping_info', params };
  }
  if (step === 'payment') {
    const params = addPaymentInfoParams(lines, currency, options.coupon);
    return params === undefined ? undefined : { event: 'add_payment_info', params };
  }
  return undefined;
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
