// The discount codes Second Impression accepts. This is the store's own data. The check that a typed
// code matches one of these is in src/engine/coupons.ts.

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
