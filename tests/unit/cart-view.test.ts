import { describe, expect, it } from 'vitest';
import { addToCart, emptyCart, type Cart } from '../../src/engine/cart';
import { cartView } from '../../src/engine/cart-view';

/** A cart built the same way the store builds one, so every line passes the same checks. */
function cartOf(...items: [string, string, string, number][]): Cart {
  let cart = emptyCart();
  for (const [sku, colour, size, quantity] of items) {
    const result = addToCart(cart, { sku, colour, size, quantity });
    if (!result.ok) throw new Error(result.problem.message);
    cart = result.cart;
  }
  return cart;
}

describe('cartView', () => {
  it('describes an empty cart: nothing in it, nothing to pay, all of the way to go for free shipping', () => {
    const view = cartView(emptyCart(), 'CAD');
    expect(view.empty).toBe(true);
    expect(view.quantity).toBe(0);
    expect(view.lines).toEqual([]);
    expect(view.subtotal).toBe('$0.00');
    expect(view.freeShipping).toEqual({ reached: false, remaining: '$100.00', percent: 0 });
  });

  it('describes a line: what it is, how many, the price of one and the price of all', () => {
    const view = cartView(cartOf(['SI-TEE-002', 'Ink', 'M', 2]), 'CAD');
    expect(view.empty).toBe(false);
    expect(view.quantity).toBe(2);
    expect(view.lines).toEqual([
      {
        key: 'SI-TEE-002-INK-M',
        sku: 'SI-TEE-002',
        slug: 'logo-tee',
        name: 'Logo Tee',
        colour: 'Ink',
        size: 'M',
        variant: 'Ink / M',
        quantity: 2,
        unitPrice: '$38.00',
        compareAtUnitPrice: undefined,
        lineTotal: '$76.00',
      },
    ]);
    expect(view.subtotal).toBe('$76.00');
  });

  it('shows the price before the sale beside a sale price, and only on a sale item', () => {
    const view = cartView(cartOf(['SI-TEE-003', 'Paper', 'S', 1], ['SI-TEE-001', 'Paper', 'S', 1]), 'CAD');
    expect(view.lines.map((line) => [line.name, line.unitPrice, line.compareAtUnitPrice])).toEqual([
      ['Misprint Tee', '$34.00', '$42.00'],
      ['Plain Tee', '$28.00', undefined],
    ]);
  });

  it('keeps the lines in the order they were added and counts every unit for the cart count', () => {
    const view = cartView(cartOf(['SI-PNT-001', 'Ink', '30', 1], ['SI-TEE-001', 'Paper', 'S', 3]), 'CAD');
    expect(view.lines.map((line) => line.name)).toEqual(['Plain Chino', 'Plain Tee']);
    expect(view.quantity).toBe(4);
    expect(view.subtotal).toBe('$180.00');
  });

  it('shows how far the cart is from free shipping, and how far along that is', () => {
    const view = cartView(cartOf(['SI-PNT-001', 'Ink', '30', 1]), 'CAD');
    expect(view.freeShipping).toEqual({ reached: false, remaining: '$4.00', percent: 96 });
  });

  it('reaches free shipping at exactly the line, not only above it', () => {
    // 28 + 38 + 34 is exactly 100.
    const view = cartView(cartOf(['SI-TEE-001', 'Paper', 'S', 1], ['SI-TEE-002', 'Paper', 'S', 1], ['SI-TEE-003', 'Paper', 'S', 1]), 'CAD');
    expect(view.subtotal).toBe('$100.00');
    expect(view.freeShipping).toEqual({ reached: true, remaining: '$0.00', percent: 100 });
  });

  it('stops the progress at 100 percent however far past the line the cart goes', () => {
    const view = cartView(cartOf(['SI-PNT-003', 'Blue', '30', 4]), 'CAD');
    expect(view.freeShipping).toEqual({ reached: true, remaining: '$0.00', percent: 100 });
  });

  it('prices everything in the shopper\'s currency, the free-shipping line included', () => {
    const view = cartView(cartOf(['SI-TEE-002', 'Ink', 'M', 1]), 'USD');
    expect(view.currency).toBe('USD');
    expect(view.lines[0].unitPrice).toBe('US$27.74');
    expect(view.subtotal).toBe('US$27.74');
    // The line is CAD 100, which is US$73.00, so 27.74 of 73.00 is 38 percent.
    expect(view.freeShipping).toEqual({ reached: false, remaining: 'US$45.26', percent: 38 });
  });

  it('converts the price before the sale the same way as the price', () => {
    const view = cartView(cartOf(['SI-TEE-003', 'Paper', 'S', 1]), 'GBP');
    expect(view.lines[0].unitPrice).toBe('£19.04');
    expect(view.lines[0].compareAtUnitPrice).toBe('£23.52');
  });
});
