import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findProduct, listContextFor } from '../../src/engine/catalog';
import type { Contact } from '../../src/engine/checkout-form';
import { priceOrder, type PricedOrder } from '../../src/engine/pricing';
import { ORDER_LISTS_KEY } from '../../src/tracking/order-lists';
import { PURCHASES_ANNOUNCED_KEY } from '../../src/tracking/purchase-marker';
import { announcePurchase, type OrderShown } from '../../src/tracking/purchase-tracking';

// What happens when the thank-you page says it has shown an order: the purchase is announced once for each order in a browser,
// with the server's own figures, the lists each item was picked from (if the checkout left a note) and the fingerprints of the
// email and the phone. Tracking must never lose a real purchase to a browser setting, so a page that cannot make fingerprints and a
// browser that will not keep anything are tried too. The tests give the code a stand-in for the browser's two kinds of storage.

const fingerprintOf = (text: string) => createHash('sha256').update(text).digest('hex');

const ORDER = 'SI-ABCD2345';
const contact: Contact = { email: '  Maya.Tremblay@Example.COM ', phone: '+1 650 555 1212' };
const teesList = listContextFor(findProduct('SI-TEE-002')!);

/** Two Logo Tees with WELCOME10 and Express to Ontario, in Canadian dollars: the order the plan's worked example is about. */
function placed(): PricedOrder {
  const result = priceOrder({
    lines: [{ sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity: 2 }],
    currency: 'CAD',
    coupon: 'WELCOME10',
    destination: { country: 'CA', province: 'ON' },
    shippingMethod: 'express',
  });
  if (!result.ok) throw new Error('could not price the order');
  return result.order;
}
const shown = (overrides: Partial<OrderShown> = {}): OrderShown => ({ orderNumber: ORDER, order: placed(), contact, ...overrides });

function standIn() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}
function refusing() {
  const refuse = () => {
    throw new Error('the browser will not keep it');
  };
  return { getItem: refuse, setItem: refuse, removeItem: refuse };
}

const layer = () => globalThis.dataLayer as Array<Record<string, unknown>>;
const purchases = () => layer().filter((entry) => entry.event === 'purchase');

let browserStorage = standIn();
let tabStorage = standIn();

beforeEach(() => {
  globalThis.dataLayer = undefined;
  browserStorage = standIn();
  tabStorage = standIn();
  vi.stubGlobal('localStorage', browserStorage);
  vi.stubGlobal('sessionStorage', tabStorage);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, 'localStorage');
  Reflect.deleteProperty(globalThis, 'sessionStorage');
});

/** A page that is not secure has no crypto.subtle, but still has the rest of crypto, such as the random ids. */
function pageThatCannotHash(): void {
  const real = globalThis.crypto;
  vi.stubGlobal('crypto', { randomUUID: () => real.randomUUID() });
}

describe('announcePurchase', () => {
  it('announces the order the server confirmed, with its own figures, its code and the fingerprints of the email and the phone', async () => {
    await announcePurchase(shown());
    expect(layer()).toHaveLength(2);
    expect(layer()[0]).toStrictEqual({ ecommerce: null });
    const entry = purchases()[0];
    expect(entry.event_id).toBe('purchase_SI-ABCD2345');
    expect(entry.ecommerce).toMatchObject({
      transaction_id: ORDER,
      currency: 'CAD',
      value: 68.4,
      tax: 11.36,
      shipping: 19,
      coupon: 'WELCOME10',
    });
    expect(entry.user_data).toStrictEqual({
      sha256_email_address: fingerprintOf('maya.tremblay@example.com'),
      sha256_phone_number: fingerprintOf('16505551212'),
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it('fingerprints the phone as the platforms do, as the digits with the country code, worked out here independently', async () => {
    await announcePurchase(shown({ contact: { email: 'a@example.com', phone: '+44 7700 900123' } }));
    expect(purchases()[0].user_data).toMatchObject({ sha256_phone_number: fingerprintOf('447700900123') });
  });

  it('carries only the fingerprint of the email when the shopper gave no phone', async () => {
    await announcePurchase(shown({ contact: { email: 'maya.tremblay@example.com' } }));
    expect(purchases()[0].user_data).toStrictEqual({ sha256_email_address: fingerprintOf('maya.tremblay@example.com') });
  });

  it('adds the list each item was picked from when the checkout left a note, and removes the note', async () => {
    tabStorage.setItem(ORDER_LISTS_KEY, JSON.stringify({ 'SI-TEE-002-INK-M': teesList }));
    await announcePurchase(shown());
    const items = (purchases()[0].ecommerce as { items: Array<Record<string, unknown>> }).items;
    expect(items[0]).toMatchObject({ item_id: 'SI-TEE-002', item_list_id: 'tees', item_list_name: 'Tees', index: 2, discount: 3.8 });
    expect(tabStorage.data.has(ORDER_LISTS_KEY)).toBe(false);
  });

  it('leaves the lists off when there is no note, as in another tab, another browser or a browser that keeps nothing', async () => {
    await announcePurchase(shown());
    const items = (purchases()[0].ecommerce as { items: Array<Record<string, unknown>> }).items;
    expect(items[0]).not.toHaveProperty('item_list_id');
    expect(items[0]).not.toHaveProperty('index');
  });

  it('remembers the order, with when it was announced, so that the browser knows it has announced it', async () => {
    await announcePurchase(shown());
    const remembered = JSON.parse(browserStorage.data.get(PURCHASES_ANNOUNCED_KEY) ?? '[]') as Array<{ order: string; at: number }>;
    expect(remembered.map((entry) => entry.order)).toStrictEqual([ORDER]);
    expect(Math.abs(Date.now() - remembered[0].at)).toBeLessThan(60_000);
  });

  it('announces an order once, and a second time for the same order announces nothing', async () => {
    await announcePurchase(shown());
    await announcePurchase(shown());
    expect(purchases()).toHaveLength(1);
    expect(layer()).toHaveLength(2);
  });

  it('announces a different order as a purchase of its own', async () => {
    await announcePurchase(shown());
    await announcePurchase(shown({ orderNumber: 'SI-WXYZ6789' }));
    expect(purchases().map((entry) => entry.event_id)).toStrictEqual(['purchase_SI-ABCD2345', 'purchase_SI-WXYZ6789']);
  });

  it('removes the note even for an order that was announced already, so that no note is left for the next order', async () => {
    await announcePurchase(shown());
    tabStorage.setItem(ORDER_LISTS_KEY, JSON.stringify({ 'SI-TEE-002-INK-M': teesList }));
    await announcePurchase(shown());
    expect(tabStorage.data.has(ORDER_LISTS_KEY)).toBe(false);
    expect(purchases()).toHaveLength(1);
  });

  it('announces the purchase without user_data, and says why, when the page cannot make the fingerprints', async () => {
    pageThatCannotHash();
    await announcePurchase(shown());
    expect(purchases()).toHaveLength(1);
    expect(purchases()[0]).not.toHaveProperty('user_data');
    expect(purchases()[0].ecommerce).toMatchObject({ transaction_id: ORDER, value: 68.4 });
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(console.error).mock.calls[0][0])).toMatch(/purchase.*fingerprint/i);
  });

  it('still remembers an order whose fingerprints could not be made, so a reload does not announce it twice', async () => {
    pageThatCannotHash();
    await announcePurchase(shown());
    await announcePurchase(shown());
    expect(purchases()).toHaveLength(1);
  });

  it('never repeats the email, the phone or the name in the dataLayer, in the report of a failed fingerprint, or anywhere else', async () => {
    pageThatCannotHash();
    await announcePurchase(shown());
    // In lower case, because the email was typed in mixed case and a repeat of it would be too.
    const everything = JSON.stringify([layer(), vi.mocked(console.error).mock.calls, [...browserStorage.data], [...tabStorage.data]]).toLowerCase();
    for (const typed of ['maya', 'tremblay', 'example.com', '6505551212', '650 555']) expect(everything, typed).not.toContain(typed);
  });

  it('does not put the email or the phone in the dataLayer when the fingerprints were made', async () => {
    await announcePurchase(shown());
    const written = JSON.stringify(layer()).toLowerCase();
    for (const typed of ['maya', 'tremblay', 'example.com', '6505551212']) expect(written, typed).not.toContain(typed);
  });

  it('announces the purchase, and does not throw, when the browser will not keep anything, and again for a repeat, since it cannot remember', async () => {
    vi.stubGlobal('localStorage', refusing());
    vi.stubGlobal('sessionStorage', refusing());
    await expect(announcePurchase(shown())).resolves.toBeUndefined();
    await announcePurchase(shown());
    expect(purchases()).toHaveLength(2);
    expect(purchases()[0].event_id).toBe(purchases()[1].event_id);
    const items = (purchases()[0].ecommerce as { items: Array<Record<string, unknown>> }).items;
    expect(items[0]).not.toHaveProperty('item_list_id');
  });

  it('announces nothing, and remembers nothing, for a blank order number', async () => {
    for (const orderNumber of ['', '   ']) await announcePurchase(shown({ orderNumber }));
    expect(globalThis.dataLayer ?? []).toHaveLength(0);
    expect(browserStorage.data.has(PURCHASES_ANNOUNCED_KEY)).toBe(false);
  });

  it('does not remember a purchase that could not be written to the dataLayer, so that a later load can try again', async () => {
    globalThis.dataLayer = Object.freeze([]) as unknown as unknown[];
    await expect(announcePurchase(shown())).resolves.toBeUndefined();
    expect(browserStorage.data.has(PURCHASES_ANNOUNCED_KEY)).toBe(false);
    globalThis.dataLayer = undefined;
    await announcePurchase(shown());
    expect(purchases()).toHaveLength(1);
    expect(browserStorage.data.has(PURCHASES_ANNOUNCED_KEY)).toBe(true);
  });

  it('does not throw, and announces what it can, when the contact is missing', async () => {
    await expect(announcePurchase(shown({ contact: undefined as unknown as Contact }))).resolves.toBeUndefined();
    expect(purchases()).toHaveLength(1);
    expect(purchases()[0]).not.toHaveProperty('user_data');
  });
});
