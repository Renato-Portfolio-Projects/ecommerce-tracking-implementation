import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartLine } from '../../src/engine/cart';
import { findProduct, productsIn, listContextFor } from '../../src/engine/catalog';
import { priceOrder, type OrderInput, type PricedOrder } from '../../src/engine/pricing';
import { CURRENCIES } from '../../src/store/currencies';
import { pushEvent } from '../../src/tracking/push-event';
import { trackableProduct } from '../../src/tracking/items';
import { CTA_LABELS } from '../../src/tracking/cta-labels';
import { HERO_PROMOTION, POPUP_PROMOTION } from '../../src/tracking/promotions';
import {
  PAYMENT_TYPE,
  addPaymentInfoParams,
  addShippingInfoParams,
  applyCouponParams,
  beginCheckoutParams,
  cartChangeAnnouncements,
  cartParams,
  ctaClickParams,
  generateLeadParams,
  purchaseParams,
  selectCurrencyParams,
  selectItemParams,
  selectPromotionParams,
  viewItemListParams,
  viewItemParams,
  viewPromotionParams,
  type ListedProduct,
} from '../../src/tracking/announcements';

// What each announcement carries, checked the way the site will use it: the parameters go to pushEvent, which
// checks them against the tracking plan, so an announcement that is missing or adds a field shows up as a problem.

function layer(): Array<Record<string, unknown>> {
  return globalThis.dataLayer as Array<Record<string, unknown>>;
}

function listed(collectionId: string): ListedProduct[] {
  return productsIn(collectionId).map((product) => ({
    trackable: trackableProduct(product),
    list: listContextFor(product),
  }));
}

beforeEach(() => {
  globalThis.dataLayer = undefined;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('viewItemListParams', () => {
  it('names the list and holds every product in it, in page order, with its place and its price in the currency shown', () => {
    const params = viewItemListParams(listed('tees'), 'USD');
    expect(params).toBeDefined();
    expect(params?.item_list_id).toBe('tees');
    expect(params?.item_list_name).toBe('Tees');
    expect(params?.items.map((item) => [item.item_id, item.index, item.price])).toStrictEqual([
      ['SI-TEE-001', 1, 20.44],
      ['SI-TEE-002', 2, 27.74],
      ['SI-TEE-003', 3, 24.82],
    ]);
  });

  it('is a complete view_item_list announcement for both collections, with nothing missing and nothing extra', () => {
    for (const collection of ['tees', 'pants']) {
      globalThis.dataLayer = undefined;
      const result = pushEvent('view_item_list', viewItemListParams(listed(collection), 'CAD')!);
      expect(result.problems, collection).toStrictEqual([]);
      expect(layer()).toHaveLength(2);
      expect(layer()[1].ecommerce, collection).toHaveProperty('item_list_id', collection);
    }
  });

  it('gives nothing for a list with no products', () => {
    expect(viewItemListParams([], 'CAD')).toBeUndefined();
  });
});

describe('selectItemParams', () => {
  it('names the list the card is in and holds the one product, with its place', () => {
    const [, logoTee] = listed('tees');
    const params = selectItemParams(logoTee, 'EUR');
    expect(params.item_list_id).toBe('tees');
    expect(params.item_list_name).toBe('Tees');
    expect(params.items).toStrictEqual([
      {
        item_id: 'SI-TEE-002',
        item_name: 'Logo Tee',
        item_category: 'Tees',
        price: 25.08,
        item_list_id: 'tees',
        item_list_name: 'Tees',
        index: 2,
      },
    ]);
  });

  it('is a complete select_item announcement', () => {
    const result = pushEvent('select_item', selectItemParams(listed('pants')[0], 'GBP'));
    expect(result.problems).toStrictEqual([]);
  });
});

describe('viewPromotionParams and selectPromotionParams', () => {
  it('carry the three promotion fields, and a view adds the source when there is one', () => {
    expect(viewPromotionParams(POPUP_PROMOTION, 'auto')).toStrictEqual({ ...POPUP_PROMOTION, source: 'auto' });
    expect(viewPromotionParams(HERO_PROMOTION)).toStrictEqual({ ...HERO_PROMOTION });
    expect(selectPromotionParams(HERO_PROMOTION)).toStrictEqual({ ...HERO_PROMOTION });
  });

  it('are complete announcements for both promotions', () => {
    for (const promotion of [HERO_PROMOTION, POPUP_PROMOTION]) {
      expect(pushEvent('view_promotion', viewPromotionParams(promotion, 'manual')).problems, promotion.promotion_id).toStrictEqual([]);
      expect(pushEvent('select_promotion', selectPromotionParams(promotion)).problems, promotion.promotion_id).toStrictEqual([]);
    }
  });

  it('never send a source with a selection, which the plan sends only with a view', () => {
    expect(selectPromotionParams(POPUP_PROMOTION)).not.toHaveProperty('source');
  });
});

describe('viewItemParams', () => {
  const logoTee = trackableProduct(findProduct('SI-TEE-002')!);

  it('is the one product with its price in the currency shown, and that price as the value', () => {
    expect(viewItemParams(logoTee, 'USD')).toStrictEqual({
      currency: 'USD',
      value: 27.74,
      items: [{ item_id: 'SI-TEE-002', item_name: 'Logo Tee', item_category: 'Tees', price: 27.74 }],
    });
  });

  it('is a complete view_item announcement, with no colour, size or list, since none is chosen yet', () => {
    const result = pushEvent('view_item', viewItemParams(logoTee, 'CAD'));
    expect(result.problems).toStrictEqual([]);
    expect(layer()).toHaveLength(2);
    const item = (layer()[1].ecommerce as { items: Record<string, unknown>[] }).items[0];
    expect(item).not.toHaveProperty('item_variant');
    expect(item).not.toHaveProperty('quantity');
    expect(item).not.toHaveProperty('index');
  });
});

describe('cartParams', () => {
  const tees = listContextFor(findProduct('SI-TEE-002')!);
  const lines: CartLine[] = [
    { sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity: 2, list: tees },
    { sku: 'SI-PNT-001', colour: 'Ink', size: '32', quantity: 1 },
  ];

  it('holds the lines as items, the value of them all, and the currency', () => {
    const params = cartParams(lines, 'CAD');
    expect(params?.currency).toBe('CAD');
    expect(params?.value).toBe(172);
    expect(params?.items.map((item) => [item.item_id, item.item_variant, item.quantity, item.price])).toStrictEqual([
      ['SI-TEE-002', 'Ink / M', 2, 38],
      ['SI-PNT-001', 'Ink / 32', 1, 96],
    ]);
    expect(params?.items[0]).toMatchObject({ item_list_id: 'tees', item_list_name: 'Tees', index: 2 });
  });

  it('prices in the currency shown', () => {
    expect(cartParams(lines, 'EUR')?.value).toBe(113.52);
  });

  it('is a complete add_to_cart, remove_from_cart and view_cart announcement', () => {
    for (const event of ['add_to_cart', 'remove_from_cart', 'view_cart']) {
      globalThis.dataLayer = undefined;
      const result = pushEvent(event, cartParams(lines, 'USD')!);
      expect(result.problems, event).toStrictEqual([]);
    }
  });

  it('gives nothing for no lines, so an empty cart announces nothing', () => {
    expect(cartParams([], 'CAD')).toBeUndefined();
  });
});

describe('cartChangeAnnouncements', () => {
  const went: CartLine[] = [{ sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity: 2 }];
  const came: CartLine[] = [{ sku: 'SI-PNT-001', colour: 'Ink', size: '32', quantity: 1 }];

  it('announces nothing for a change that carries no changes, which is how the cart says an order emptied it', () => {
    expect(cartChangeAnnouncements(undefined, 'CAD')).toStrictEqual([]);
  });

  it('announces nothing when no units moved', () => {
    expect(cartChangeAnnouncements({ added: [], removed: [] }, 'CAD')).toStrictEqual([]);
  });

  it('announces the units that went in as an add_to_cart, and nothing else', () => {
    expect(cartChangeAnnouncements({ added: went, removed: [] }, 'CAD')).toStrictEqual([
      { event: 'add_to_cart', params: cartParams(went, 'CAD') },
    ]);
  });

  it('announces the units that came out as a remove_from_cart, and nothing else', () => {
    expect(cartChangeAnnouncements({ added: [], removed: came }, 'CAD')).toStrictEqual([
      { event: 'remove_from_cart', params: cartParams(came, 'CAD') },
    ]);
  });

  it('announces both when both happened, the units that went in first', () => {
    const events = cartChangeAnnouncements({ added: went, removed: came }, 'CAD').map((announcement) => announcement.event);
    expect(events).toStrictEqual(['add_to_cart', 'remove_from_cart']);
  });

  it('prices what it announces in the currency given', () => {
    const [add] = cartChangeAnnouncements({ added: went, removed: [] }, 'EUR');
    expect(add.params.currency).toBe('EUR');
    expect(add.params.value).toBe(50.16);
  });

  it('makes complete announcements, with nothing missing and nothing extra', () => {
    for (const { event, params } of cartChangeAnnouncements({ added: went, removed: came }, 'USD')) {
      globalThis.dataLayer = undefined;
      expect(pushEvent(event, params).problems, event).toStrictEqual([]);
    }
  });
});

describe('selectCurrencyParams', () => {
  it('names the currency the visitor left and the one they picked', () => {
    expect(selectCurrencyParams('CAD', 'EUR')).toStrictEqual({ currency_from: 'CAD', currency_to: 'EUR' });
  });

  it('gives nothing when the two are the same, since nothing was changed', () => {
    expect(selectCurrencyParams('USD', 'USD')).toBeUndefined();
  });

  it('is a complete select_currency announcement for every change from one currency to another', () => {
    for (const from of CURRENCIES) {
      for (const to of CURRENCIES) {
        if (from.code === to.code) continue;
        globalThis.dataLayer = undefined;
        const result = pushEvent('select_currency', selectCurrencyParams(from.code, to.code)!);
        expect(result.problems, `${from.code} to ${to.code}`).toStrictEqual([]);
      }
    }
  });
});

describe('ctaClickParams', () => {
  it('carries the label as the place of the click', () => {
    expect(ctaClickParams('Nav - Tees')).toStrictEqual({ cta_location: 'Nav - Tees' });
  });

  it('gives nothing for a missing or blank label', () => {
    expect(ctaClickParams(undefined)).toBeUndefined();
    expect(ctaClickParams('')).toBeUndefined();
    expect(ctaClickParams('   ')).toBeUndefined();
  });

  it('is a complete cta_click announcement for every label in the list', () => {
    for (const label of CTA_LABELS) {
      globalThis.dataLayer = undefined;
      expect(pushEvent('cta_click', ctaClickParams(label)!).problems, label).toStrictEqual([]);
    }
  });
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

describe('generateLeadParams', () => {
  const FINGERPRINT = 'a68414a03cfb6a8136979bfaa406739eeb4a195a60d8345121b38d1c4038140f';
  // What the popup announces: the shopper's details are in it so the listener can fingerprint the email, and none of them
  // is meant to reach the dataLayer.
  const popup = {
    firstName: 'Maya',
    email: 'maya.tremblay@example.com',
    marketing: true,
    code: 'WELCOME10',
    source: 'auto',
  };

  it('carries the code the popup issued and how the popup was opened, and nothing the shopper typed', () => {
    expect(generateLeadParams(popup)).toStrictEqual({ coupon: 'WELCOME10', source: 'auto' });
    const written = JSON.stringify(generateLeadParams(popup, { sha256_email_address: FINGERPRINT }));
    for (const typed of ['Maya', 'maya.tremblay@example.com', 'marketing']) expect(written).not.toContain(typed);
  });

  it('adds the email fingerprint, which the caller makes, and leaves user_data out when there is none', () => {
    expect(generateLeadParams(popup, { sha256_email_address: FINGERPRINT })).toStrictEqual({
      coupon: 'WELCOME10',
      source: 'auto',
      user_data: { sha256_email_address: FINGERPRINT },
    });
    expect(generateLeadParams(popup)).not.toHaveProperty('user_data');
  });

  it('keeps how the popup was opened', () => {
    expect(generateLeadParams({ ...popup, source: 'manual' }).source).toBe('manual');
  });

  it('is a complete generate_lead announcement, with a fingerprint and without one', () => {
    for (const userData of [{ sha256_email_address: FINGERPRINT }, undefined]) {
      globalThis.dataLayer = undefined;
      const result = pushEvent('generate_lead', generateLeadParams(popup, userData));
      expect(result.problems, String(userData)).toStrictEqual([]);
      expect(layer()[0]).toMatchObject({ event: 'generate_lead', coupon: 'WELCOME10', source: 'auto' });
    }
  });
});

describe('purchaseParams', () => {
  const FINGERPRINT = 'a68414a03cfb6a8136979bfaa406739eeb4a195a60d8345121b38d1c4038140f';
  const PHONE_FINGERPRINT = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const tees = listContextFor(findProduct('SI-TEE-002')!);
  const lists = { 'SI-TEE-002-INK-M': tees };

  interface Options {
    coupon?: string;
    currency?: string;
    lines?: OrderInput['lines'];
    shippingMethod?: string;
  }

  // The order as the server prices it: two Logo Tees, an Ontario address, in Canadian dollars with Express unless said otherwise.
  function placed({
    coupon,
    currency = 'CAD',
    lines = [{ sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity: 2 }],
    shippingMethod = 'express',
  }: Options = {}): PricedOrder {
    const result = priceOrder({
      lines,
      currency,
      ...(coupon === undefined ? {} : { coupon }),
      destination: { country: 'CA', province: 'ON' },
      shippingMethod,
    });
    if (!result.ok) throw new Error('could not price the order');
    return result.order;
  }

  it('reports the order as the server priced it: the value is after the discount, with no shipping or tax in it', () => {
    expect(purchaseParams('SI-ABCD2345', placed({ coupon: 'WELCOME10' }), lists)).toStrictEqual({
      transaction_id: 'SI-ABCD2345',
      currency: 'CAD',
      value: 68.4,
      tax: 11.36,
      shipping: 19,
      coupon: 'WELCOME10',
      items: [
        {
          item_id: 'SI-TEE-002',
          item_name: 'Logo Tee',
          item_category: 'Tees',
          item_variant: 'Ink / M',
          price: 38,
          quantity: 2,
          discount: 3.8,
          item_list_id: 'tees',
          item_list_name: 'Tees',
          index: 2,
        },
      ],
    });
  });

  it('takes each figure from the order itself, in every currency, and not from what the page shows now', () => {
    for (const { code } of CURRENCIES) {
      const order = placed({ currency: code, coupon: 'WELCOME10' });
      const params = purchaseParams('SI-ABCD2345', order)!;
      expect(params.currency, code).toBe(code);
      expect(params.value, code).toBe(order.itemsNet / 100);
      expect(params.tax, code).toBe(order.tax / 100);
      expect(params.shipping, code).toBe(order.shipping / 100);
    }
  });

  it('keeps a shipping of zero, which is a free Standard, and does not call it missing', () => {
    const free = placed({
      lines: [{ sku: 'SI-TEE-003', colour: 'Paper', size: 'M', quantity: 3 }],
      shippingMethod: 'standard',
    });
    expect(free.shipping).toBe(0);
    const params = purchaseParams('SI-ABCD2345', free)!;
    expect(params).toHaveProperty('shipping', 0);
    expect(pushEvent('purchase', params).problems).toStrictEqual([]);
  });

  it('leaves the code and the discounts out when the order used no code', () => {
    const params = purchaseParams('SI-ABCD2345', placed())!;
    expect(params).not.toHaveProperty('coupon');
    for (const item of params.items) expect(item).not.toHaveProperty('discount');
  });

  it('adds the list to the items the note names, and leaves it off when there is no note or the note does not name them', () => {
    expect(purchaseParams('SI-ABCD2345', placed(), lists)!.items[0]).toMatchObject({
      item_list_id: 'tees',
      item_list_name: 'Tees',
      index: 2,
    });
    expect(purchaseParams('SI-ABCD2345', placed())!.items[0]).not.toHaveProperty('item_list_id');
    expect(purchaseParams('SI-ABCD2345', placed(), {})!.items[0]).not.toHaveProperty('item_list_id');
  });

  it('adds the fingerprints the caller made, and leaves user_data out when there are none', () => {
    const userData = { sha256_email_address: FINGERPRINT, sha256_phone_number: PHONE_FINGERPRINT };
    expect(purchaseParams('SI-ABCD2345', placed(), lists, userData)!.user_data).toStrictEqual(userData);
    expect(purchaseParams('SI-ABCD2345', placed(), lists)).not.toHaveProperty('user_data');
  });

  it('gives nothing without an order number, since a purchase with no transaction ID would count as every other', () => {
    for (const blank of ['', '   ']) {
      expect(purchaseParams(blank, placed(), lists), JSON.stringify(blank)).toBeUndefined();
    }
  });

  it('is a complete purchase announcement, whatever is left out, and its event_id is made from the order number', () => {
    for (const coupon of [undefined, 'WELCOME10']) {
      for (const withLists of [lists, undefined]) {
        for (const userData of [{ sha256_email_address: FINGERPRINT }, undefined]) {
          globalThis.dataLayer = undefined;
          const params = purchaseParams('SI-ABCD2345', placed({ coupon }), withLists, userData)!;
          const label = `${coupon} ${withLists ? 'with' : 'without'} lists, ${userData ? 'with' : 'without'} user_data`;
          expect(pushEvent('purchase', params).problems, label).toStrictEqual([]);
          expect(layer()[1].event_id, label).toBe('purchase_SI-ABCD2345');
        }
      }
    }
  });
});
