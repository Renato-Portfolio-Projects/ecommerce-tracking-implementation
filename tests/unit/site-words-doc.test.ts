import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WORDS } from '../../src/store/words';
import { welcomeCoupon } from '../../src/engine/coupons';
import { COUNTRIES } from '../../src/store/destinations';
import { CART_LIFETIME_DAYS, MAX_CART_LINES, MAX_QUANTITY_PER_LINE } from '../../src/store/policy';
import { FREE_SHIPPING_FROM_CAD, SHIPPING_METHODS } from '../../src/store/shipping-methods';
import { PRODUCTS, isSoldOut, variantsOf } from '../../src/engine/catalog';
import { addToCart, emptyCart, setQuantity, type Cart } from '../../src/engine/cart';
import { formatMoney } from '../../src/engine/money';
import { checkLine } from '../../src/engine/pricing';
import { tableUnderHeading } from '../helpers/markdown';

const doc = readFileSync(new URL('../../docs/site-words.md', import.meta.url), 'utf8');
const brand = readFileSync(new URL('../../docs/brand.md', import.meta.url), 'utf8');

/** The areas of words: every section between "How to read this page" and the blanks table. */
const headings = doc
  .split(/\r?\n/)
  .filter((line) => line.startsWith('## '))
  .map((line) => line.slice(3));
const areas = headings.slice(headings.indexOf('How to read this page') + 1, headings.indexOf('Blanks filled from the code'));

const unquote = (cell: string) => cell.replace(/`/g, '');

/** What the shopper's own choices are called. Every other blank must be listed in the blanks table. */
const CHOICE_BLANKS = ['product', 'variant', 'count', 'size', 'colour', 'price', 'collection', 'amount'];

describe('docs/site-words.md', () => {
  it('lists every word in src/store/words.ts, and only those, with the same wording', () => {
    expect(areas.length).toBeGreaterThan(10);
    const listed: Record<string, string> = {};
    for (const area of areas) {
      for (const [key, wording] of tableUnderHeading(doc, `## ${area}`)) {
        const name = unquote(key);
        expect(listed[name], `${name} is listed twice`).toBeUndefined();
        listed[name] = wording;
      }
    }
    expect(listed).toEqual(WORDS);
  });

  it('gives every blank in a word either the shopper\'s own choice or a value listed in the blanks table', () => {
    const fromCode = tableUnderHeading(doc, '## Blanks filled from the code').map(([blank]) => unquote(blank).slice(1, -1));
    for (const [key, wording] of Object.entries(WORDS)) {
      for (const match of wording.matchAll(/\{(\w+)\}/g)) {
        expect([...CHOICE_BLANKS, ...fromCode], `${key} has an unexplained blank {${match[1]}}`).toContain(match[1]);
      }
    }
  });

  it('shows, in the blanks table, the values the code holds now', () => {
    const standard = SHIPPING_METHODS.find((method) => method.id === 'standard')!;
    const express = SHIPPING_METHODS.find((method) => method.id === 'express')!;
    const welcome = welcomeCoupon()!;
    const shown = Object.fromEntries(
      tableUnderHeading(doc, '## Blanks filled from the code').map(([blank, value]) => [unquote(blank), value]),
    );
    expect(shown).toEqual({
      '{standard}': formatMoney(standard.priceCad, 'CAD'),
      '{express}': formatMoney(express.priceCad, 'CAD'),
      '{freeFrom}': formatMoney(FREE_SHIPPING_FROM_CAD, 'CAD'),
      '{max}': String(MAX_QUANTITY_PER_LINE),
      '{days}': String(CART_LIFETIME_DAYS),
      '{code}': welcome.code,
      '{percent}': String(welcome.percentOff),
    });
  });

  it('shows the messages that the cart and pricing code produce now', () => {
    const line = { sku: 'SI-TEE-002', colour: 'Ink', size: 'M', quantity: 1 };
    const problem = (result: ReturnType<typeof checkLine>) => ('problem' in result ? result.problem.message : 'no problem');

    // A cart that holds as many different items as it may, so that one more is refused.
    let full: Cart = emptyCart();
    const sellable = PRODUCTS.flatMap((product) =>
      variantsOf(product)
        .filter((variant) => !isSoldOut(product, variant.colour, variant.size))
        .map((variant) => ({ sku: product.sku, colour: variant.colour, size: variant.size, quantity: 1 })),
    );
    for (const item of sellable.slice(0, MAX_CART_LINES)) {
      const added = addToCart(full, item);
      if (added.ok) full = added.cart;
    }
    const twentyFirst = sellable[MAX_CART_LINES];
    const refusedWhenFull = addToCart(full, twentyFirst);
    const soldOut = addToCart(emptyCart(), { sku: 'SI-TEE-003', colour: 'Red', size: 'XL', quantity: 1 });
    const oneLine = addToCart(emptyCart(), line);
    const notWhole = oneLine.ok ? setQuantity(oneLine.cart, line, 1.5) : oneLine;

    const now: Record<string, string> = {
      unknown_product: problem(checkLine({ ...line, sku: 'SI-TEE-999' })),
      unknown_variant: problem(checkLine({ ...line, colour: 'Red' })),
      bad_quantity: problem(checkLine({ ...line, quantity: MAX_QUANTITY_PER_LINE + 1 })),
      sold_out: soldOut.ok ? 'no problem' : soldOut.problem.message,
      cart_full: refusedWhenFull.ok ? 'no problem' : refusedWhenFull.problem.message,
      bad_quantity_cart: notWhole.ok ? 'no problem' : notWhole.problem.message,
    };
    const shown = Object.fromEntries(
      tableUnderHeading(doc, '## Messages the code already produces').map(([id, wording]) => [unquote(id), wording]),
    );
    expect(shown).toEqual(now);
  });

  it('has product words for every product, and none for a product that does not exist', () => {
    const skus = PRODUCTS.map((product) => product.sku);
    for (const sku of skus) {
      for (const part of ['blurb', 'detail1', 'detail2', 'detail3']) {
        expect(WORDS, `product.${sku}.${part} is missing`).toHaveProperty([`product.${sku}.${part}`]);
      }
    }
    const withSku = Object.keys(WORDS).filter((key) => key.startsWith('product.SI-'));
    expect(withSku.length).toBe(skus.length * 4);
  });

  it('names every country the store ships to on the shipping page', () => {
    expect(COUNTRIES.length).toBe(9);
    expect(WORDS['shipping.where']).toContain('Nine countries');
    for (const country of COUNTRIES) expect(WORDS['shipping.where'], country.name).toContain(country.name);
  });

  it('avoids the words the brand notes say to avoid', () => {
    const avoid = brand.match(/^Avoid: (.+)\.$/m)![1].split(', ');
    expect(avoid.length).toBeGreaterThan(5);
    for (const [key, wording] of Object.entries(WORDS)) {
      for (const word of avoid) {
        expect(new RegExp(`\\b${word}\\b`, 'i').test(wording), `${key} uses "${word}"`).toBe(false);
      }
    }
  });

  it('keeps every word tidy: no space at either end, no double space', () => {
    for (const [key, wording] of Object.entries(WORDS)) {
      expect(wording, key).toBe(wording.trim());
      expect(wording.includes('  '), `${key} has a double space`).toBe(false);
    }
  });

  it('points every change to a name that really exists in the file it names', () => {
    const rows = tableUnderHeading(doc, '## Changing a word');
    expect(rows.length).toBeGreaterThan(3);
    for (const [, edit] of rows) {
      const match = edit.match(/`([^`]+)` in `([^`]+)`/);
      expect(match, `"${edit}" should read \`name\` in \`path\``).not.toBeNull();
      const [, name, path] = match!;
      const file = new URL(`../../${path}`, import.meta.url);
      expect(existsSync(file), `${path} does not exist`).toBe(true);
      expect(readFileSync(file, 'utf8'), `${name} is not in ${path}`).toContain(name);
    }
  });
});
