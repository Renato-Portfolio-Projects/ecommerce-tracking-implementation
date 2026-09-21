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
