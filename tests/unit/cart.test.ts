import { describe, expect, it } from 'vitest';
import { MAX_QUANTITY_PER_LINE, MAX_CART_LINES } from '../../src/store/policy';
import {
  PRODUCTS,
  findProduct,
  isSoldOut,
  listContextFor,
  variantsOf,
} from '../../src/engine/catalog';
import {
  addToCart,
  cartLineKey,
  cartQuantity,
  cartToItemsInput,
  clearCart,
  emptyCart,
  isValidListContext,
  removeFromCart,
  setQuantity,
  type Cart,
} from '../../src/engine/cart';
import { checkLine, priceItems } from '../../src/engine/pricing';

const logoTeeInk = { sku: 'SI-TEE-002', colour: 'Ink', size: 'M' };
const plainChinoInk = { sku: 'SI-PNT-001', colour: 'Ink', size: '32' };
const tees = listContextFor(findProduct('SI-TEE-002')!);
const featured = { listId: 'featured', listName: 'Featured', index: 1 };

/** Adds an item and fails the test if the cart refuses it. */
function added(cart: Cart, item: { sku: string; colour: string; size: string; quantity: number }, list?: typeof tees) {
  const result = addToCart(cart, item, list);
  if (!result.ok) throw new Error(`Expected the item to be added, got: ${JSON.stringify(result.problem)}`);
  return result;
}

describe('emptyCart', () => {
  it('has no lines', () => {
    expect(emptyCart()).toEqual({ lines: [] });
    expect(cartQuantity(emptyCart())).toBe(0);
  });
});

describe('addToCart', () => {
  it('adds a first line, with the list it was picked from', () => {
    const result = added(emptyCart(), { ...logoTeeInk, quantity: 2 }, tees);
    expect(result.cart.lines).toEqual([{ ...logoTeeInk, quantity: 2, list: tees }]);
    expect(result.limitReached).toBe(false);
  });

  it('does not change the cart it was given', () => {
    const before = added(emptyCart(), { ...logoTeeInk, quantity: 1 }, tees).cart;
    const snapshot = JSON.stringify(before);
    added(before, { ...logoTeeInk, quantity: 3 });
    added(before, { ...plainChinoInk, quantity: 1 });
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('merges the same product, colour and size into one line, adding the quantities', () => {
    const first = added(emptyCart(), { ...logoTeeInk, quantity: 2 }, tees).cart;
    const second = added(first, { ...logoTeeInk, quantity: 3 }, tees);
    expect(second.cart.lines).toHaveLength(1);
    expect(second.cart.lines[0].quantity).toBe(5);
    expect(second.limitReached).toBe(false);
  });

  it('keeps the list a line first had, even when it is added again from another list', () => {
    const first = added(emptyCart(), { ...logoTeeInk, quantity: 1 }, tees).cart;
    const second = added(first, { ...logoTeeInk, quantity: 1 }, featured).cart;
    expect(second.lines[0].list).toEqual(tees);
  });

  it('takes the new list when the line had none', () => {
    const first = added(emptyCart(), { ...logoTeeInk, quantity: 1 }).cart;
    expect(first.lines[0].list).toBeUndefined();
    const second = added(first, { ...logoTeeInk, quantity: 1 }, tees).cart;
    expect(second.lines[0].list).toEqual(tees);
  });

  it('keeps a separate line for each colour and size, in the order they were added', () => {
    let cart = added(emptyCart(), { ...logoTeeInk, quantity: 1 }).cart;
    cart = added(cart, { ...logoTeeInk, size: 'L', quantity: 1 }).cart;
    cart = added(cart, { ...plainChinoInk, quantity: 1 }).cart;
    expect(cart.lines.map(cartLineKey)).toEqual([
      'SI-TEE-002-INK-M',
      'SI-TEE-002-INK-L',
      'SI-PNT-001-INK-32',
    ]);
  });

  it('stops at ten of one item and says the limit was reached', () => {
    const first = added(emptyCart(), { ...logoTeeInk, quantity: 8 }).cart;
    const second = added(first, { ...logoTeeInk, quantity: 5 });
    expect(second.cart.lines[0].quantity).toBe(MAX_QUANTITY_PER_LINE);
    expect(second.limitReached).toBe(true);

    const third = added(second.cart, { ...logoTeeInk, quantity: 1 });
    expect(third.cart.lines[0].quantity).toBe(MAX_QUANTITY_PER_LINE);
    expect(third.limitReached).toBe(true);
  });

  it('refuses an item that cannot be sold, in plain words', () => {
    const cases: [ReturnType<typeof addToCart>, string, string][] = [
      [
        addToCart(emptyCart(), { sku: 'SI-XXX-000', colour: 'Ink', size: 'M', quantity: 1 }),
        'unknown_product',
        'SI-XXX-000 is not a product we sell.',
      ],
      [
        addToCart(emptyCart(), { ...logoTeeInk, colour: 'Red', quantity: 1 }),
        'unknown_variant',
        'Logo Tee does not come in Red / M.',
      ],
      [
        addToCart(emptyCart(), { sku: 'SI-TEE-003', colour: 'Red', size: 'XL', quantity: 1 }),
        'sold_out',
        'Misprint Tee in Red / XL is sold out.',
      ],
    ];
    for (const [result, code, message] of cases) {
      if (result.ok) throw new Error(`Expected a refusal for ${code}`);
      expect(result.problem).toEqual({ code, message });
    }
  });

  it('refuses a quantity that is not a whole number from 1 to 10', () => {
    for (const quantity of [0, -1, 1.5, 11, Number.NaN]) {
      const result = addToCart(emptyCart(), { ...logoTeeInk, quantity });
      if (result.ok) throw new Error(`Expected a refusal for quantity ${quantity}`);
      expect(result.problem.code, String(quantity)).toBe('bad_quantity');
    }
  });

  it('refuses a new line when the cart already holds the most it can, but still adds to an existing line', () => {
    const variants = PRODUCTS.flatMap((product) =>
      variantsOf(product)
        .filter((variant) => !isSoldOut(product, variant.colour, variant.size))
        .map((variant) => ({ sku: product.sku, colour: variant.colour, size: variant.size })),
    );
    let cart = emptyCart();
    for (const variant of variants.slice(0, MAX_CART_LINES)) {
      cart = added(cart, { ...variant, quantity: 1 }).cart;
    }
    expect(cart.lines).toHaveLength(MAX_CART_LINES);

    const refused = addToCart(cart, { ...variants[MAX_CART_LINES], quantity: 1 });
    if (refused.ok) throw new Error('Expected the cart to be full');
    expect(refused.problem).toEqual({
      code: 'cart_full',
      message: 'Your cart is full: it holds up to 20 different items.',
    });

    const existing = added(cart, { ...variants[0], quantity: 2 });
    expect(existing.cart.lines).toHaveLength(MAX_CART_LINES);
    expect(existing.cart.lines[0].quantity).toBe(3);
  });

  it('refuses a list that does not make sense', () => {
    const bad = [
      { ...tees, index: 0 },
      { ...tees, index: 1.5 },
      { ...tees, index: 101 },
      { ...tees, listId: '' },
      { ...tees, listName: '   ' },
      { ...tees, listId: 'x'.repeat(41) },
      { ...tees, listName: 'x'.repeat(61) },
    ];
    for (const list of bad) {
      const result = addToCart(emptyCart(), { ...logoTeeInk, quantity: 1 }, list);
      if (result.ok) throw new Error(`Expected a refusal for ${JSON.stringify(list)}`);
      expect(result.problem.code).toBe('bad_list');
    }
  });
});

describe('isValidListContext', () => {
  it('accepts a list with an id, a name and a place counting from 1', () => {
    expect(isValidListContext(tees)).toBe(true);
    expect(isValidListContext(featured)).toBe(true);
  });

  it('rejects anything else, including things that are not lists at all', () => {
    for (const value of [null, undefined, 'tees', 7, [], {}, { listId: 'a', listName: 'b' }]) {
      expect(isValidListContext(value), JSON.stringify(value)).toBe(false);
    }
    expect(isValidListContext({ listId: 5, listName: 'b', index: 1 })).toBe(false);
  });
});

describe('setQuantity', () => {
  const start = added(added(emptyCart(), { ...logoTeeInk, quantity: 2 }, tees).cart, {
    ...plainChinoInk,
    quantity: 1,
  }).cart;

  it('sets the quantity of one line', () => {
    const result = setQuantity(start, logoTeeInk, 6);
    if (!result.ok) throw new Error('Expected a change');
    expect(result.cart.lines[0]).toEqual({ ...logoTeeInk, quantity: 6, list: tees });
    expect(result.cart.lines[1].quantity).toBe(1);
    expect(result.limitReached).toBe(false);
  });

  it('removes the line when the quantity is zero or less', () => {
    for (const quantity of [0, -3]) {
      const result = setQuantity(start, logoTeeInk, quantity);
      if (!result.ok) throw new Error('Expected a change');
      expect(result.cart.lines.map(cartLineKey), String(quantity)).toEqual(['SI-PNT-001-INK-32']);
    }
  });

  it('stops at ten and says the limit was reached', () => {
    const result = setQuantity(start, logoTeeInk, 15);
    if (!result.ok) throw new Error('Expected a change');
    expect(result.cart.lines[0].quantity).toBe(MAX_QUANTITY_PER_LINE);
    expect(result.limitReached).toBe(true);
  });

  it('refuses a quantity that is not a whole number', () => {
    for (const quantity of [1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = setQuantity(start, logoTeeInk, quantity);
      if (result.ok) throw new Error(`Expected a refusal for ${quantity}`);
      expect(result.problem.code, String(quantity)).toBe('bad_quantity');
    }
  });

  it('leaves the cart alone when the line is not in it', () => {
    const result = setQuantity(start, { sku: 'SI-TEE-001', colour: 'Ink', size: 'S' }, 4);
    if (!result.ok) throw new Error('Expected no change');
    expect(result.cart).toEqual(start);
  });
});

describe('removeFromCart, clearCart and cartQuantity', () => {
  const cart = added(added(emptyCart(), { ...logoTeeInk, quantity: 2 }).cart, {
    ...plainChinoInk,
    quantity: 3,
  }).cart;

  it('removes one line and leaves the rest', () => {
    expect(removeFromCart(cart, logoTeeInk).lines.map(cartLineKey)).toEqual(['SI-PNT-001-INK-32']);
  });

  it('does nothing when the line is not in the cart', () => {
    expect(removeFromCart(cart, { sku: 'SI-TEE-001', colour: 'Ink', size: 'S' })).toEqual(cart);
  });

  it('empties the cart', () => {
    expect(clearCart()).toEqual({ lines: [] });
  });

  it('counts the units across all lines', () => {
    expect(cartQuantity(cart)).toBe(5);
  });
});

describe('cartToItemsInput', () => {
  const cart = added(added(emptyCart(), { ...logoTeeInk, quantity: 2 }, tees).cart, {
    ...plainChinoInk,
    quantity: 1,
  }).cart;

  it('hands the pricing code only what it needs: the SKU, colour, size and quantity of each line', () => {
    expect(cartToItemsInput(cart, 'CAD')).toEqual({
      lines: [
        { sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity: 2 },
        { sku: 'SI-PNT-001', colour: 'Ink', size: '32', quantity: 1 },
      ],
      currency: 'CAD',
    });
  });

  it('includes the coupon only when there is one', () => {
    expect(cartToItemsInput(cart, 'USD', 'welcome10')).toMatchObject({
      currency: 'USD',
      coupon: 'welcome10',
    });
    expect('coupon' in cartToItemsInput(cart, 'USD')).toBe(false);
  });

  it('prices end to end: a cart goes in, priced items come out', () => {
    const result = priceItems(cartToItemsInput(cart, 'CAD'));
    if (!result.ok) throw new Error('Expected a price');
    // 2 Logo Tees at $38.00 and 1 Plain Chino at $96.00.
    expect(result.items.itemsSubtotal).toBe(17200);
  });
});

describe('cart rules that hold after any sequence of actions', () => {
  // A small seeded generator, so the "random" sequences are the same on every run.
  function seeded(seed: number) {
    let state = seed;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function checkRules(cart: Cart, label: string) {
    expect(cart.lines.length, label).toBeLessThanOrEqual(MAX_CART_LINES);
    const keys = cart.lines.map(cartLineKey);
    expect(new Set(keys).size, label).toBe(keys.length);
    for (const line of cart.lines) {
      expect(
        Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= MAX_QUANTITY_PER_LINE,
        label,
      ).toBe(true);
      expect('product' in checkLine(line), label).toBe(true);
      if (line.list) expect(isValidListContext(line.list), label).toBe(true);
    }
  }

  it('never breaks a rule, however many items are added, changed and removed', () => {
    const next = seeded(20260920);
    const pick = <T>(items: T[]): T => items[Math.floor(next() * items.length)];
    let cartFullSeen = 0;
    let limitSeen = 0;

    for (let run = 0; run < 300; run += 1) {
      let cart = emptyCart();
      for (let step = 0; step < 80; step += 1) {
        const roll = next();
        if (roll < 0.65) {
          const product = pick(PRODUCTS);
          const item = {
            sku: product.sku,
            colour: pick(product.colours),
            size: pick(product.sizes),
            quantity: pick([1, 1, 2, 3, 5, 9, 10, 0, 11, -1]),
          };
          const result = addToCart(cart, item, next() < 0.5 ? listContextFor(product) : undefined);
          if (result.ok) {
            cart = result.cart;
            if (result.limitReached) limitSeen += 1;
          } else if (result.problem.code === 'cart_full') {
            cartFullSeen += 1;
          }
        } else if (roll < 0.85 && cart.lines.length > 0) {
          const result = setQuantity(cart, pick(cart.lines), pick([0, 1, 4, 10, 15, -2]));
          if (result.ok) cart = result.cart;
        } else if (cart.lines.length > 0) {
          cart = removeFromCart(cart, pick(cart.lines));
        }
        checkRules(cart, `run ${run}, step ${step}`);
      }
    }

    // The random runs must actually reach the two limits, or they prove nothing about them.
    expect(cartFullSeen).toBeGreaterThan(0);
    expect(limitSeen).toBeGreaterThan(0);
  });
});
