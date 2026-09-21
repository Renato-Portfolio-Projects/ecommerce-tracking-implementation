import { describe, expect, it } from 'vitest';
import { COUPONS, checkCoupon } from '../../src/shop/coupons';

describe('COUPONS', () => {
  it('has WELCOME10, which is valid, and SPRING20, which is recognised but expired', () => {
    expect(COUPONS.map((coupon) => [coupon.code, coupon.percentOff, coupon.expired])).toEqual([
      ['WELCOME10', 10, false],
      ['SPRING20', 20, true],
    ]);
  });

  it('gives every coupon a whole percentage between 1 and 100', () => {
    for (const coupon of COUPONS) {
      expect(Number.isInteger(coupon.percentOff), coupon.code).toBe(true);
      expect(coupon.percentOff, coupon.code).toBeGreaterThanOrEqual(1);
      expect(coupon.percentOff, coupon.code).toBeLessThanOrEqual(100);
    }
  });

  it('writes every code in capitals with no spaces, so matching is simple', () => {
    for (const coupon of COUPONS) {
      expect(coupon.code).toMatch(/^[A-Z0-9]+$/);
    }
  });
});

describe('checkCoupon', () => {
  it('reports "none" when no code was entered', () => {
    expect(checkCoupon(undefined)).toEqual({ status: 'none' });
    expect(checkCoupon('')).toEqual({ status: 'none' });
    expect(checkCoupon('   ')).toEqual({ status: 'none' });
  });

  it('accepts WELCOME10 whatever the capitalisation or spacing', () => {
    for (const typed of ['WELCOME10', 'welcome10', ' Welcome10 ']) {
      expect(checkCoupon(typed), typed).toEqual({
        status: 'valid',
        coupon: { code: 'WELCOME10', percentOff: 10, expired: false },
      });
    }
  });

  it('recognises SPRING20 but says it has expired', () => {
    expect(checkCoupon('spring20')).toEqual({
      status: 'expired',
      coupon: { code: 'SPRING20', percentOff: 20, expired: true },
    });
  });

  it('calls any other code invalid', () => {
    expect(checkCoupon('FREESTUFF')).toEqual({ status: 'invalid' });
    expect(checkCoupon('WELCOME')).toEqual({ status: 'invalid' });
  });
});
