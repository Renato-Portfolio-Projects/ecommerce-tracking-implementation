import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from '../../src/tracking/events';
import { OPTIONAL_PARAMS, pushEvent } from '../../src/tracking/push-event';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const FINGERPRINT = 'a68414a03cfb6a8136979bfaa406739eeb4a195a60d8345121b38d1c4038140f';

function layer(): Array<Record<string, unknown>> {
  return globalThis.dataLayer as Array<Record<string, unknown>>;
}

beforeEach(() => {
  globalThis.dataLayer = undefined;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('pushEvent, the basic push', () => {
  it('creates the dataLayer when the page has none, and writes the announcement into it', () => {
    pushEvent('cta_click', { cta_location: 'footer' });
    expect(globalThis.dataLayer).toMatchObject([{ event: 'cta_click', cta_location: 'footer' }]);
  });

  it('adds to a dataLayer that is already there, without replacing it', () => {
    const existing: unknown[] = [{ 'gtm.start': 1 }];
    globalThis.dataLayer = existing;
    pushEvent('cta_click', { cta_location: 'footer' });
    expect(globalThis.dataLayer).toBe(existing);
    expect(existing).toMatchObject([{ 'gtm.start': 1 }, { event: 'cta_click' }]);
  });

  it('gives every announcement its own random event_id', () => {
    pushEvent('cta_click', { cta_location: 'footer' });
    pushEvent('cta_click', { cta_location: 'footer' });
    expect(layer()).toHaveLength(2);
    const [first, second] = layer();
    expect(first.event_id).toMatch(UUID);
    expect(second.event_id).toMatch(UUID);
    expect(first.event_id).not.toBe(second.event_id);
  });

  it('says it was sent, and that nothing was wrong', () => {
    expect(pushEvent('cta_click', { cta_location: 'footer' })).toStrictEqual({
      pushed: true,
      problems: [],
    });
  });
});

describe('pushEvent, shopping announcements', () => {
  const items = [{ item_id: 'SI-TEE-001', item_name: 'Plain Tee', price: 28, quantity: 1 }];

  it('clears the previous ecommerce box first, then puts the shopping details in a new one', () => {
    pushEvent('view_item', { currency: 'CAD', value: 28, items });
    expect(layer()).toHaveLength(2);
    expect(layer()[0]).toStrictEqual({ ecommerce: null });
    expect(layer()[1]).toMatchObject({
      event: 'view_item',
      ecommerce: { currency: 'CAD', value: 28, items },
    });
  });

  it('keeps the shopping details out of the top level of the announcement', () => {
    pushEvent('view_item', { currency: 'CAD', value: 28, items });
    expect(layer()).toHaveLength(2);
    expect(layer()[1]).not.toHaveProperty('currency');
    expect(layer()[1]).not.toHaveProperty('value');
    expect(layer()[1]).not.toHaveProperty('items');
  });

  it('keeps event_id beside the event, outside the ecommerce box', () => {
    pushEvent('view_item', { currency: 'CAD', value: 28, items });
    expect(layer()).toHaveLength(2);
    expect(layer()[1].event_id).toMatch(UUID);
    expect(layer()[1].ecommerce).not.toHaveProperty('event_id');
  });

  it('does not clear or nest anything for an announcement that has no items', () => {
    pushEvent('apply_coupon', { coupon: 'WELCOME10', status: 'success' });
    expect(layer()).toHaveLength(1);
    expect(layer()[0]).toMatchObject({ event: 'apply_coupon', coupon: 'WELCOME10', status: 'success' });
    expect(layer()[0]).not.toHaveProperty('ecommerce');
  });

  it('gives the shopping treatment to every event that lists items, and to no other event', () => {
    for (const event of EVENTS) {
      globalThis.dataLayer = undefined;
      const params = Object.fromEntries(
        event.params
          .filter((param) => param !== 'event_id')
          .map((param) => [
            param,
            param === 'items' ? items : param === 'user_data' ? { sha256_email_address: FINGERPRINT } : 'x',
          ]),
      );
      pushEvent(event.name, params);
      if (event.params.includes('items')) {
        expect(layer(), event.name).toHaveLength(2);
        expect(layer()[0], event.name).toStrictEqual({ ecommerce: null });
        expect(layer()[1], event.name).toHaveProperty('ecommerce.items');
      } else {
        expect(layer(), event.name).toHaveLength(1);
        expect(layer()[0], event.name).not.toHaveProperty('ecommerce');
      }
    }
  });
});

describe('pushEvent, the purchase', () => {
  const purchase = {
    transaction_id: 'SI-ABCD2345',
    currency: 'CAD',
    value: 28,
    tax: 3.64,
    shipping: 9,
    items: [{ item_id: 'SI-TEE-001' }],
    user_data: { sha256_email_address: FINGERPRINT },
  };

  function purchaseIds(): unknown[] {
    return layer()
      .filter((entry) => entry.event === 'purchase')
      .map((entry) => entry.event_id);
  }

  it("makes a purchase's event_id from its order number, so a reload gives the same one", () => {
    pushEvent('purchase', purchase);
    pushEvent('purchase', purchase);
    expect(purchaseIds()).toStrictEqual(['purchase_SI-ABCD2345', 'purchase_SI-ABCD2345']);
  });

  it('gives different orders different event_ids', () => {
    pushEvent('purchase', purchase);
    pushEvent('purchase', { ...purchase, transaction_id: 'SI-WXYZ6789' });
    expect(purchaseIds()).toStrictEqual(['purchase_SI-ABCD2345', 'purchase_SI-WXYZ6789']);
  });

  it('keeps the order number inside the ecommerce box, where GA4 reads it', () => {
    pushEvent('purchase', purchase);
    expect(layer()[1]).toMatchObject({ ecommerce: { transaction_id: 'SI-ABCD2345', value: 28 } });
  });

  it('uses a random event_id when there is no order number to make one from', () => {
    const withoutOrderNumber = Object.fromEntries(
      Object.entries(purchase).filter(([key]) => key !== 'transaction_id'),
    );
    pushEvent('purchase', withoutOrderNumber);
    expect(purchaseIds()).toHaveLength(1);
    expect(purchaseIds()[0]).toMatch(UUID);
  });

  it('uses a random event_id when the order number is empty, and says it is missing', () => {
    const result = pushEvent('purchase', { ...purchase, transaction_id: '' });
    expect(purchaseIds()[0]).toMatch(UUID);
    expect(result.problems.join(' ')).toContain('transaction_id');
  });

  it('gives no other event an event_id made from an order number', () => {
    pushEvent('refund', {
      transaction_id: 'SI-ABCD2345',
      currency: 'CAD',
      value: 28,
      items: [{ item_id: 'SI-TEE-001' }],
    });
    expect(layer()).toHaveLength(2);
    expect(layer()[1].event_id).toMatch(UUID);
  });
});

describe('pushEvent, a broken announcement', () => {
  const items = [{ item_id: 'SI-TEE-001' }];

  it('refuses an event that is not in the tracking plan, and says so', () => {
    const result = pushEvent('add_to_basket', { currency: 'CAD' });
    expect(result.pushed).toBe(false);
    expect(result.problems.join(' ')).toContain('add_to_basket');
    expect(globalThis.dataLayer).toBeUndefined();
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('still sends an announcement that is missing a field, and says which one', () => {
    const result = pushEvent('view_item', { currency: 'CAD', items });
    expect(result.pushed).toBe(true);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toContain('value');
    expect(layer()[1]).toMatchObject({ event: 'view_item', ecommerce: { currency: 'CAD', items } });
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('counts a field that is null or empty as missing, but a zero as present', () => {
    for (const empty of [null, '']) {
      const result = pushEvent('view_item', { currency: 'CAD', value: empty, items });
      expect(result.problems.join(' '), String(empty)).toContain('value');
    }
    const withZero = pushEvent('view_item', { currency: 'CAD', value: 0, items });
    expect(withZero.problems).toStrictEqual([]);
  });

  it('does not call a coupon missing where no code may have been applied', () => {
    const result = pushEvent('begin_checkout', { currency: 'CAD', value: 28, items });
    expect(result.problems).toStrictEqual([]);
  });

  it('does call a coupon missing where the code is always known', () => {
    const result = pushEvent('apply_coupon', { status: 'success' });
    expect(result.problems.join(' ')).toContain('coupon');
  });

  it('leaves out a field the event does not list, and says which', () => {
    const result = pushEvent('cta_click', { cta_location: 'footer', favourite_colour: 'blue' });
    expect(result.pushed).toBe(true);
    expect(layer()[0]).toMatchObject({ event: 'cta_click', cta_location: 'footer' });
    expect(layer()[0]).not.toHaveProperty('favourite_colour');
    expect(result.problems.join(' ')).toContain('favourite_colour');
  });

  it('ignores an event_id passed in, and says so', () => {
    const result = pushEvent('cta_click', { cta_location: 'footer', event_id: 'mine' });
    expect(layer()[0].event_id).toMatch(UUID);
    expect(result.problems.join(' ')).toContain('event_id');
  });

  it('says nothing in the console when nothing is wrong', () => {
    pushEvent('cta_click', { cta_location: 'footer' });
    expect(console.error).not.toHaveBeenCalled();
  });

  it('still sends the announcement when the parameters are not an object, and says so', () => {
    for (const notAnObject of [null, 'footer', 42, ['footer']]) {
      globalThis.dataLayer = undefined;
      const result = pushEvent('cta_click', notAnObject as never);
      expect(result.pushed, String(notAnObject)).toBe(true);
      expect(layer()[0], String(notAnObject)).toMatchObject({ event: 'cta_click' });
      expect(result.problems.join(' '), String(notAnObject)).toContain('parameters');
    }
  });

  it('only excuses fields that the event really lists', () => {
    for (const [name, excused] of Object.entries(OPTIONAL_PARAMS)) {
      const event = EVENTS.find((candidate) => candidate.name === name);
      expect(event, name).toBeDefined();
      for (const param of excused) expect(event?.params, `${name}: ${param}`).toContain(param);
    }
  });
});

describe('pushEvent, personal details', () => {
  const lead = { coupon: 'WELCOME10' };
  const typedEmail = 'maya.tremblay@example.com';

  it('keeps real fingerprints, beside the event', () => {
    const result = pushEvent('generate_lead', {
      ...lead,
      user_data: { sha256_email_address: FINGERPRINT },
    });
    expect(result.problems).toStrictEqual([]);
    expect(layer()[0]).toMatchObject({
      event: 'generate_lead',
      user_data: { sha256_email_address: FINGERPRINT },
    });
  });

  it('keeps user_data beside the event on a purchase, outside the ecommerce box', () => {
    pushEvent('purchase', {
      transaction_id: 'SI-ABCD2345',
      currency: 'CAD',
      value: 28,
      tax: 3.64,
      shipping: 9,
      items: [{ item_id: 'SI-TEE-001' }],
      user_data: { sha256_email_address: FINGERPRINT },
    });
    expect(layer()).toHaveLength(2);
    expect(layer()[1]).toMatchObject({ user_data: { sha256_email_address: FINGERPRINT } });
    expect(layer()[1].ecommerce).not.toHaveProperty('user_data');
  });

  it('strips a clear-text email, but still sends the announcement', () => {
    const result = pushEvent('generate_lead', { ...lead, user_data: { email: typedEmail } });
    expect(result.pushed).toBe(true);
    expect(layer()[0]).toMatchObject({ event: 'generate_lead', coupon: 'WELCOME10' });
    expect(layer()[0]).not.toHaveProperty('user_data');
    expect(result.problems.join(' ')).toContain('email');
  });

  it('strips a real fingerprint under a label that is not one of the two', () => {
    const result = pushEvent('generate_lead', { ...lead, user_data: { email: FINGERPRINT } });
    expect(layer()[0]).not.toHaveProperty('user_data');
    expect(result.problems.join(' ')).toContain('email');
  });

  it('strips what is not a real fingerprint, even under a fingerprint label', () => {
    const notFingerprints = [
      typedEmail,
      '+16505551212',
      FINGERPRINT.slice(1),
      FINGERPRINT.toUpperCase(),
      `${FINGERPRINT}0`,
    ];
    for (const value of notFingerprints) {
      for (const label of ['sha256_email_address', 'sha256_phone_number']) {
        globalThis.dataLayer = undefined;
        const result = pushEvent('generate_lead', { ...lead, user_data: { [label]: value } });
        expect(layer()[0], `${label}: ${value}`).not.toHaveProperty('user_data');
        expect(result.problems.join(' '), `${label}: ${value}`).toContain(label);
      }
    }
  });

  it('never writes, reports or logs the clear-text value it stripped', () => {
    const result = pushEvent('generate_lead', {
      ...lead,
      user_data: { sha256_email_address: typedEmail },
    });
    expect(JSON.stringify(layer())).not.toContain(typedEmail);
    expect(JSON.stringify(result.problems)).not.toContain(typedEmail);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(typedEmail);
  });

  it('keeps the real fingerprint when another part of user_data is bad', () => {
    const result = pushEvent('generate_lead', {
      ...lead,
      user_data: { sha256_email_address: FINGERPRINT, phone: '+16505551212' },
    });
    expect(layer()[0].user_data).toStrictEqual({ sha256_email_address: FINGERPRINT });
    expect(result.problems.join(' ')).toContain('phone');
    expect(result.problems.join(' ')).not.toContain('+16505551212');
  });

  it('strips user_data that is not an object at all', () => {
    const result = pushEvent('generate_lead', { ...lead, user_data: typedEmail });
    expect(JSON.stringify(layer())).not.toContain(typedEmail);
    expect(layer()[0]).not.toHaveProperty('user_data');
    expect(result.problems.join(' ')).toContain('user_data');
  });

  it('keeps fingerprints off every announcement except the ones that list user_data', () => {
    for (const event of EVENTS) {
      globalThis.dataLayer = undefined;
      pushEvent(event.name, { user_data: { sha256_email_address: FINGERPRINT } });
      const written = JSON.stringify(layer());
      if (event.params.includes('user_data')) expect(written, event.name).toContain(FINGERPRINT);
      else expect(written, event.name).not.toContain(FINGERPRINT);
    }
  });
});

describe('pushEvent, when the page will not cooperate', () => {
  it('does not throw when the dataLayer cannot be written to, and says nothing was sent', () => {
    globalThis.dataLayer = Object.freeze([]) as unknown as unknown[];
    let result: ReturnType<typeof pushEvent> | undefined;
    expect(() => {
      result = pushEvent('cta_click', { cta_location: 'footer' });
    }).not.toThrow();
    expect(result?.pushed).toBe(false);
    expect(result?.problems).toHaveLength(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the page has no crypto.randomUUID, as on a page that is not secure', () => {
    vi.stubGlobal('crypto', {});
    let result: ReturnType<typeof pushEvent> | undefined;
    expect(() => {
      result = pushEvent('cta_click', { cta_location: 'footer' });
    }).not.toThrow();
    expect(result?.pushed).toBe(false);
    expect(globalThis.dataLayer).toBeUndefined();
  });
});
