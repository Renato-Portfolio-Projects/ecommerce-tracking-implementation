import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartLine } from '../../src/engine/cart';
import { findProduct, listContextFor } from '../../src/engine/catalog';
import { ORDER_LISTS_KEY, rememberOrderLists, takeOrderLists } from '../../src/tracking/order-lists';

// The note that carries the list each cart line was picked from, from the checkout to the thank-you page, which is a
// separate page load. It lives in the tab's own storage (sessionStorage), and tracking must never break shopping, so
// every way the browser can refuse it is tried here. The tests give the code a stand-in for the browser's storage.

const teesList = listContextFor(findProduct('SI-TEE-002')!);
const pantsList = listContextFor(findProduct('SI-PNT-001')!);

const lines: CartLine[] = [
  { sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity: 2, list: teesList },
  { sku: 'SI-PNT-001', colour: 'Ink', size: '32', quantity: 1, list: pantsList },
  { sku: 'SI-TEE-001', colour: 'Paper', size: 'M', quantity: 1 },
];

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

function stored(storage: ReturnType<typeof standIn>): unknown {
  const raw = storage.data.get(ORDER_LISTS_KEY);
  return raw === undefined ? undefined : JSON.parse(raw);
}

let storage = standIn();

beforeEach(() => {
  storage = standIn();
  vi.stubGlobal('sessionStorage', storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, 'sessionStorage');
});

describe('rememberOrderLists', () => {
  it("writes each line's list under the line's variant SKU, and leaves out a line that has none", () => {
    rememberOrderLists(lines);
    expect(stored(storage)).toStrictEqual({
      'SI-TEE-002-INK-M': { listId: 'tees', listName: 'Tees', index: 2 },
      'SI-PNT-001-INK-32': { listId: 'pants', listName: 'Pants', index: 1 },
    });
  });

  it('writes the three list fields and nothing else', () => {
    const extra = { ...teesList, shopper: 'maya.tremblay@example.com' } as typeof teesList;
    rememberOrderLists([{ sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity: 1, list: extra }]);
    expect(JSON.stringify(stored(storage))).not.toContain('maya');
    expect(JSON.stringify(stored(storage))).not.toContain('shopper');
  });

  it('writes nothing when no line has a list, and clears a note left by an earlier order', () => {
    storage.setItem(ORDER_LISTS_KEY, '{"SI-OLD-001-INK-M":{"listId":"tees","listName":"Tees","index":1}}');
    rememberOrderLists([{ sku: 'SI-TEE-001', colour: 'Paper', size: 'M', quantity: 1 }]);
    expect(storage.data.has(ORDER_LISTS_KEY)).toBe(false);
  });

  it('replaces the note of an earlier order, and does not add to it', () => {
    rememberOrderLists(lines);
    rememberOrderLists([{ sku: 'SI-TEE-002', colour: 'Ink', size: 'L', quantity: 1, list: teesList }]);
    expect(Object.keys(stored(storage) as object)).toStrictEqual(['SI-TEE-002-INK-L']);
  });

  it('does not write a list that is not a real one', () => {
    const bad = { listId: '', listName: 'Tees', index: 2 };
    rememberOrderLists([{ sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity: 1, list: bad }]);
    expect(storage.data.has(ORDER_LISTS_KEY)).toBe(false);
  });

  it('keeps the note in the tab, which is sessionStorage, and not in the browser', () => {
    const local = standIn();
    vi.stubGlobal('localStorage', local);
    rememberOrderLists(lines);
    expect(storage.data.has(ORDER_LISTS_KEY)).toBe(true);
    expect(local.data.size).toBe(0);
  });
});

describe('takeOrderLists', () => {
  it('reads back what was written, and removes it, so a second read finds nothing', () => {
    rememberOrderLists(lines);
    expect(takeOrderLists()).toStrictEqual({
      'SI-TEE-002-INK-M': teesList,
      'SI-PNT-001-INK-32': pantsList,
    });
    expect(storage.data.has(ORDER_LISTS_KEY)).toBe(false);
    expect(takeOrderLists()).toStrictEqual({});
  });

  it('reads an empty note when there is none', () => {
    expect(takeOrderLists()).toStrictEqual({});
  });

  it('drops an entry that is not a real list, and keeps the others', () => {
    storage.setItem(
      ORDER_LISTS_KEY,
      JSON.stringify({
        'SI-TEE-002-INK-M': teesList,
        'SI-TEE-001-PAPER-M': { listId: 5, listName: 'Tees', index: 1 },
        'SI-TEE-003-PAPER-S': { listId: 'tees', listName: 'Tees', index: -1 },
        'SI-PNT-001-INK-32': { listId: 'x'.repeat(41), listName: 'Pants', index: 1 },
        'SI-PNT-002-INK-32': 'tees',
        'SI-PNT-003-INK-32': null,
      }),
    );
    expect(takeOrderLists()).toStrictEqual({ 'SI-TEE-002-INK-M': teesList });
  });

  it('reads an empty note, instead of throwing, from a value that is not JSON or not an object, and removes it', () => {
    for (const raw of ['not json', 'null', '[]', '5', '"tees"', '', '{']) {
      storage.setItem(ORDER_LISTS_KEY, raw);
      expect(takeOrderLists(), JSON.stringify(raw)).toStrictEqual({});
      expect(storage.data.has(ORDER_LISTS_KEY), JSON.stringify(raw)).toBe(false);
    }
  });

  it('does not take the lists of an array of entries for a note', () => {
    storage.setItem(ORDER_LISTS_KEY, JSON.stringify([teesList]));
    expect(takeOrderLists()).toStrictEqual({});
  });

  it('does not let an entry called __proto__ change what the note is made of', () => {
    const list = JSON.stringify(teesList);
    storage.setItem(ORDER_LISTS_KEY, `{"__proto__":${list},"SI-TEE-002-INK-M":${list}}`);
    const lists = takeOrderLists();
    expect(Object.getPrototypeOf(lists)).toBe(Object.prototype);
    expect(Object.keys(lists)).toStrictEqual(['SI-TEE-002-INK-M']);
    expect(lists).not.toHaveProperty('listId');
  });
});

describe('when the browser will not keep it', () => {
  it('writes nothing and does not throw when the storage refuses every call', () => {
    vi.stubGlobal('sessionStorage', refusing());
    expect(() => rememberOrderLists(lines)).not.toThrow();
  });

  it('reads an empty note and does not throw when the storage refuses every call', () => {
    vi.stubGlobal('sessionStorage', refusing());
    expect(takeOrderLists()).toStrictEqual({});
  });

  it('does not throw when merely reaching for the storage is refused, as a browser with storage blocked does', () => {
    Reflect.deleteProperty(globalThis, 'sessionStorage');
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('access is denied for this document');
      },
    });
    expect(() => rememberOrderLists(lines)).not.toThrow();
    expect(takeOrderLists()).toStrictEqual({});
  });

  it('still reads the note when only the removing is refused', () => {
    rememberOrderLists(lines);
    storage.removeItem = () => {
      throw new Error('no');
    };
    expect(takeOrderLists()).toStrictEqual({ 'SI-TEE-002-INK-M': teesList, 'SI-PNT-001-INK-32': pantsList });
  });
});
