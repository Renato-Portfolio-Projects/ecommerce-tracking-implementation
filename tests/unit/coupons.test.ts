import { describe, expect, it } from 'vitest';
import { COUPONS } from '../../src/store/coupon-codes';
import { checkCoupon, welcomeCoupon } from '../../src/engine/coupons';

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
        coupon: { code: 'WELCOME10', percentOff: 10, expired: false, welcome: true },
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

describe('welcomeCoupon', () => {
  it('is the code the lead popup offers: the live code marked as the welcome code', () => {
    const marked = COUPONS.filter((coupon) => coupon.welcome === true && !coupon.expired);
    expect(marked).toHaveLength(1);
    expect(welcomeCoupon()).toBe(marked[0]);
  });

  it('is not chosen by its place in the list, so other live codes can come first', () => {
    const list = [
      { code: 'FRIENDS15', percentOff: 15, expired: false },
      { code: 'WELCOME10', percentOff: 10, expired: false, welcome: true },
    ];
    expect(welcomeCoupon(list)?.code).toBe('WELCOME10');
  });

  it('does not offer a welcome code that has expired, and takes the live one marked after it', () => {
    const list = [
      { code: 'WELCOME10', percentOff: 10, expired: true, welcome: true },
      { code: 'WELCOME15', percentOff: 15, expired: false, welcome: true },
    ];
    expect(welcomeCoupon(list)?.code).toBe('WELCOME15');
  });

  it('takes the first when two live codes are both marked, which is why the store must never have two', () => {
    const list = [
      { code: 'WELCOME10', percentOff: 10, expired: false, welcome: true },
      { code: 'WELCOME15', percentOff: 15, expired: false, welcome: true },
    ];
    expect(welcomeCoupon(list)?.code).toBe('WELCOME10');
  });

  it('says there is no welcome code when none is marked and live, however many other codes are', () => {
    expect(welcomeCoupon([{ code: 'FRIENDS15', percentOff: 15, expired: false }])).toBeUndefined();
    expect(welcomeCoupon([{ code: 'OLD', percentOff: 5, expired: true, welcome: true }])).toBeUndefined();
    expect(welcomeCoupon([])).toBeUndefined();
  });

  it('lets other codes be live beside the welcome code without changing which one is offered', () => {
    const list = [...COUPONS, { code: 'FRIENDS15', percentOff: 15, expired: false }];
    expect(list.filter((coupon) => !coupon.expired).length).toBeGreaterThan(1);
    expect(welcomeCoupon(list)?.code).toBe(welcomeCoupon()?.code);
  });

  it('keeps exactly one live welcome code in the store, because the popup offers one and quietly takes the first otherwise', () => {
    const live = COUPONS.filter((coupon) => coupon.welcome === true && !coupon.expired);
    expect(
      live.map((coupon) => coupon.code),
      'The store must have exactly one live code marked welcome: mark the new one and retire the old one by marking it expired.',
    ).toHaveLength(1);
  });
});
