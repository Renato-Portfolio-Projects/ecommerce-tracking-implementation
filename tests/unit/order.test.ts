import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkAddress, checkContact } from '../../src/engine/checkout-form';
import { priceOrder } from '../../src/engine/pricing';
import { orderHandler, type OrderDependencies } from '../../src/server/order';
import { createMemoryStore } from '../../src/server/memory-store';
import type { Store } from '../../src/server/store';
import { ORDER_ATTEMPTS_PER_HOUR, ORDER_RECORD_LIFETIME_DAYS } from '../../src/store/policy';

const OPEN = { PUBLIC_STORE_OPEN: 'true' };
const SECRET = 'a-secret-for-the-test';
const ADDRESS = '203.0.113.7';
const HOUR = 60 * 60 * 1000;

const CONTACT = { email: 'liam.okafor@example.com', phone: '+1 416 555 0117' };
const SHIPPING_ADDRESS = {
  country: 'CA',
  firstName: 'Liam',
  lastName: 'Okafor',
  address1: '310 Alder Street',
  city: 'Toronto',
  province: 'ON',
  postalCode: 'M6K 2P8',
};
const PAYMENT = { brand: 'Visa', last4: '4242' };
const LINES = [{ sku: 'SI-TEE-002', colour: 'Paper', size: 'XS', quantity: 1 }];
const GOOD = {
  lines: LINES,
  currency: 'CAD',
  shippingMethod: 'standard',
  contact: CONTACT,
  address: SHIPPING_ADDRESS,
  payment: PAYMENT,
  idempotencyKey: 'attempt-1',
};

afterEach(() => vi.restoreAllMocks());

/** A handler wired to a store in memory, a clock the test moves and ids it picks. */
function setup(overrides: Partial<OrderDependencies> = {}, env: Record<string, string | undefined> = OPEN) {
  let clock = Date.UTC(2026, 8, 25, 12, 30, 0);
  let tokens = 0;
  let numbers = 0;
  const store = createMemoryStore(() => clock);
  const dependencies: OrderDependencies = {
    store,
    now: () => clock,
    newOrderToken: () => `token${(tokens += 1)}`,
    newOrderNumber: () => `SI-ORDER${(numbers += 1)}`,
    secret: SECRET,
    ...overrides,
  };
  const handler = orderHandler(env, () => dependencies);
  const send = (body: unknown, headers: Record<string, string> = { 'x-forwarded-for': ADDRESS }, method = 'POST') =>
    handler(
      new Request('https://example.test/api/order', {
        method,
        headers,
        ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
      }),
    );
  const read = (token: string | undefined) =>
    handler(new Request(`https://example.test/api/order${token === undefined ? '' : `?token=${token}`}`));
  return { store, send, read, advance: (ms: number) => (clock += ms), now: () => clock };
}

const json = async (response: Response) => (await response.json()) as Record<string, unknown>;

describe('an order that passes every check', () => {
  it('is kept, and the answer carries the order number and the token', async () => {
    const t = setup();
    const response = await t.send(GOOD);
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ ok: true, orderNumber: 'SI-ORDER1', token: 'token1' });
  });

  it('keeps the same order the browser would have priced, checked with the same code', async () => {
    const t = setup();
    await t.send(GOOD);
    const record = await t.store.readOrder('token1');
    const expected = priceOrder({
      lines: LINES,
      currency: 'CAD',
      shippingMethod: 'standard',
      destination: { country: 'CA', province: 'ON' },
    });
    expect(expected.ok).toBe(true);
    if (expected.ok) expect(record!.order).toEqual(expected.order);
  });

  it('keeps the contact and address as the checks cleaned them, and only the brand and last four of the card', async () => {
    const t = setup();
    await t.send(GOOD);
    const record = await t.store.readOrder('token1');
    const contact = checkContact(CONTACT);
    const address = checkAddress(SHIPPING_ADDRESS);
    expect(contact.ok && address.ok).toBe(true);
    if (contact.ok && address.ok) {
      expect(record!.contact).toEqual(contact.value);
      expect(record!.address).toEqual(address.value);
    }
    expect(record!.payment).toEqual({ brand: 'Visa', last4: '4242' });
    expect(JSON.stringify(record)).not.toMatch(/4242.*4242.*4242|securityCode|expiry/i);
  });

  it('answers as JSON that no shared cache may keep, and says nothing but what it must', async () => {
    const response = await setup().send(GOOD);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(Object.keys(await json(response))).toEqual(['ok', 'orderNumber', 'token']);
  });

  it('keeps the order for seven days, and the visitor\'s counter for one hour', async () => {
    const t = setup();
    await t.send(GOOD);
    const [counter] = t.store.keys().filter((key) => key.startsWith('rl:'));
    expect(t.store.secondsLeft('order:token1')).toBe(ORDER_RECORD_LIFETIME_DAYS * 24 * 60 * 60);
    expect(t.store.secondsLeft(counter)).toBe(60 * 60);
    expect(t.store.secondsLeft('idem:attempt-1')).toBe(ORDER_RECORD_LIFETIME_DAYS * 24 * 60 * 60);
  });

  it('gives a different order number and token to two different orders', async () => {
    const t = setup();
    await t.send(GOOD);
    await t.send({ ...GOOD, idempotencyKey: 'attempt-2' });
    expect(await json(await t.send({ ...GOOD, idempotencyKey: 'attempt-3' }))).toMatchObject({ orderNumber: 'SI-ORDER3', token: 'token3' });
  });
});

describe('a request that is not an order at all', () => {
  it('is turned away with 404 while the store is closed, and nothing is kept', async () => {
    const t = setup({}, {});
    const response = await t.send(GOOD);
    expect(response.status).toBe(404);
    expect(t.store.keys()).toEqual([]);
  });

  it('is turned away with 405 unless it is a POST or a GET, saying which are allowed', async () => {
    const t = setup();
    for (const method of ['PUT', 'DELETE', 'PATCH']) {
      const response = await t.send(GOOD, {}, method);
      expect(response.status, method).toBe(405);
      expect(response.headers.get('allow')).toBe('POST, GET');
    }
    expect(t.store.keys()).toEqual([]);
  });

  it('is turned away with 400 when the body is not a small JSON object, and is not counted', async () => {
    const t = setup();
    for (const body of ['', 'not json', '[1,2]', '"text"', 'null', '5']) {
      const response = await t.send(body);
      expect(response.status, body.slice(0, 20)).toBe(400);
      expect(await json(response)).toEqual({ ok: false, error: 'bad request' });
    }
    expect(t.store.keys()).toEqual([]);
  });

  it('is turned away with 400 when there is no idempotency key, or it is not a short piece of text', async () => {
    const t = setup();
    for (const idempotencyKey of [undefined, '', 5, {}, 'x'.repeat(201)]) {
      const response = await t.send({ ...GOOD, idempotencyKey });
      expect(response.status, String(idempotencyKey).slice(0, 20)).toBe(400);
    }
    expect(t.store.keys()).toEqual([]);
  });
});

describe('the checks that run again on the server', () => {
  it('turn away a bad contact with the same problems checkContact gives, and keep and count nothing', async () => {
    const t = setup();
    const bad = { email: 'not an email', phone: undefined };
    const expected = checkContact(bad);
    const response = await t.send({ ...GOOD, contact: bad });
    expect(response.status).toBe(400);
    expect(expected.ok).toBe(false);
    if (!expected.ok) expect(await json(response)).toEqual({ ok: false, problems: expected.problems });
    expect(t.store.keys()).toEqual([]);
  });

  it('turn away a bad address with the same problems checkAddress gives', async () => {
    const t = setup();
    const bad = { ...SHIPPING_ADDRESS, postalCode: 'not a postal code' };
    const expected = checkAddress(bad);
    const response = await t.send({ ...GOOD, address: bad });
    expect(response.status).toBe(400);
    expect(expected.ok).toBe(false);
    if (!expected.ok) expect(await json(response)).toEqual({ ok: false, problems: expected.problems });
    expect(t.store.keys()).toEqual([]);
  });

  it('checks the contact before the address, so a request bad in both is told about the contact', async () => {
    const t = setup();
    const response = await t.send({ ...GOOD, contact: { email: 'nope' }, address: { ...SHIPPING_ADDRESS, postalCode: 'nope' } });
    const body = (await json(response)) as { problems: { field: string }[] };
    expect(body.problems.every((problem) => problem.field === 'email' || problem.field === 'phone')).toBe(true);
  });
});

describe('the payment summary', () => {
  it('never asks for the card number, its expiry or its security code, only the brand and last four already checked in the browser', async () => {
    const t = setup();
    for (const payment of [{ brand: 'Amex', last4: '4242' }, { brand: 'Visa', last4: '42' }, { brand: 'Visa', last4: 4242 }, {}, undefined]) {
      const response = await t.send({ ...GOOD, payment });
      expect(response.status, JSON.stringify(payment)).toBe(400);
    }
    expect(t.store.keys()).toEqual([]);
  });

  it('accepts the two brands the store\'s test cards use', async () => {
    const t = setup();
    expect((await t.send({ ...GOOD, payment: { brand: 'Visa', last4: '4242' } })).status).toBe(200);
    expect((await t.send({ ...GOOD, idempotencyKey: 'attempt-2', payment: { brand: 'Mastercard', last4: '4444' } })).status).toBe(200);
  });
});

describe('the price, worked out again on the server', () => {
  it('never trusts a total the browser might send: nothing in the request holds one', async () => {
    const t = setup();
    await t.send({ ...GOOD, total: 1 });
    const record = await t.store.readOrder('token1');
    expect(record!.order.total).toBeGreaterThan(0);
  });

  it('turns away a cart line that does not check out, the same problems priceOrder gives', async () => {
    const t = setup();
    const badLines = [{ sku: 'SI-TEE-002', colour: 'Midnight', size: 'XS', quantity: 1 }];
    const expected = priceOrder({ lines: badLines, currency: 'CAD', shippingMethod: 'standard', destination: { country: 'CA', province: 'ON' } });
    const response = await t.send({ ...GOOD, lines: badLines });
    expect(response.status).toBe(400);
    expect(expected.ok).toBe(false);
    if (!expected.ok) expect(await json(response)).toEqual({ ok: false, problems: expected.problems });
  });

  it('turns away an empty cart, an unknown currency and an unknown shipping method', async () => {
    const t = setup();
    expect((await t.send({ ...GOOD, lines: [] })).status).toBe(400);
    expect((await t.send({ ...GOOD, currency: 'JPY' })).status).toBe(400);
    expect((await t.send({ ...GOOD, shippingMethod: 'overnight' })).status).toBe(400);
  });

  it('prices a coupon the same way the review already did, valid, expired or not recognised', async () => {
    const t = setup();
    const valid = await t.send({ ...GOOD, coupon: 'WELCOME10' });
    const record = await t.store.readOrder((await json(valid)).token as string);
    expect(record!.order.discount).toBeGreaterThan(0);
    expect(record!.order.couponStatus).toBe('valid');
  });

  it('takes the destination from the checked address, not from a separate field, so the two can never disagree', async () => {
    const t = setup();
    const response = await t.send({ ...GOOD, address: { ...SHIPPING_ADDRESS, country: 'US', province: 'ON', postalCode: '10001' } });
    expect(response.status).toBe(200);
    const record = await t.store.readOrder('token1');
    expect(record!.address.country).toBe('US');
    expect(record!.address.province).toBeUndefined();
  });
});

describe('idempotency', () => {
  it('answers a repeat of the same attempt with the same order number and token, and places no second order', async () => {
    const t = setup();
    const first = await json(await t.send(GOOD));
    const second = await json(await t.send(GOOD));
    expect(second).toEqual(first);
    expect(t.store.keys().filter((key) => key.startsWith('order:'))).toHaveLength(1);
  });

  it('places a genuinely new order for a different key, even with the same cart', async () => {
    const t = setup();
    const first = await json(await t.send(GOOD));
    const second = await json(await t.send({ ...GOOD, idempotencyKey: 'attempt-2' }));
    expect(second).not.toEqual(first);
    expect(t.store.keys().filter((key) => key.startsWith('order:'))).toHaveLength(2);
  });

  it('does not spend the rate limit again on a repeat of the same attempt', async () => {
    const t = setup();
    await t.send(GOOD);
    for (let n = 0; n < ORDER_ATTEMPTS_PER_HOUR - 1; n += 1) await t.send({ ...GOOD, idempotencyKey: `attempt-${n + 2}` });
    // The eleventh distinct attempt is turned away, but a twelfth repeat of the very first is still answered.
    expect((await t.send({ ...GOOD, idempotencyKey: 'a-brand-new-attempt' })).status).toBe(429);
    expect((await t.send(GOOD)).status).toBe(200);
  });
});

describe('the rate limit', () => {
  it('lets a visitor place ten orders an hour, and asks the eleventh to wait', async () => {
    const t = setup();
    for (let n = 1; n <= ORDER_ATTEMPTS_PER_HOUR; n += 1) {
      expect((await t.send({ ...GOOD, idempotencyKey: `attempt-${n}` })).status, `try ${n}`).toBe(200);
    }
    const eleventh = await t.send({ ...GOOD, idempotencyKey: 'attempt-11' });
    expect(eleventh.status).toBe(429);
    expect(await json(eleventh)).toEqual({ ok: false, error: 'too many attempts' });
  });

  it('is its own counter, apart from the lead form\'s', async () => {
    const t = setup();
    await t.send(GOOD);
    const [counter] = t.store.keys().filter((key) => key.startsWith('rl:'));
    // A visitor's lead-form counter is named without "order" in the hash; this one must differ from that.
    const leadStyleKey = `rl:${createHmac('sha256', SECRET).update(`${ADDRESS}|${Math.floor(t.now() / HOUR)}`).digest('hex')}`;
    expect(counter).not.toBe(leadStyleKey);
  });

  it('counts each visitor separately', async () => {
    const t = setup();
    for (let n = 0; n <= ORDER_ATTEMPTS_PER_HOUR; n += 1) await t.send({ ...GOOD, idempotencyKey: `attempt-${n}` });
    expect((await t.send({ ...GOOD, idempotencyKey: 'one-more' })).status).toBe(429);
    expect((await t.send({ ...GOOD, idempotencyKey: 'from-elsewhere' }, { 'x-forwarded-for': '198.51.100.9' })).status).toBe(200);
  });

  it('starts again when the next hour begins', async () => {
    const t = setup();
    for (let n = 0; n <= ORDER_ATTEMPTS_PER_HOUR; n += 1) await t.send({ ...GOOD, idempotencyKey: `attempt-${n}` });
    expect((await t.send({ ...GOOD, idempotencyKey: 'still-this-hour' })).status).toBe(429);
    t.advance(HOUR);
    expect((await t.send({ ...GOOD, idempotencyKey: 'a-new-hour' })).status).toBe(200);
  });
});

describe('reading an order back, for the thank-you page', () => {
  it('answers the order for a token it was given, and not the payment step\'s own raw card', async () => {
    const t = setup();
    await t.send(GOOD);
    const response = await t.read('token1');
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body).toMatchObject({ ok: true, orderNumber: 'SI-ORDER1', payment: { brand: 'Visa', last4: '4242' } });
    expect(JSON.stringify(body)).not.toContain('securityCode');
  });

  it('answers 404 for a token that was never issued, one that is missing, and one that has expired', async () => {
    const t = setup();
    await t.send(GOOD);
    expect((await t.read('not-a-real-token')).status).toBe(404);
    expect((await t.read(undefined)).status).toBe(404);
    t.advance(ORDER_RECORD_LIFETIME_DAYS * 24 * HOUR + 1000);
    expect((await t.read('token1')).status).toBe(404);
  });

  it('answers as JSON that no shared cache may keep', async () => {
    const t = setup();
    await t.send(GOOD);
    const response = await t.read('token1');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

describe('when the store cannot be reached', () => {
  const broken = (which: 'increment' | 'saveOrder' | 'readIdempotencyKey'): Store => ({
    ...createMemoryStore(),
    [which]: async () => Promise.reject(new Error('the database is down')),
  });

  it('says it could not save, with 503, when the idempotency check cannot be read', async () => {
    const t = setup({ store: broken('readIdempotencyKey') });
    const response = await t.send(GOOD);
    expect(response.status).toBe(503);
    expect(await json(response)).toEqual({ ok: false, error: 'could not save' });
  });

  it('says it could not save, with 503, when the counter cannot be read', async () => {
    const t = setup({ store: broken('increment') });
    const response = await t.send(GOOD);
    expect(response.status).toBe(503);
    expect(await json(response)).toEqual({ ok: false, error: 'could not save' });
  });

  it('says it could not save, and gives no order number or token, when the order cannot be kept', async () => {
    const t = setup({ store: broken('saveOrder') });
    const response = await t.send(GOOD);
    expect(response.status).toBe(503);
    const body = await json(response);
    expect(body).toEqual({ ok: false, error: 'could not save' });
    expect(body).not.toHaveProperty('orderNumber');
    expect(body).not.toHaveProperty('token');
  });

  it('logs only the kind of fault, never anything the shopper typed', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const t = setup({ store: broken('saveOrder') });
    await t.send(GOOD);
    const logged = JSON.stringify(spy.mock.calls);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(logged).toContain('Error');
    for (const secret of ['Liam', 'liam.okafor@example.com', '310 Alder Street', 'the database is down']) expect(logged).not.toContain(secret);
  });
});
