import { describe, expect, it } from 'vitest';
import { FREE_SHIPPING_FROM_CAD, SHIPPING_METHODS } from '../../src/store/shipping-methods';
import { findShippingMethod, freeShippingProgress, freeShippingRemaining, shippingCost } from '../../src/engine/shipping';

const standard = findShippingMethod('standard')!;
const express = findShippingMethod('express')!;

describe('SHIPPING_METHODS', () => {
  it('offers Standard at $9 and Express at $19, the same everywhere', () => {
    expect(SHIPPING_METHODS.map((method) => [method.id, method.name, method.priceCad])).toEqual([
      ['standard', 'Standard', 900],
      ['express', 'Express', 1900],
    ]);
  });

  it('makes only Standard free, at $100 of items after discount', () => {
    expect(FREE_SHIPPING_FROM_CAD).toBe(10000);
    expect(standard.freeFromCad).toBe(10000);
    expect(express.freeFromCad).toBeUndefined();
  });
});

describe('findShippingMethod', () => {
  it('finds a method by id and returns nothing for an unknown one', () => {
    expect(findShippingMethod('express')?.name).toBe('Express');
    expect(findShippingMethod('overnight')).toBeUndefined();
    expect(findShippingMethod('')).toBeUndefined();
  });
});

describe('shippingCost', () => {
  it('charges Standard below the free-shipping line and nothing at or above it', () => {
    expect(shippingCost(standard, 'CAD', 9999)).toBe(900);
    expect(shippingCost(standard, 'CAD', 10000)).toBe(0);
    expect(shippingCost(standard, 'CAD', 25000)).toBe(0);
  });

  it('always charges Express, whatever the order size', () => {
    expect(shippingCost(express, 'CAD', 500)).toBe(1900);
    expect(shippingCost(express, 'CAD', 100000)).toBe(1900);
  });

  it('converts the price and the free-shipping line into the shopper currency', () => {
    expect(shippingCost(standard, 'USD', 7299)).toBe(657);
    expect(shippingCost(standard, 'USD', 7300)).toBe(0);
    expect(shippingCost(express, 'USD', 100)).toBe(1387);
    expect(shippingCost(standard, 'EUR', 100)).toBe(594);
    expect(shippingCost(standard, 'GBP', 100)).toBe(504);
  });
});

describe('freeShippingRemaining', () => {
  it('says how much more the shopper needs for free Standard shipping', () => {
    expect(freeShippingRemaining('CAD', 9600)).toBe(400);
    expect(freeShippingRemaining('CAD', 0)).toBe(10000);
  });

  it('is zero once the line is reached', () => {
    expect(freeShippingRemaining('CAD', 10000)).toBe(0);
    expect(freeShippingRemaining('CAD', 12345)).toBe(0);
  });

  it('works in the shopper currency', () => {
    // 9600 CAD cents is 7008 USD cents, and the line is 7300.
    expect(freeShippingRemaining('USD', 7008)).toBe(292);
  });
});

describe('freeShippingProgress', () => {
  it('says how far along the way to free Standard shipping the items are, from 0 to 100', () => {
    expect(freeShippingProgress('CAD', 0)).toBe(0);
    expect(freeShippingProgress('CAD', 5000)).toBe(50);
    expect(freeShippingProgress('CAD', 9600)).toBe(96);
  });

  it('is exact and not rounded, so that it never reads 100 for a cart that is still short', () => {
    // 30 cents short of the line is 99.7 percent of the way, which a rounded number would call 100.
    expect(freeShippingProgress('CAD', 9970)).toBe(99.7);
    expect(freeShippingProgress('CAD', 9999)).toBe(99.99);
  });

  it('is 100 exactly at the line, and stops there however far past it the items go', () => {
    expect(freeShippingProgress('CAD', 10000)).toBe(100);
    expect(freeShippingProgress('CAD', 30000)).toBe(100);
  });

  it('is 100 exactly when there is nothing more to add, and never before', () => {
    for (const currency of ['CAD', 'USD', 'EUR', 'GBP'] as const) {
      for (let items = 0; items <= 12000; items += 7) {
        expect(freeShippingProgress(currency, items) === 100, `${currency} ${items}`).toBe(freeShippingRemaining(currency, items) === 0);
      }
    }
  });

  it('works in the shopper currency', () => {
    // The line is 7300 US cents, and 2774 of them is 38 percent of the way.
    expect(freeShippingProgress('USD', 2774)).toBe(38);
  });
});
