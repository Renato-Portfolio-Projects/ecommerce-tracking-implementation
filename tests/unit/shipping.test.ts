import { describe, expect, it } from 'vitest';
import { FREE_SHIPPING_FROM_CAD, SHIPPING_METHODS } from '../../src/store/shipping-methods';
import { findShippingMethod, freeShippingRemaining, shippingCost } from '../../src/engine/shipping';

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
