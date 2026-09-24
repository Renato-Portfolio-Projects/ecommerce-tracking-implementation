import { welcomeCoupon } from '../engine/coupons';
import type { Coupon } from '../store/coupon-codes';

/**
 * The welcome offer, for the pages that mention it (the popup, its reminder tab and the footer link).
 * Those pages cannot be built without one, so a store that has no live welcome code stops the build
 * with a clear message, instead of a popup that offers "undefined% off".
 */
export function welcomeOffer(): Coupon {
  const offer = welcomeCoupon();
  if (!offer) throw new Error('The store has no live welcome code: mark one code in src/store/coupon-codes.ts as welcome, and not expired.');
  return offer;
}
