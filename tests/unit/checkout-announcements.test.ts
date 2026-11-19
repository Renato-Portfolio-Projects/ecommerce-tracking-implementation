import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartLine } from '../../src/engine/cart';
import { findProduct, listContextFor } from '../../src/engine/catalog';
import { CURRENCIES } from '../../src/store/currencies';
import {
  PAYMENT_TYPE,
  addPaymentInfoParams,
  addShippingInfoParams,
  applyCouponParams,
  beginCheckoutParams,
  stepCompletedAnnouncement,
} from '../../src/tracking/checkout-announcements';
import { pushEvent } from '../../src/tracking/push-event';

// What each announcement of the checkout carries, checked the way the site will use it: the parameters go to pushEvent, which checks
// them against the tracking plan, so an announcement that is missing or adds a field shows up as a problem.

function layer(): Array<Record<string, unknown>> {
  return globalThis.dataLayer as Array<Record<string, unknown>>;
}

beforeEach(() => {
  globalThis.dataLayer = undefined;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('beginCheckoutParams, addShippingInfoParams and addPaymentInfoParams', () => {
  const tees = listContextFor(findProduct('SI-TEE-002')!);
  const lines: CartLine[] = [
    { sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity: 2, list: tees },
    { sku: 'SI-PNT-001', colour: 'Ink', size: '32', quantity: 1 },
  ];
  const twoTees = [lines[0]];

  it('begin_checkout holds the currency, the value of the items and the items, and no code when none is applied', () => {
    expect(beginCheckoutParams(twoTees, 'CAD')).toStrictEqual({
      currency: 'CAD',
      value: 76,
      items: [
        {
          item_id: 'SI-TEE-002',
          item_name: 'Logo Tee',
          item_category: 'Tees',
          item_variant: 'Ink / M',
          price: 38,
          quantity: 2,
          item_list_id: 'tees',
          item_list_name: 'Tees',
          index: 2,
        },
      ],
    });
  });

  it('holds the code and the discount on each unit once a code is applied, and the value is what the items cost after it', () => {
    const params = beginCheckoutParams(twoTees, 'CAD', 'WELCOME10');
    expect(params?.coupon).toBe('WELCOME10');
    expect(params?.value).toBe(68.4);
    expect(params?.items[0].discount).toBe(3.8);
  });

  it('leaves the code out when it is expired, unknown or blank', () => {
    for (const typed of ['SPRING20', 'NOPE', '']) {
      const params = beginCheckoutParams(twoTees, 'CAD', typed);
      expect(params, typed).not.toHaveProperty('coupon');
      expect(params?.value, typed).toBe(76);
    }
  });

  it('add_shipping_info adds the method chosen, and the value stays what the items cost, without shipping or tax', () => {
    expect(addShippingInfoParams(twoTees, 'CAD', 'Express')).toMatchObject({
      currency: 'CAD',
      value: 76,
      shipping_tier: 'Express',
    });
    expect(addShippingInfoParams(twoTees, 'CAD', 'Standard')?.shipping_tier).toBe('Standard');
  });

  it('add_payment_info adds the payment type, which is a card, whatever the card is', () => {
    expect(PAYMENT_TYPE).toBe('Credit Card');
    expect(addPaymentInfoParams(twoTees, 'CAD')).toMatchObject({
      currency: 'CAD',
      value: 76,
      payment_type: 'Credit Card',
    });
  });

  it('carries the code on a step that is completed again after a code was applied', () => {
    expect(addShippingInfoParams(twoTees, 'CAD', 'Express', 'WELCOME10')).toMatchObject({
      value: 68.4,
      coupon: 'WELCOME10',
      shipping_tier: 'Express',
    });
    expect(addPaymentInfoParams(twoTees, 'CAD', 'WELCOME10')).toMatchObject({ value: 68.4, coupon: 'WELCOME10' });
  });

  it('prices in the currency shown', () => {
    expect(beginCheckoutParams(lines, 'EUR')?.value).toBe(113.52);
    expect(addPaymentInfoParams(lines, 'GBP')?.currency).toBe('GBP');
  });

  it('gives nothing for an empty cart, so an empty cart announces nothing', () => {
    expect(beginCheckoutParams([], 'CAD')).toBeUndefined();
    expect(addShippingInfoParams([], 'CAD', 'Standard')).toBeUndefined();
    expect(addPaymentInfoParams([], 'CAD')).toBeUndefined();
  });

  it('makes complete announcements, with nothing missing and nothing extra, with a code and without one', () => {
    for (const coupon of [undefined, 'WELCOME10']) {
      for (const { code } of CURRENCIES) {
        const made: Array<[string, Record<string, unknown>]> = [
          ['begin_checkout', beginCheckoutParams(lines, code, coupon)!],
          ['add_shipping_info', addShippingInfoParams(lines, code, 'Standard', coupon)!],
          ['add_payment_info', addPaymentInfoParams(lines, code, coupon)!],
        ];
        for (const [event, params] of made) {
          globalThis.dataLayer = undefined;
          expect(pushEvent(event, params).problems, `${event} in ${code} with ${coupon}`).toStrictEqual([]);
        }
      }
    }
  });
});

describe('stepCompletedAnnouncement', () => {
  const lines: CartLine[] = [{ sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity: 2 }];

  it('is an add_shipping_info for the address step, which carries the method chosen in it', () => {
    const made = stepCompletedAnnouncement('address', lines, 'CAD', { shippingTier: 'Express' });
    expect(made?.event).toBe('add_shipping_info');
    expect(made?.params).toMatchObject({ currency: 'CAD', value: 76, shipping_tier: 'Express' });
    expect(made?.params).not.toHaveProperty('payment_type');
  });

  it('is an add_payment_info for the payment step, which carries the kind of payment and no shipping method', () => {
    const made = stepCompletedAnnouncement('payment', lines, 'CAD', { shippingTier: 'Express' });
    expect(made?.event).toBe('add_payment_info');
    expect(made?.params).toMatchObject({ currency: 'CAD', value: 76, payment_type: 'Credit Card' });
    expect(made?.params).not.toHaveProperty('shipping_tier');
  });

  it('is nothing for the contact step, which GA4 has no event for, and nothing for any other word', () => {
    for (const step of ['contact', 'review', '', 'Address', 'payment ', 'shipping']) {
      expect(stepCompletedAnnouncement(step, lines, 'CAD', { shippingTier: 'Standard' }), JSON.stringify(step)).toBeUndefined();
    }
  });

  it('carries the code applied so far, with the discount on each unit and the value after it', () => {
    for (const step of ['address', 'payment']) {
      const made = stepCompletedAnnouncement(step, lines, 'CAD', { shippingTier: 'Standard', coupon: 'WELCOME10' });
      expect(made?.params, step).toMatchObject({ value: 68.4, coupon: 'WELCOME10' });
      expect((made?.params.items as Array<{ discount?: number }>)[0].discount, step).toBe(3.8);
    }
  });

  it('carries no code when none is applied, or when the one that was tried was expired', () => {
    for (const coupon of [undefined, 'SPRING20', 'NOPE']) {
      const made = stepCompletedAnnouncement('address', lines, 'CAD', { shippingTier: 'Standard', coupon });
      expect(made?.params, String(coupon)).not.toHaveProperty('coupon');
      expect(made?.params.value, String(coupon)).toBe(76);
    }
  });

  it('gives nothing for an empty cart', () => {
    expect(stepCompletedAnnouncement('address', [], 'CAD', { shippingTier: 'Standard' })).toBeUndefined();
    expect(stepCompletedAnnouncement('payment', [], 'CAD', { shippingTier: 'Standard' })).toBeUndefined();
  });

  it('makes complete announcements in every currency, with a code and without one', () => {
    for (const step of ['address', 'payment']) {
      for (const coupon of [undefined, 'WELCOME10']) {
        for (const { code } of CURRENCIES) {
          const made = stepCompletedAnnouncement(step, lines, code, { shippingTier: 'Standard', coupon })!;
          globalThis.dataLayer = undefined;
          expect(pushEvent(made.event, made.params).problems, `${step} in ${code} with ${coupon}`).toStrictEqual([]);
        }
      }
    }
  });
});

describe('applyCouponParams', () => {
  it('reports a live code as a success, with the code as the store spells it', () => {
    expect(applyCouponParams('valid', 'WELCOME10')).toStrictEqual({ status: 'success', coupon: 'WELCOME10' });
    expect(applyCouponParams('valid', ' welcome10 ')).toStrictEqual({ status: 'success', coupon: 'WELCOME10' });
  });

  it('reports a recognised code that has expired as expired, with the code', () => {
    expect(applyCouponParams('expired', 'SPRING20')).toStrictEqual({ status: 'expired', coupon: 'SPRING20' });
  });

  it('reports a code the store does not know as invalid, and sends no code', () => {
    expect(applyCouponParams('invalid', 'NOPE')).toStrictEqual({ status: 'invalid' });
    expect(applyCouponParams('invalid')).toStrictEqual({ status: 'invalid' });
  });

  it('gives nothing for an empty box, or for a status that is not one of the three', () => {
    for (const status of ['none', '', 'success', 'VALID', ' valid']) {
      expect(applyCouponParams(status, 'WELCOME10'), JSON.stringify(status)).toBeUndefined();
    }
  });

  it('gives nothing when the status and the code disagree, which the order review cannot make', () => {
    expect(applyCouponParams('valid', 'SPRING20')).toBeUndefined();
    expect(applyCouponParams('expired', 'WELCOME10')).toBeUndefined();
    expect(applyCouponParams('valid', 'NOPE')).toBeUndefined();
    expect(applyCouponParams('valid')).toBeUndefined();
    expect(applyCouponParams('expired', '')).toBeUndefined();
  });

  it('never carries what was typed, whatever the status: an email, a card number or a phone number cannot appear', () => {
    const typed: Array<[string, string]> = [
      ['maya.tremblay@example.com', 'maya'],
      ['4242 4242 4242 4242', '4242'],
      ['+16505551212', '6505551212'],
      ['WELCOME10 maya.tremblay@example.com', 'maya'],
      ['<script>alert(1)</script>', 'script'],
    ];
    for (const [text, piece] of typed) {
      for (const status of ['valid', 'expired', 'invalid']) {
        const written = JSON.stringify(applyCouponParams(status, text) ?? {});
        expect(written, `${status}: ${text}`).not.toContain(text);
        expect(written, `${status}: ${text}`).not.toContain(piece);
      }
    }
  });

  it('makes complete apply_coupon announcements for all three outcomes, with the code or without it', () => {
    const outcomes: Array<[string, string | undefined, string, boolean]> = [
      ['valid', 'WELCOME10', 'success', true],
      ['expired', 'SPRING20', 'expired', true],
      ['invalid', 'NOPE', 'invalid', false],
    ];
    for (const [status, code, announced, hasCode] of outcomes) {
      globalThis.dataLayer = undefined;
      const result = pushEvent('apply_coupon', applyCouponParams(status, code)!);
      expect(result.problems, status).toStrictEqual([]);
      expect(layer()[0], status).toMatchObject({ event: 'apply_coupon', status: announced });
      if (hasCode) expect(layer()[0], status).toHaveProperty('coupon', code);
      else expect(layer()[0], status).not.toHaveProperty('coupon');
    }
  });
});
