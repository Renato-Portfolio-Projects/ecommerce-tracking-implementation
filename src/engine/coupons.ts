import { COUPONS, type Coupon } from '../store/coupon-codes';

/**
 * The result of checking a typed code. `valid`, `expired` and `invalid` line up with the
 * `apply_coupon` event's status (success, expired, invalid). `none` means nothing was typed.
 */
export type CouponCheck =
  | { status: 'none' }
  | { status: 'invalid' }
  | { status: 'expired'; coupon: Coupon }
  | { status: 'valid'; coupon: Coupon };

export function checkCoupon(typed: string | undefined): CouponCheck {
  const code = (typed ?? '').trim().toUpperCase();
  if (code === '') return { status: 'none' };

  const coupon = COUPONS.find((candidate) => candidate.code === code);
  if (!coupon) return { status: 'invalid' };
  return coupon.expired ? { status: 'expired', coupon } : { status: 'valid', coupon };
}

/**
 * The code the lead popup offers: the one marked `welcome` that has not expired. Other codes can be
 * live at the same time, because checkCoupon accepts any live code a shopper types; this only says
 * which one the popup hands out. If two live codes were both marked `welcome` it would quietly take
 * the first, which is why a test fails unless the store has exactly one. `coupons` can be given so
 * the rule can be tried on a list of its own.
 */
export function welcomeCoupon(coupons: readonly Coupon[] = COUPONS): Coupon | undefined {
  return coupons.find((coupon) => coupon.welcome === true && !coupon.expired);
}
