import { describe, expect, it } from 'vitest';
import { fill } from '../../src/engine/fill';

describe('fill', () => {
  it('puts a value into a blank', () => {
    expect(fill('Added {product} to your cart.', { product: 'Logo Tee' })).toBe('Added Logo Tee to your cart.');
  });

  it('fills several blanks, and the same blank more than once', () => {
    expect(fill('Up to {max} of one item, so we stopped at {max}.', { max: 10 })).toBe(
      'Up to 10 of one item, so we stopped at 10.',
    );
    expect(fill('{size} is sold out in {colour}.', { size: 'XL', colour: 'Red' })).toBe('XL is sold out in Red.');
  });

  it('returns text with no blanks as it is', () => {
    expect(fill('Your cart is empty.')).toBe('Your cart is empty.');
  });

  it('leaves braces alone when they do not hold a single name', () => {
    expect(fill('Keep {this thing} and {}.')).toBe('Keep {this thing} and {}.');
  });

  it('does not read a value as a pattern', () => {
    expect(fill('Price {price}', { price: '$&' })).toBe('Price $&');
  });

  it('refuses a blank that was given no value', () => {
    expect(() => fill('Added {product} to your cart.', {})).toThrow('No value was given for {product}');
  });

  it('refuses a value that has no blank', () => {
    expect(() => fill('Your cart is empty.', { product: 'Logo Tee' })).toThrow('There is no blank for {product}');
  });
});
