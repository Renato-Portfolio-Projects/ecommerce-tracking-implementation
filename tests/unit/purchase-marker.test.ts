import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PURCHASES_ANNOUNCED_KEY,
  REMEMBERED_AT_MOST,
  REMEMBERED_FOR_MS,
  rememberAnnounced,
  wasAnnounced,
} from '../../src/tracking/purchase-marker';

// The marker that says which orders this browser has already announced, so that a thank-you page that is reloaded, or
// opened again from the link, does not announce the same purchase twice. A real purchase must never be lost to a storage
// setting, so when the browser will not say, the answer is "not announced yet". The tests give the code a stand-in for
// the browser's storage, and a time they choose.

const DAY = 24 * 60 * 60 * 1000;
const start = Date.UTC(2026, 10, 18, 12);
const ORDER = 'SI-AAAA1111';

function standIn(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
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

function stored(storage: ReturnType<typeof standIn>): Array<{ order: unknown; at: unknown }> {
  return JSON.parse(storage.data.get(PURCHASES_ANNOUNCED_KEY) ?? '[]');
}

let storage = standIn();

beforeEach(() => {
  storage = standIn();
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('wasAnnounced and rememberAnnounced', () => {
  it('says an order has not been announced until it is remembered, and then that it has', () => {
    expect(wasAnnounced(ORDER, start)).toBe(false);
    rememberAnnounced(ORDER, start);
    expect(wasAnnounced(ORDER, start)).toBe(true);
    expect(wasAnnounced('SI-BBBB2222', start)).toBe(false);
  });

  it('tells orders apart exactly, so one number is never taken for another', () => {
    rememberAnnounced(ORDER, start);
    expect(wasAnnounced('si-aaaa1111', start)).toBe(false);
    expect(wasAnnounced(`${ORDER} `, start)).toBe(false);
    expect(wasAnnounced('SI-AAAA111', start)).toBe(false);
  });

  it('keeps the orders it already has when it adds one', () => {
    rememberAnnounced(ORDER, start);
    rememberAnnounced('SI-BBBB2222', start + 1000);
    expect(wasAnnounced(ORDER, start + 2000)).toBe(true);
    expect(wasAnnounced('SI-BBBB2222', start + 2000)).toBe(true);
  });

  it('keeps one entry for an order that is remembered twice', () => {
    rememberAnnounced(ORDER, start);
    rememberAnnounced(ORDER, start + 1000);
    expect(stored(storage)).toStrictEqual([{ order: ORDER, at: start + 1000 }]);
  });

  it('writes only the order number and the time, and nothing about the shopper', () => {
    rememberAnnounced(ORDER, start);
    expect(stored(storage)).toStrictEqual([{ order: ORDER, at: start }]);
  });

  it('keeps the marker in the browser, which is localStorage, so a second tab and a later visit see it', () => {
    const tab = standIn();
    vi.stubGlobal('sessionStorage', tab);
    rememberAnnounced(ORDER, start);
    expect(storage.data.has(PURCHASES_ANNOUNCED_KEY)).toBe(true);
    expect(tab.data.size).toBe(0);
  });

  it('remembers an order for 7 days, the life of an order link, and not a moment longer', () => {
    expect(REMEMBERED_FOR_MS).toBe(7 * DAY);
    rememberAnnounced(ORDER, start);
    expect(wasAnnounced(ORDER, start + 7 * DAY - 1)).toBe(true);
    expect(wasAnnounced(ORDER, start + 7 * DAY)).toBe(false);
    expect(wasAnnounced(ORDER, start + 30 * DAY)).toBe(false);
  });

  it('drops the orders that are forgotten from the storage the next time it writes, so the marker does not grow', () => {
    rememberAnnounced('SI-OLDX0001', start);
    rememberAnnounced('SI-NEWX0002', start + 8 * DAY);
    expect(stored(storage).map((entry) => entry.order)).toStrictEqual(['SI-NEWX0002']);
  });

  it('keeps at most 50 orders, and the newest ones', () => {
    expect(REMEMBERED_AT_MOST).toBe(50);
    const numbers = Array.from({ length: 60 }, (_, index) => `SI-${String(index).padStart(8, '0')}`);
    numbers.forEach((order, index) => rememberAnnounced(order, start + index * 1000));
    expect(stored(storage)).toHaveLength(50);
    const now = start + 60 * 1000;
    expect(numbers.slice(0, 10).some((order) => wasAnnounced(order, now))).toBe(false);
    expect(numbers.slice(10).every((order) => wasAnnounced(order, now))).toBe(true);
  });

  it('remembers nothing, and finds nothing, for a blank order number', () => {
    rememberAnnounced('', start);
    rememberAnnounced('   ', start);
    expect(storage.data.has(PURCHASES_ANNOUNCED_KEY)).toBe(false);
    expect(wasAnnounced('', start)).toBe(false);
    expect(wasAnnounced('   ', start)).toBe(false);
  });
});

describe('a stored value that is damaged', () => {
  const now = start + 1000;

  it('is ignored, so the order counts as not announced', () => {
    const damaged = [
      'not json',
      '',
      '{',
      'null',
      '5',
      '"x"',
      '{}',
      JSON.stringify({ order: ORDER, at: start }),
      JSON.stringify([1, 2]),
      JSON.stringify([{ order: 5, at: start }]),
      JSON.stringify([{ order: ORDER }]),
      JSON.stringify([{ order: ORDER, at: 'yesterday' }]),
      JSON.stringify([{ order: ORDER, at: null }]),
      JSON.stringify([{ order: '', at: start }]),
      `[{"order":"${ORDER}","at":1e999}]`,
    ];
    for (const raw of damaged) {
      storage.setItem(PURCHASES_ANNOUNCED_KEY, raw);
      expect(wasAnnounced(ORDER, now), raw).toBe(false);
    }
  });

  it('is written over with good data the next time an order is remembered', () => {
    storage.setItem(PURCHASES_ANNOUNCED_KEY, 'not json');
    rememberAnnounced(ORDER, start);
    expect(stored(storage)).toStrictEqual([{ order: ORDER, at: start }]);
  });

  it('loses only the bad entries of a list that is partly good', () => {
    storage.setItem(
      PURCHASES_ANNOUNCED_KEY,
      JSON.stringify([
        { order: ORDER, at: start },
        5,
        { order: 'SI-BBBB2222' },
        null,
        { order: 'SI-CCCC3333', at: 'x' },
        { order: '', at: start },
        { order: 7, at: start },
      ]),
    );
    expect(wasAnnounced(ORDER, now)).toBe(true);
    rememberAnnounced('SI-DDDD4444', now);
    expect(stored(storage).map((entry) => entry.order)).toStrictEqual([ORDER, 'SI-DDDD4444']);
  });
});

describe('when the browser will not keep it', () => {
  it('says "not announced yet" when the storage refuses every call, so the purchase is announced anyway', () => {
    vi.stubGlobal('localStorage', refusing());
    expect(wasAnnounced(ORDER, start)).toBe(false);
  });

  it('does not throw when the storage refuses every call', () => {
    vi.stubGlobal('localStorage', refusing());
    expect(() => rememberAnnounced(ORDER, start)).not.toThrow();
  });

  it('does not throw, and says "not announced yet", when merely reaching for the storage is refused', () => {
    Reflect.deleteProperty(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('access is denied for this document');
      },
    });
    expect(wasAnnounced(ORDER, start)).toBe(false);
    expect(() => rememberAnnounced(ORDER, start)).not.toThrow();
  });

  it('says "not announced yet" when the storage can be written but not read', () => {
    rememberAnnounced(ORDER, start);
    storage.getItem = () => {
      throw new Error('no');
    };
    expect(wasAnnounced(ORDER, start)).toBe(false);
  });
});
