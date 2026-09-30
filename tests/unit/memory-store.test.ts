import { describe, expect, it } from 'vitest';
import { priceOrder } from '../../src/engine/pricing';
import { createMemoryStore } from '../../src/server/memory-store';
import type { LeadRecord, OrderRecord } from '../../src/server/store';

const RECORD: LeadRecord = { firstName: 'Maya', email: 'maya@example.com', marketing: false, source: 'auto', createdAt: '2026-09-25T12:30:00.000Z' };

const priced = priceOrder({
  lines: [{ sku: 'SI-TEE-002', colour: 'Paper', size: 'XS', quantity: 1 }],
  currency: 'CAD',
  shippingMethod: 'standard',
  destination: { country: 'CA', province: 'ON' },
});
if (!priced.ok) throw new Error('the fixture order does not price');
const ORDER: OrderRecord = {
  orderNumber: 'SI-ABCD1234',
  order: priced.order,
  contact: { email: 'liam.okafor@example.com', phone: '+1 416 555 0117' },
  address: { country: 'CA', firstName: 'Liam', lastName: 'Okafor', address1: '310 Alder Street', city: 'Toronto', province: 'ON', postalCode: 'M6K 2P8' },
  payment: { brand: 'Visa', last4: '4242' },
  createdAt: '2026-09-25T12:30:00.000Z',
};

function setup() {
  let clock = 1_000_000;
  return { store: createMemoryStore(() => clock), advance: (seconds: number) => (clock += seconds * 1000) };
}

describe('the counters of the store in memory', () => {
  it('start at 1 and count up', async () => {
    const { store } = setup();
    expect([await store.increment('rl:a', 60), await store.increment('rl:a', 60), await store.increment('rl:a', 60)]).toEqual([1, 2, 3]);
  });

  it('are kept apart by name', async () => {
    const { store } = setup();
    await store.increment('rl:a', 60);
    await store.increment('rl:a', 60);
    expect(await store.increment('rl:b', 60)).toBe(1);
  });

  it('are deleted when their time is up, and start again from 1', async () => {
    const { store, advance } = setup();
    await store.increment('rl:a', 60);
    await store.increment('rl:a', 60);
    advance(59);
    expect(store.keys()).toEqual(['rl:a']);
    advance(1);
    expect(store.keys()).toEqual([]);
    expect(await store.increment('rl:a', 60)).toBe(1);
  });

  it('start again from 1 once their time is up, even when nothing has looked at them in between', async () => {
    const { store, advance } = setup();
    await store.increment('rl:a', 60);
    await store.increment('rl:a', 60);
    advance(60);
    expect(await store.increment('rl:a', 60)).toBe(1);
    expect(await store.increment('rl:a', 60)).toBe(2);
  });

  it('have their time moved on by every addition, as the real store does', async () => {
    const { store, advance } = setup();
    await store.increment('rl:a', 60);
    advance(40);
    await store.increment('rl:a', 60);
    expect(store.secondsLeft('rl:a')).toBe(60);
    advance(40);
    expect(store.secondsLeft('rl:a')).toBe(20);
  });
});

describe('the leads of the store in memory', () => {
  it('are kept under their id, with the prefix the real store uses, and read back', async () => {
    const { store } = setup();
    await store.saveLead('abc', RECORD, 100);
    expect(await store.readLead('abc')).toEqual(RECORD);
    expect(store.keys()).toEqual(['lead:abc']);
    expect(await store.readLead('other')).toBeUndefined();
  });

  it('are deleted when their time is up', async () => {
    const { store, advance } = setup();
    await store.saveLead('abc', RECORD, 100);
    expect(store.secondsLeft('lead:abc')).toBe(100);
    advance(99);
    expect(await store.readLead('abc')).toEqual(RECORD);
    advance(1);
    expect(await store.readLead('abc')).toBeUndefined();
    expect(store.secondsLeft('lead:abc')).toBeUndefined();
    expect(store.keys()).toEqual([]);
  });

  it('cannot be changed by changing what was handed in or what was read out', async () => {
    const { store } = setup();
    const handed = { ...RECORD };
    await store.saveLead('abc', handed, 100);
    handed.firstName = 'Changed';
    const read = await store.readLead('abc');
    read!.email = 'changed@example.com';
    expect(await store.readLead('abc')).toEqual(RECORD);
  });

  it('are separate from the counters, though both are listed by name', async () => {
    const { store } = setup();
    await store.increment('rl:a', 60);
    await store.saveLead('abc', RECORD, 100);
    expect(store.keys().sort()).toEqual(['lead:abc', 'rl:a']);
    expect(store.secondsLeft('rl:a')).toBe(60);
    expect(store.secondsLeft('nothing')).toBeUndefined();
  });
});

describe('the orders of the store in memory', () => {
  it('are kept under their token, with the prefix the real store uses, and read back', async () => {
    const { store } = setup();
    await store.saveOrder('tok', ORDER, 100);
    expect(await store.readOrder('tok')).toEqual(ORDER);
    expect(store.keys()).toEqual(['order:tok']);
    expect(await store.readOrder('other')).toBeUndefined();
  });

  it('are deleted when their time is up', async () => {
    const { store, advance } = setup();
    await store.saveOrder('tok', ORDER, 100);
    expect(store.secondsLeft('order:tok')).toBe(100);
    advance(99);
    expect(await store.readOrder('tok')).toEqual(ORDER);
    advance(1);
    expect(await store.readOrder('tok')).toBeUndefined();
    expect(store.keys()).toEqual([]);
  });

  it('cannot be changed by changing what was handed in or what was read out', async () => {
    const { store } = setup();
    const handed = { ...ORDER };
    await store.saveOrder('tok', handed, 100);
    handed.orderNumber = 'SI-CHANGED1';
    const read = await store.readOrder('tok');
    read!.orderNumber = 'SI-CHANGED2';
    expect(await store.readOrder('tok')).toEqual(ORDER);
  });
});

describe('the idempotency attempts of the store in memory', () => {
  it('are kept under their key, with the prefix the real store uses, and point at the order token', async () => {
    const { store } = setup();
    await store.saveIdempotencyKey('attempt-1', 'tok', 100);
    expect(await store.readIdempotencyKey('attempt-1')).toBe('tok');
    expect(store.keys()).toEqual(['idem:attempt-1']);
    expect(await store.readIdempotencyKey('other')).toBeUndefined();
  });

  it('are deleted when their time is up, the same as the order they name', async () => {
    const { store, advance } = setup();
    await store.saveIdempotencyKey('attempt-1', 'tok', 100);
    advance(99);
    expect(await store.readIdempotencyKey('attempt-1')).toBe('tok');
    advance(1);
    expect(await store.readIdempotencyKey('attempt-1')).toBeUndefined();
  });
});
