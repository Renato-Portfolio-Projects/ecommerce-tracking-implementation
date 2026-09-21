import { describe, expect, it } from 'vitest';
import { PRODUCTS, findProduct, isSoldOut, listContextFor, variantsOf } from '../../src/shop/catalog';
import { MAX_CART_LINES, addToCart, emptyCart, type Cart } from '../../src/shop/cart';
import { CART_LIFETIME_DAYS, parseStoredCart, serializeCart } from '../../src/shop/cart-storage';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 8, 20, 12, 0, 0);
const tees = listContextFor(findProduct('SI-TEE-002')!);
const logoTeeInk = { sku: 'SI-TEE-002', colour: 'Ink', size: 'M' };

/** Builds a cart by adding items, and fails the test if the cart refuses one. */
function cartOf(...items: { sku: string; colour: string; size: string; quantity: number }[]): Cart {
  let cart = emptyCart();
  for (const item of items) {
    const result = addToCart(cart, item, tees);
    if (!result.ok) throw new Error(`Could not build the cart: ${JSON.stringify(result.problem)}`);
    cart = result.cart;
  }
  return cart;
}

/** The text a browser would hold for a saved cart. */
function saved(lines: unknown[], savedAt = now): string {
  return JSON.stringify({ version: 1, savedAt, lines });
}

describe('CART_LIFETIME_DAYS', () => {
  it('is seven', () => {
    expect(CART_LIFETIME_DAYS).toBe(7);
  });
});

describe('serializeCart', () => {
  const cart = cartOf({ ...logoTeeInk, quantity: 2 }, { sku: 'SI-PNT-001', colour: 'Ink', size: '32', quantity: 1 });

  it('writes the version, the time and each line, and nothing else', () => {
    expect(JSON.parse(serializeCart(cart, now))).toEqual({
      version: 1,
      savedAt: now,
      lines: [
        { ...logoTeeInk, quantity: 2, list: tees },
        { sku: 'SI-PNT-001', colour: 'Ink', size: '32', quantity: 1, list: tees },
      ],
    });
  });

  it('never writes a price, a product name or any other detail of a product', () => {
    const data = JSON.parse(serializeCart(cart, now));
    expect(Object.keys(data)).toEqual(['version', 'savedAt', 'lines']);
    for (const line of data.lines) {
      expect(Object.keys(line).sort()).toEqual(['colour', 'list', 'quantity', 'size', 'sku']);
      expect(Object.keys(line.list).sort()).toEqual(['index', 'listId', 'listName']);
    }
  });

  it('leaves out anything extra that was carried on a line', () => {
    const untidy = { lines: [{ ...cart.lines[0], unitPrice: 999, name: 'Logo Tee' }] } as unknown as Cart;
    const data = JSON.parse(serializeCart(untidy, now));
    expect(Object.keys(data.lines[0]).sort()).toEqual(['colour', 'list', 'quantity', 'size', 'sku']);
  });

  it('writes an empty cart as a cart with no lines', () => {
    expect(JSON.parse(serializeCart(emptyCart(), now)).lines).toEqual([]);
  });
});

describe('parseStoredCart', () => {
  it('gives back the same cart that was saved', () => {
    const cart = cartOf({ ...logoTeeInk, quantity: 2 }, { sku: 'SI-PNT-001', colour: 'Ink', size: '32', quantity: 4 });
    const result = parseStoredCart(serializeCart(cart, now), now);
    expect(result.cart).toEqual(cart);
    expect(result.dropped).toEqual([]);
  });

  it('gives an empty cart when nothing was saved', () => {
    for (const raw of [null, undefined, '']) {
      const result = parseStoredCart(raw, now);
      expect(result, String(raw)).toEqual({ cart: emptyCart(), dropped: [] });
    }
  });

  it('gives an empty cart when the saved text makes no sense', () => {
    const damaged = [
      'not json',
      '{}',
      '[]',
      'null',
      '42',
      JSON.stringify({ version: 2, savedAt: now, lines: [] }),
      JSON.stringify({ version: 1, savedAt: 'yesterday', lines: [] }),
      JSON.stringify({ version: 1, savedAt: null, lines: [] }),
      JSON.stringify({ version: 1, savedAt: now, lines: 'none' }),
    ];
    for (const raw of damaged) {
      const result = parseStoredCart(raw, now);
      expect(result, raw).toEqual({ cart: emptyCart(), dropped: [] });
    }
  });

  it('keeps a cart for seven days from when it was last saved, and not a moment longer', () => {
    const cart = cartOf({ ...logoTeeInk, quantity: 1 });
    const raw = serializeCart(cart, now);
    expect(parseStoredCart(raw, now + 6 * DAY).cart).toEqual(cart);
    expect(parseStoredCart(raw, now + 7 * DAY).cart).toEqual(cart);
    expect(parseStoredCart(raw, now + 7 * DAY + 1).cart).toEqual(emptyCart());
  });

  it('drops a line that can no longer be sold, and says why', () => {
    const result = parseStoredCart(
      saved([
        { ...logoTeeInk, quantity: 1 },
        { sku: 'SI-OLD-001', colour: 'Ink', size: 'M', quantity: 1 },
        { sku: 'SI-TEE-003', colour: 'Red', size: 'XL', quantity: 2 },
      ]),
      now,
    );
    expect(result.cart.lines).toHaveLength(1);
    expect(result.dropped.map((entry) => [entry.line.sku, entry.problem.code, entry.problem.message])).toEqual([
      ['SI-OLD-001', 'unknown_product', 'SI-OLD-001 is not a product we sell.'],
      ['SI-TEE-003', 'sold_out', 'Misprint Tee in Red / XL is sold out.'],
    ]);
  });

  it('drops a line whose quantity is outside 1 to 10', () => {
    const result = parseStoredCart(saved([{ ...logoTeeInk, quantity: 15 }]), now);
    expect(result.cart.lines).toEqual([]);
    expect(result.dropped[0].problem.code).toBe('bad_quantity');
  });

  it('merges lines for the same colour and size that were saved twice', () => {
    const result = parseStoredCart(
      saved([
        { ...logoTeeInk, quantity: 4 },
        { ...logoTeeInk, quantity: 3 },
      ]),
      now,
    );
    expect(result.cart.lines).toHaveLength(1);
    expect(result.cart.lines[0].quantity).toBe(7);
  });

  it('keeps no more lines than a cart may hold, and says which were dropped', () => {
    const lines = PRODUCTS.flatMap((product) =>
      variantsOf(product)
        .filter((variant) => !isSoldOut(product, variant.colour, variant.size))
        .map((variant) => ({ sku: product.sku, colour: variant.colour, size: variant.size, quantity: 1 })),
    ).slice(0, MAX_CART_LINES + 2);
    const result = parseStoredCart(saved(lines), now);
    expect(result.cart.lines).toHaveLength(MAX_CART_LINES);
    expect(result.dropped.map((entry) => entry.problem.code)).toEqual(['cart_full', 'cart_full']);
  });

  it('keeps a line but forgets a list that does not make sense', () => {
    const result = parseStoredCart(
      saved([{ ...logoTeeInk, quantity: 1, list: { listId: 'tees', listName: 'Tees', index: 0 } }]),
      now,
    );
    expect(result.cart.lines).toEqual([{ ...logoTeeInk, quantity: 1 }]);
    expect(result.dropped).toEqual([]);
  });

  it('ignores entries that are not lines at all', () => {
    const result = parseStoredCart(
      saved([null, 5, 'x', {}, { sku: 1 }, { ...logoTeeInk, quantity: '2' }, { ...logoTeeInk, quantity: 2 }]),
      now,
    );
    expect(result.cart.lines).toEqual([{ ...logoTeeInk, quantity: 2 }]);
    expect(result.dropped).toEqual([]);
  });

  it('gives back every cart that was saved, across many random carts', () => {
    // A small seeded generator, so the "random" carts are the same on every run.
    let state = 7;
    const next = () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T>(items: T[]): T => items[Math.floor(next() * items.length)];

    for (let run = 0; run < 200; run += 1) {
      let cart = emptyCart();
      const adds = 1 + Math.floor(next() * 25);
      for (let step = 0; step < adds; step += 1) {
        const product = pick(PRODUCTS);
        const item = {
          sku: product.sku,
          colour: pick(product.colours),
          size: pick(product.sizes),
          quantity: pick([1, 2, 3, 5, 10]),
        };
        const result = addToCart(cart, item, next() < 0.5 ? listContextFor(product) : undefined);
        if (result.ok) cart = result.cart;
      }
      const result = parseStoredCart(serializeCart(cart, now), now);
      expect(result.cart, `run ${run}`).toEqual(cart);
      expect(result.dropped, `run ${run}`).toEqual([]);
    }
  });
});
