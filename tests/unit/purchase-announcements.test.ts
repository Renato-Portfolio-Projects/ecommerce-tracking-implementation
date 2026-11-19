import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findProduct, listContextFor } from '../../src/engine/catalog';
import { priceOrder, type OrderInput, type PricedOrder } from '../../src/engine/pricing';
import { CURRENCIES } from '../../src/store/currencies';
import { purchaseParams, trackedOrderLines } from '../../src/tracking/purchase-announcements';
import { pushEvent } from '../../src/tracking/push-event';

// What the purchase carries, and how the lines of an order become items, checked the way the site will use them: the parameters go to
// pushEvent, which checks them against the tracking plan, so an announcement that is missing or adds a field shows up as a problem.

const teesList = listContextFor(findProduct('SI-TEE-002')!);

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

describe('trackedOrderLines', () => {
  const order = (coupon?: string, currency = 'CAD', quantity = 2): PricedOrder => {
    const result = priceOrder({
      lines: [
        { sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity },
        { sku: 'SI-PNT-001', colour: 'Ink', size: '32', quantity: 1 },
      ],
      currency,
      ...(coupon === undefined ? {} : { coupon }),
      destination: { country: 'CA', province: 'ON' },
      shippingMethod: 'express',
    });
    if (!result.ok) throw new Error('could not price the order');
    return result.order;
  };

  it("turns an order's lines into items with the variant, the quantity, the price of one unit and the discount on one", () => {
    expect(trackedOrderLines(order('WELCOME10').lines)).toStrictEqual([
      {
        item_id: 'SI-TEE-002',
        item_name: 'Logo Tee',
        item_category: 'Tees',
        item_variant: 'Ink / M',
        price: 38,
        quantity: 2,
        discount: 3.8,
      },
      {
        item_id: 'SI-PNT-001',
        item_name: 'Plain Chino',
        item_category: 'Pants',
        item_variant: 'Ink / 32',
        price: 96,
        quantity: 1,
        discount: 9.6,
      },
    ]);
  });

  it('puts no discount on an order that used no code', () => {
    for (const item of trackedOrderLines(order().lines)) expect(item).not.toHaveProperty('discount');
  });

  it('prices each unit in the currency the order was placed in', () => {
    const placed = order('WELCOME10', 'GBP');
    const items = trackedOrderLines(placed.lines);
    expect(items.map((item) => item.price)).toStrictEqual(placed.lines.map((line) => line.unitPrice / 100));
    expect(items[0].price).toBe(21.28);
  });

  it('adds the list a line was picked from, found by its variant SKU, and only to a line the note names', () => {
    const items = trackedOrderLines(order().lines, { 'SI-TEE-002-INK-M': teesList });
    expect(items[0]).toMatchObject({ item_list_id: 'tees', item_list_name: 'Tees', index: 2 });
    expect(items[1]).not.toHaveProperty('item_list_id');
    expect(items[1]).not.toHaveProperty('item_list_name');
    expect(items[1]).not.toHaveProperty('index');
  });

  it('ignores an entry of the note that no line of the order has', () => {
    const items = trackedOrderLines(order().lines, { 'SI-TEE-001-PAPER-M': teesList });
    for (const item of items) expect(item).not.toHaveProperty('item_list_id');
  });

  it('gives nothing for an order with no lines', () => {
    expect(trackedOrderLines([])).toStrictEqual([]);
  });
});
