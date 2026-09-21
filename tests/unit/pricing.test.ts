import { describe, expect, it } from 'vitest';
import { PRODUCTS, isSoldOut } from '../../src/shop/catalog';
import { COUNTRIES, PROVINCES } from '../../src/store/destinations';
import { CURRENCIES } from '../../src/store/currencies';
import { convertFromCad } from '../../src/shop/money';
import {
  checkLine,
  priceItems,
  priceOrder,
  type ItemsInput,
  type OrderInput,
  type PricingProblem,
} from '../../src/shop/pricing';
import { SHIPPING_METHODS } from '../../src/store/shipping-methods';

const logoTee = { sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity: 1 };
const plainChino = { sku: 'SI-PNT-001', colour: 'Ink', size: '32', quantity: 1 };
const plainTee = { sku: 'SI-TEE-001', colour: 'Paper', size: 'M', quantity: 2 };
const misprintTee = { sku: 'SI-TEE-003', colour: 'Paper', size: 'M', quantity: 3 };

const ontario: OrderInput['destination'] = { country: 'CA', province: 'ON' };

function order(overrides: Partial<OrderInput> = {}): OrderInput {
  return {
    lines: [logoTee],
    currency: 'CAD',
    destination: ontario,
    shippingMethod: 'standard',
    ...overrides,
  };
}

function priced(input: OrderInput) {
  const result = priceOrder(input);
  if (!result.ok) throw new Error(`Expected a price, got: ${JSON.stringify(result.problems)}`);
  return result.order;
}

function problemsFor(input: OrderInput): PricingProblem[] {
  const result = priceOrder(input);
  if (result.ok) throw new Error('Expected problems, got a price');
  return result.problems;
}

describe('priceItems', () => {
  it('prices a line and shows how far the shopper is from free shipping', () => {
    const result = priceItems({ lines: [{ ...logoTee, quantity: 2 }], currency: 'CAD' });
    if (!result.ok) throw new Error('Expected a price');
    expect(result.items.lines).toEqual([
      {
        sku: 'SI-TEE-002',
        name: 'Logo Tee',
        category: 'Tees',
        colour: 'Ink',
        size: 'M',
        variant: 'Ink / M',
        variantSku: 'SI-TEE-002-INK-M',
        quantity: 2,
        unitPrice: 3800,
        unitDiscount: 0,
        lineNet: 7600,
      },
    ]);
    expect(result.items.itemsSubtotal).toBe(7600);
    expect(result.items.itemsNet).toBe(7600);
    expect(result.items.freeShippingRemaining).toBe(2400);
    expect(result.items.couponStatus).toBe('none');
  });

  it('applies WELCOME10 as 10% off each unit, rounded to the cent', () => {
    const result = priceItems({ lines: [{ ...logoTee, quantity: 2 }], currency: 'CAD', coupon: 'welcome10' });
    if (!result.ok) throw new Error('Expected a price');
    expect(result.items.lines[0].unitDiscount).toBe(380);
    expect(result.items.lines[0].lineNet).toBe(6840);
    expect(result.items.discount).toBe(760);
    expect(result.items.itemsNet).toBe(6840);
    expect(result.items.couponStatus).toBe('valid');
    expect(result.items.appliedCoupon).toEqual({ code: 'WELCOME10', percentOff: 10 });
  });

  it('rounds a discount to the nearest cent, not down', () => {
    // 2800 CAD cents is 1848 EUR cents, and 10% of that is 184.8 cents.
    const result = priceItems({ lines: [{ ...plainTee, quantity: 1 }], currency: 'EUR', coupon: 'WELCOME10' });
    if (!result.ok) throw new Error('Expected a price');
    expect(result.items.lines[0].unitPrice).toBe(1848);
    expect(result.items.lines[0].unitDiscount).toBe(185);
    expect(result.items.lines[0].lineNet).toBe(1663);
  });

  it('takes the discount off the sale price, and shows the price before the sale', () => {
    const result = priceItems({ lines: [{ ...misprintTee, quantity: 1 }], currency: 'CAD', coupon: 'WELCOME10' });
    if (!result.ok) throw new Error('Expected a price');
    expect(result.items.lines[0].unitPrice).toBe(3400);
    expect(result.items.lines[0].compareAtUnitPrice).toBe(4200);
    expect(result.items.lines[0].unitDiscount).toBe(340);
  });

  it('converts each unit price first, so the lines always add up to the total', () => {
    const result = priceItems({ lines: [{ ...misprintTee, quantity: 3 }], currency: 'USD' });
    if (!result.ok) throw new Error('Expected a price');
    // 3400 CAD cents is 2482 USD cents, and 4200 is 3066.
    expect(result.items.lines[0].unitPrice).toBe(2482);
    expect(result.items.lines[0].compareAtUnitPrice).toBe(3066);
    expect(result.items.lines[0].lineNet).toBe(7446);
    expect(result.items.itemsNet).toBe(7446);
  });

  it('gives a valid empty cart all zeros', () => {
    const result = priceItems({ lines: [], currency: 'CAD' });
    if (!result.ok) throw new Error('Expected a price');
    expect(result.items.itemsNet).toBe(0);
    expect(result.items.freeShippingRemaining).toBe(10000);
  });

  it('gives no discount, and says why, for an expired or invalid code', () => {
    for (const [coupon, status] of [
      ['SPRING20', 'expired'],
      ['BOGUS', 'invalid'],
    ] as const) {
      const result = priceItems({ lines: [logoTee], currency: 'CAD', coupon });
      if (!result.ok) throw new Error('Expected a price');
      expect(result.items.couponStatus, coupon).toBe(status);
      expect(result.items.discount, coupon).toBe(0);
      expect(result.items.appliedCoupon, coupon).toBeUndefined();
    }
  });

  it('reports every problem at once instead of stopping at the first', () => {
    const result = priceItems({
      lines: [
        { sku: 'SI-XXX-000', colour: 'Ink', size: 'M', quantity: 1 },
        { ...logoTee, colour: 'Red' },
        { ...logoTee, size: 'XXL' },
        { sku: 'SI-TEE-003', colour: 'Red', size: 'XL', quantity: 1 },
      ],
      currency: 'CAD',
    });
    if (result.ok) throw new Error('Expected problems');
    expect(result.problems.map((problem) => [problem.code, problem.line])).toEqual([
      ['unknown_product', 0],
      ['unknown_variant', 1],
      ['unknown_variant', 2],
      ['sold_out', 3],
    ]);
  });

  it('refuses a quantity that is not a whole number from 1 to 10', () => {
    for (const quantity of [0, -1, 1.5, 11, Number.NaN]) {
      const result = priceItems({ lines: [{ ...logoTee, quantity }], currency: 'CAD' });
      if (result.ok) throw new Error(`Expected a problem for quantity ${quantity}`);
      expect(result.problems.map((problem) => problem.code), String(quantity)).toEqual([
        'bad_quantity',
      ]);
    }
    const ten = priceItems({ lines: [{ ...logoTee, quantity: 10 }], currency: 'CAD' });
    expect(ten.ok).toBe(true);
  });

  it('refuses a currency the store does not offer', () => {
    const result = priceItems({ lines: [logoTee], currency: 'JPY' });
    if (result.ok) throw new Error('Expected a problem');
    expect(result.problems.map((problem) => problem.code)).toEqual(['unknown_currency']);
  });
});

describe('checkLine', () => {
  it('returns the product for a line that can be sold', () => {
    const result = checkLine(logoTee);
    expect('product' in result && result.product.name).toBe('Logo Tee');
  });

  it('names the product in a problem, so a shopper can tell what is wrong', () => {
    const cases: [Parameters<typeof checkLine>[0], string, string][] = [
      [{ sku: 'SI-XXX-000', colour: 'Ink', size: 'M', quantity: 1 }, 'unknown_product', 'SI-XXX-000 is not a product we sell.'],
      [{ ...logoTee, colour: 'Red' }, 'unknown_variant', 'Logo Tee does not come in Red / M.'],
      [{ ...logoTee, quantity: 11 }, 'bad_quantity', 'Logo Tee: the quantity must be a whole number from 1 to 10.'],
      [{ sku: 'SI-TEE-003', colour: 'Red', size: 'XL', quantity: 1 }, 'sold_out', 'Misprint Tee in Red / XL is sold out.'],
    ];
    for (const [line, code, message] of cases) {
      const result = checkLine(line);
      if (!('problem' in result)) throw new Error(`Expected a problem for ${code}`);
      expect(result.problem, code).toEqual({ code, message });
      expect('line' in result.problem, code).toBe(false);
    }
  });

  it('passes the position of the line along as a number, separate from the words', () => {
    const result = checkLine({ ...logoTee, colour: 'Red' }, 2);
    if (!('problem' in result)) throw new Error('Expected a problem');
    expect(result.problem).toEqual({
      code: 'unknown_variant',
      line: 2,
      message: 'Logo Tee does not come in Red / M.',
    });
  });
});

describe('priceOrder: worked examples', () => {
  it('Logo Tee to Ontario, Standard, in CAD', () => {
    const result = priced(order());
    expect(result.itemsSubtotal).toBe(3800);
    expect(result.discount).toBe(0);
    expect(result.itemsNet).toBe(3800);
    expect(result.shipping).toBe(900);
    expect(result.taxPercent).toBe(13);
    // 13% of (3800 + 900) is 611.
    expect(result.tax).toBe(611);
    expect(result.total).toBe(5311);
  });

  it('adds WELCOME10, and rounds the tax once, on the whole', () => {
    const result = priced(order({ coupon: 'WELCOME10' }));
    expect(result.itemsNet).toBe(3420);
    expect(result.shipping).toBe(900);
    // 13% of (3420 + 900) is 561.6, which rounds to 562.
    expect(result.tax).toBe(562);
    expect(result.total).toBe(4882);
  });

  it('works in USD to Québec', () => {
    const result = priced(
      order({ currency: 'USD', destination: { country: 'CA', province: 'QC' }, coupon: 'WELCOME10' }),
    );
    // 2774 USD cents, less 277 (10% of 27.74, rounded), is 2497.
    expect(result.lines[0].unitPrice).toBe(2774);
    expect(result.lines[0].unitDiscount).toBe(277);
    expect(result.itemsNet).toBe(2497);
    expect(result.shipping).toBe(657);
    // 14.975% of (2497 + 657) is 472.3, which rounds to 472.
    expect(result.tax).toBe(472);
    expect(result.total).toBe(3626);
  });

  it('gives free Standard shipping once the items reach $100, and charges Express anyway', () => {
    const lines = [plainChino, plainTee];
    const standard = priced(order({ lines, destination: { country: 'CA', province: 'AB' } }));
    expect(standard.itemsNet).toBe(15200);
    expect(standard.shipping).toBe(0);
    expect(standard.freeShippingRemaining).toBe(0);
    expect(standard.tax).toBe(760);
    expect(standard.total).toBe(15960);

    const express = priced(
      order({ lines, destination: { country: 'US' }, shippingMethod: 'express' }),
    );
    expect(express.shipping).toBe(1900);
    expect(express.tax).toBe(0);
    expect(express.total).toBe(17100);
  });

  it('lets a coupon pull an order back under the free-shipping line', () => {
    const lines = [misprintTee];
    const without = priced(order({ lines, destination: { country: 'GB' } }));
    expect(without.itemsNet).toBe(10200);
    expect(without.shipping).toBe(0);
    expect(without.total).toBe(12240);

    const withCoupon = priced(order({ lines, destination: { country: 'GB' }, coupon: 'WELCOME10' }));
    expect(withCoupon.discount).toBe(1020);
    expect(withCoupon.itemsNet).toBe(9180);
    expect(withCoupon.freeShippingRemaining).toBe(820);
    expect(withCoupon.shipping).toBe(900);
    expect(withCoupon.tax).toBe(2016);
    expect(withCoupon.total).toBe(12096);
  });

  it('charges nothing for shipping or tax on an empty cart', () => {
    const result = priced(order({ lines: [] }));
    expect(result.shipping).toBe(0);
    expect(result.tax).toBe(0);
    expect(result.total).toBe(0);
  });

  it('reports the shipping method and the tax rate that were used', () => {
    const result = priced(order({ shippingMethod: 'express', destination: { country: 'FR' } }));
    expect(result.shippingMethod).toBe('express');
    expect(result.taxPercent).toBe(21);
  });
});

describe('priceOrder: problems', () => {
  it('refuses a destination the store does not ship to', () => {
    expect(problemsFor(order({ destination: { country: 'JP' } })).map((p) => p.code)).toEqual([
      'unknown_destination',
    ]);
    expect(problemsFor(order({ destination: { country: 'CA' } })).map((p) => p.code)).toEqual([
      'unknown_destination',
    ]);
    expect(
      problemsFor(order({ destination: { country: 'CA', province: 'ZZ' } })).map((p) => p.code),
    ).toEqual(['unknown_destination']);
  });

  it('refuses an unknown shipping method', () => {
    expect(problemsFor(order({ shippingMethod: 'overnight' })).map((p) => p.code)).toEqual([
      'unknown_shipping_method',
    ]);
  });

  it('collects problems from the items, the destination and the shipping method together', () => {
    const codes = problemsFor(
      order({
        lines: [{ ...logoTee, quantity: 0 }],
        destination: { country: 'JP' },
        shippingMethod: 'overnight',
      }),
    ).map((problem) => problem.code);
    expect(codes).toEqual(['bad_quantity', 'unknown_destination', 'unknown_shipping_method']);
  });

  it('describes each problem in plain words', () => {
    const [problem] = problemsFor(order({ lines: [{ ...logoTee, colour: 'Red' }] }));
    expect(problem.message).toBe('Logo Tee does not come in Red / M.');
    expect(problem.line).toBe(0);
  });
});

describe('priceOrder: rules that hold for any order', () => {
  // A small seeded generator, so the "random" orders are the same on every run.
  function seeded(seed: number) {
    let state = seed;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomOrder(next: () => number): OrderInput {
    const pick = <T>(items: T[]): T => items[Math.floor(next() * items.length)];
    const lineCount = 1 + Math.floor(next() * 4);
    const lines: ItemsInput['lines'] = [];
    while (lines.length < lineCount) {
      const product = pick(PRODUCTS);
      const colour = pick(product.colours);
      const size = pick(product.sizes);
      if (isSoldOut(product, colour, size)) continue;
      lines.push({ sku: product.sku, colour, size, quantity: 1 + Math.floor(next() * 10) });
    }
    const country = pick(COUNTRIES);
    return {
      lines,
      currency: pick(CURRENCIES).code,
      coupon: pick([undefined, 'WELCOME10', 'welcome10', 'SPRING20', 'BOGUS']),
      destination: {
        country: country.code,
        province: country.code === 'CA' ? pick(PROVINCES).code : undefined,
      },
      shippingMethod: pick(SHIPPING_METHODS).id,
    };
  }

  it('keeps every amount a whole number of cents and every total consistent', () => {
    const next = seeded(20260920);
    for (let run = 0; run < 500; run += 1) {
      const input = randomOrder(next);
      const result = priced(input);
      const label = JSON.stringify(input);

      const amounts = [
        result.itemsSubtotal,
        result.discount,
        result.itemsNet,
        result.shipping,
        result.tax,
        result.total,
        result.freeShippingRemaining,
        ...result.lines.flatMap((line) => [line.unitPrice, line.unitDiscount, line.lineNet]),
      ];
      for (const amount of amounts) {
        expect(Number.isSafeInteger(amount) && amount >= 0, label).toBe(true);
      }

      let subtotal = 0;
      let discount = 0;
      let net = 0;
      for (const line of result.lines) {
        expect(line.unitDiscount, label).toBeLessThanOrEqual(line.unitPrice);
        expect(line.lineNet, label).toBe((line.unitPrice - line.unitDiscount) * line.quantity);
        subtotal += line.unitPrice * line.quantity;
        discount += line.unitDiscount * line.quantity;
        net += line.lineNet;
      }
      expect(result.itemsSubtotal, label).toBe(subtotal);
      expect(result.discount, label).toBe(discount);
      expect(result.itemsNet, label).toBe(net);
      expect(result.itemsNet, label).toBe(result.itemsSubtotal - result.discount);

      const base = result.itemsNet + result.shipping;
      expect(Math.abs(result.tax - (base * result.taxPercent) / 100), label).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(result.total, label).toBe(result.itemsNet + result.shipping + result.tax);
    }
  });

  it('prices every unit at the catalog price, converted', () => {
    const next = seeded(7);
    for (let run = 0; run < 200; run += 1) {
      const input = randomOrder(next);
      const result = priced(input);
      result.lines.forEach((line, index) => {
        const product = PRODUCTS.find((candidate) => candidate.sku === input.lines[index].sku)!;
        expect(line.unitPrice).toBe(convertFromCad(product.priceCad, result.currency));
      });
    }
  });
});
