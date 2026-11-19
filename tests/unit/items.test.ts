import { describe, expect, it } from 'vitest';
import { cartToItemsInput, type CartLine } from '../../src/engine/cart';
import { findProduct, listContextFor } from '../../src/engine/catalog';
import { priceItems } from '../../src/engine/pricing';
import { CURRENCIES } from '../../src/store/currencies';
import {
  itemFromTrackable,
  parseTrackable,
  trackableProduct,
  trackedLines,
} from '../../src/tracking/items';

const logoTee = findProduct('SI-TEE-002')!;
const misprintTee = findProduct('SI-TEE-003')!;
const plainChino = findProduct('SI-PNT-001')!;
const teesList = listContextFor(logoTee);

describe('trackableProduct', () => {
  it('describes a product by its SKU, name and collection, with its price in every currency', () => {
    expect(trackableProduct(logoTee)).toStrictEqual({
      item_id: 'SI-TEE-002',
      item_name: 'Logo Tee',
      item_category: 'Tees',
      price: { CAD: 38, USD: 27.74, EUR: 25.08, GBP: 21.28 },
    });
  });

  it('uses the price now, not the price before the sale', () => {
    expect(trackableProduct(misprintTee).price).toStrictEqual({ CAD: 34, USD: 24.82, EUR: 22.44, GBP: 19.04 });
  });

  it('names the collection of a pair of pants', () => {
    expect(trackableProduct(plainChino).item_category).toBe('Pants');
  });
});

describe('itemFromTrackable', () => {
  const trackable = trackableProduct(logoTee);

  it('picks the price in the currency asked for', () => {
    expect(itemFromTrackable(trackable, 'USD')).toStrictEqual({
      item_id: 'SI-TEE-002',
      item_name: 'Logo Tee',
      item_category: 'Tees',
      price: 27.74,
    });
  });

  it('adds the list the product was picked from, with its place counting from 1', () => {
    expect(itemFromTrackable(trackable, 'CAD', teesList)).toStrictEqual({
      item_id: 'SI-TEE-002',
      item_name: 'Logo Tee',
      item_category: 'Tees',
      price: 38,
      item_list_id: 'tees',
      item_list_name: 'Tees',
      index: 2,
    });
  });
});

describe('parseTrackable', () => {
  it('reads what trackableProduct wrote into a page', () => {
    expect(parseTrackable(JSON.stringify(trackableProduct(logoTee)))).toStrictEqual(trackableProduct(logoTee));
  });

  it('gives nothing for data that is missing, damaged or incomplete', () => {
    const good = trackableProduct(logoTee);
    const bad = [
      undefined,
      '',
      'not json',
      'null',
      '[]',
      '{}',
      JSON.stringify({ ...good, item_id: 5 }),
      JSON.stringify({ ...good, price: { CAD: 38 } }),
      JSON.stringify({ ...good, price: { ...good.price, USD: '27.74' } }),
      // 1e999 is valid JSON that reads back as Infinity.
      '{"item_id":"a","item_name":"b","item_category":"c","price":{"CAD":1e999,"USD":1,"EUR":1,"GBP":1}}',
    ];
    for (const raw of bad) expect(parseTrackable(raw), String(raw)).toBeUndefined();
  });
});

describe('trackedLines', () => {
  const line: CartLine = { sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity: 2, list: teesList };

  it('turns cart lines into items with the variant, quantity, price and list, and adds up the value', () => {
    expect(trackedLines([line], 'CAD')).toStrictEqual({
      items: [
        {
          item_id: 'SI-TEE-002',
          item_name: 'Logo Tee',
          item_category: 'Tees',
          item_variant: 'Ink / M',
          price: 38,
          quantity: 2,
          item_list_id: 'tees',
          item_list_name: 'Tees',
          index: 2,
        },
      ],
      value: 76,
    });
  });

  it('prices in the currency asked for', () => {
    const tracked = trackedLines([line], 'EUR');
    expect(tracked.items).toHaveLength(1);
    expect(tracked.items[0].price).toBe(25.08);
    expect(tracked.value).toBe(50.16);
  });

  it('leaves the list out of a line that was not picked from one', () => {
    const { list: _list, ...withoutList } = line;
    expect(trackedLines([withoutList], 'CAD').items[0]).toStrictEqual({
      item_id: 'SI-TEE-002',
      item_name: 'Logo Tee',
      item_category: 'Tees',
      item_variant: 'Ink / M',
      price: 38,
      quantity: 2,
    });
  });

  it('uses the price now on a sale item, not the price before the sale', () => {
    const tracked = trackedLines([{ sku: 'SI-TEE-003', colour: 'Paper', size: 'S', quantity: 1 }], 'USD');
    expect(tracked.items).toHaveLength(1);
    expect(tracked.items[0].price).toBe(24.82);
    expect(tracked.value).toBe(24.82);
  });

  it('adds up several lines into one value, to the cent', () => {
    const tracked = trackedLines(
      [
        { sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity: 3 },
        { sku: 'SI-PNT-001', colour: 'Ink', size: '32', quantity: 1 },
      ],
      'USD',
    );
    // 3 Logo Tees at US$27.74 and 1 Plain Chino at US$70.08.
    expect(tracked.value).toBe(153.3);
  });

  it('gives nothing for no lines', () => {
    expect(trackedLines([], 'CAD')).toStrictEqual({ items: [], value: 0 });
  });

  it('gives nothing, instead of throwing, for a line that cannot be priced', () => {
    const unknown: CartLine = { sku: 'SI-NOT-001', colour: 'Ink', size: 'M', quantity: 1 };
    expect(trackedLines([unknown], 'CAD')).toStrictEqual({ items: [], value: 0 });
  });
});

describe('trackedLines with a discount code', () => {
  const twoTees: CartLine = { sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity: 2, list: teesList };

  it('takes the code off each unit, and the value is what is left, without shipping or tax', () => {
    expect(trackedLines([twoTees], 'CAD', 'WELCOME10')).toStrictEqual({
      items: [
        {
          item_id: 'SI-TEE-002',
          item_name: 'Logo Tee',
          item_category: 'Tees',
          item_variant: 'Ink / M',
          price: 38,
          quantity: 2,
          discount: 3.8,
          item_list_id: 'tees',
          item_list_name: 'Tees',
          index: 2,
        },
      ],
      // 2 x (38.00 - 3.80)
      value: 68.4,
      coupon: 'WELCOME10',
    });
  });

  it('names the code as the store spells it, whatever the case or the spaces it was typed with', () => {
    for (const typed of ['WELCOME10', 'welcome10', '  Welcome10 ']) {
      const tracked = trackedLines([twoTees], 'CAD', typed);
      expect(tracked.coupon, typed).toBe('WELCOME10');
      expect(tracked.value, typed).toBe(68.4);
    }
  });

  it('gives each line its own discount, with the same figures the cart prices, in every currency', () => {
    const lines: CartLine[] = [
      { sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity: 3 },
      { sku: 'SI-PNT-001', colour: 'Ink', size: '32', quantity: 1 },
    ];
    for (const { code } of CURRENCIES) {
      const tracked = trackedLines(lines, code, 'WELCOME10');
      const priced = priceItems(cartToItemsInput({ lines }, code, 'WELCOME10'));
      if (!priced.ok) throw new Error(`could not price the cart in ${code}`);
      expect(tracked.value, code).toBe(priced.items.itemsNet / 100);
      expect(tracked.items.map((item) => item.price), code).toStrictEqual(
        priced.items.lines.map((line) => line.unitPrice / 100),
      );
      expect(tracked.items.map((item) => item.discount), code).toStrictEqual(
        priced.items.lines.map((line) => line.unitDiscount / 100),
      );
      for (const item of tracked.items) expect(item.discount, code).toBeGreaterThan(0);
    }
  });

  it('ignores an expired code, one the store does not know and a blank one, as the cart does', () => {
    for (const typed of ['SPRING20', 'NOPE', '', '   ']) {
      const tracked = trackedLines([twoTees], 'CAD', typed);
      expect(tracked.value, typed).toBe(76);
      expect(tracked.items[0], typed).not.toHaveProperty('discount');
      expect(tracked, typed).not.toHaveProperty('coupon');
    }
  });

  it('puts no discount on an item and no code in the result when none was given', () => {
    const tracked = trackedLines([twoTees], 'CAD');
    expect(tracked.items[0]).not.toHaveProperty('discount');
    expect(tracked).not.toHaveProperty('coupon');
  });

  it('gives nothing for no lines, even with a code', () => {
    expect(trackedLines([], 'CAD', 'WELCOME10')).toStrictEqual({ items: [], value: 0 });
  });
});
