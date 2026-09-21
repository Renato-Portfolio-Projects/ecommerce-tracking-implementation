import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MAX_QUANTITY_PER_LINE,
  PRODUCTS,
  findCollection,
  variantLabel,
  variantSku,
  variantsOf,
} from '../../src/shop/catalog';
import { MAX_CART_LINES } from '../../src/shop/cart';
import { CART_LIFETIME_DAYS } from '../../src/shop/cart-storage';
import { COUPONS } from '../../src/shop/coupons';
import { COUNTRIES, PROVINCES } from '../../src/shop/destinations';
import {
  CURRENCIES,
  EURO_AREA_COUNTRIES,
  defaultCurrencyFor,
  formatMoney,
} from '../../src/shop/money';
import { SHIPPING_METHODS } from '../../src/shop/shipping';
import { tableUnderHeading } from '../helpers/markdown';

const rules = readFileSync(new URL('../../docs/shop-rules.md', import.meta.url), 'utf8');
const trackingPlan = readFileSync(new URL('../../docs/tracking-plan.md', import.meta.url), 'utf8');
const cad = (cents: number) => formatMoney(cents, 'CAD');

describe('docs/shop-rules.md', () => {
  it('lists the currencies and demo rates the way the code does', () => {
    expect(tableUnderHeading(rules, '## Currencies')).toEqual(
      CURRENCIES.map((currency) => [currency.code, currency.name, String(currency.rate)]),
    );
  });

  it('lists the products, their prices, colours, sizes and sold-out variants the way the code does', () => {
    expect(tableUnderHeading(rules, '## Products')).toEqual(
      PRODUCTS.map((product) => [
        product.sku,
        product.name,
        findCollection(product.collection)!.name,
        cad(product.priceCad),
        product.compareAtCad === undefined ? '-' : cad(product.compareAtCad),
        product.colours.join(', '),
        product.sizes.join(', '),
        product.soldOut.length === 0
          ? '-'
          : product.soldOut.map((variant) => variantLabel(variant.colour, variant.size)).join(', '),
      ]),
    );
  });

  it('lists the shipping methods, prices and free-shipping line the way the code does', () => {
    expect(tableUnderHeading(rules, '## Shipping')).toEqual(
      SHIPPING_METHODS.map((method) => [
        method.name,
        cad(method.priceCad),
        method.freeFromCad === undefined
          ? 'Never'
          : `Items after discount reach ${cad(method.freeFromCad)}`,
      ]),
    );
  });

  it('lists the tax rate for every country and province the way the code does', () => {
    expect(tableUnderHeading(rules, '## Tax by country')).toEqual(
      COUNTRIES.map((country) => [
        country.name,
        country.taxPercent === undefined ? 'By province, see below' : `${country.taxPercent}%`,
      ]),
    );
    expect(tableUnderHeading(rules, '## Tax by province')).toEqual(
      PROVINCES.map((province) => [province.name, `${province.taxPercent}%`]),
    );
  });

  it('lists the coupons the way the code does', () => {
    expect(tableUnderHeading(rules, '## Coupons')).toEqual(
      COUPONS.map((coupon) => [
        coupon.code,
        `${coupon.percentOff}% off each item`,
        coupon.expired ? 'Expired' : 'Valid',
      ]),
    );
  });

  it('states the cart limits the way the code does', () => {
    expect(tableUnderHeading(rules, '## Limits')).toEqual([
      ['Most units of one product, colour and size on one cart line', String(MAX_QUANTITY_PER_LINE)],
      ['Most different lines in one cart', String(MAX_CART_LINES)],
      ['How long a saved cart is kept, from its last change', `${CART_LIFETIME_DAYS} days`],
    ]);
  });

  it('lists an example variant SKU and the number of variants for each product the way the code does', () => {
    expect(tableUnderHeading(rules, '## Variant SKUs')).toEqual(
      PRODUCTS.map((product) => [
        product.sku,
        variantSku(product.sku, product.colours[0], product.sizes[0]),
        String(variantsOf(product).length),
      ]),
    );
    const total = PRODUCTS.reduce((sum, product) => sum + variantsOf(product).length, 0);
    expect(rules).toContain(`There are ${total} in all.`);
  });

  it('lists the starting currency for each kind of visitor the way the code does', () => {
    expect(tableUnderHeading(rules, '## Default currency')).toEqual([
      ['Canada', defaultCurrencyFor('CA')],
      ['United States', defaultCurrencyFor('US')],
      ['United Kingdom', defaultCurrencyFor('GB')],
      [`Euro area (${EURO_AREA_COUNTRIES.length} countries)`, defaultCurrencyFor('FR')],
      ['Anywhere else', defaultCurrencyFor('JP')],
    ]);
  });

  it('lists the euro-area countries the way the code does', () => {
    expect(tableUnderHeading(rules, '## Euro area countries')).toEqual(
      EURO_AREA_COUNTRIES.map((country) => [country.code, country.name]),
    );
  });

  it('points every rule to a name that really exists in the file it names', () => {
    const rows = tableUnderHeading(rules, '## Changing a rule');
    expect(rows.length).toBeGreaterThan(0);
    for (const [rule, , where] of rows) {
      const pairs = [...where.matchAll(/`([^`]+)` in `([^`]+)`/g)];
      expect(pairs.length, rule).toBeGreaterThan(0);
      for (const [, name, path] of pairs) {
        const source = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
        expect(source, `${name} in ${path}`).toContain(name);
      }
    }
  });
});

describe('docs/tracking-plan.md, for the values the shop produces', () => {
  it('says which values shipping_tier can take', () => {
    const line = trackingPlan
      .split(/\r?\n/)
      .find((candidate) => candidate.startsWith('- ') && candidate.includes('`shipping_tier`'));
    expect(line).toBeDefined();
    for (const method of SHIPPING_METHODS) {
      expect(line, method.name).toContain(`\`${method.name}\``);
    }
  });

  it("says an item's index counts from 1", () => {
    expect(trackingPlan).toContain("`index` is the item's place in the list, counting from 1");
  });

  it('says the colour-and-size SKU names the exact item but is not the item_id', () => {
    expect(trackingPlan).toContain(`\`${variantSku('SI-TEE-002', 'Ink', 'M')}\``);
    expect(trackingPlan).toContain('is not sent as `item_id`');
  });

  it('says how item_variant is written', () => {
    expect(trackingPlan).toContain(`\`${variantLabel('Ink', 'M')}\``);
  });

  it("says item_id is the product's SKU, the same at every step, not a colour and size SKU", () => {
    expect(trackingPlan).toContain("`item_id` is the product's SKU");
    expect(trackingPlan).toContain('until add to cart');
  });
});
