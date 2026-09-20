export interface Coupon {
  /** How the code is stored: capitals, no spaces. A typed code is matched to it in any case. */
  code: string;
  percentOff: number;
  /** An expired code is recognised, so the store can say so, but it gives no discount. */
  expired: boolean;
}

export const COUPONS: Coupon[] = [
  { code: 'WELCOME10', percentOff: 10, expired: false },
  { code: 'SPRING20', percentOff: 20, expired: true },
];

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
