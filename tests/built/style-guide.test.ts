import { describe, expect, it } from 'vitest';
import { ART } from '../../src/store/art';
import { PRODUCTS } from '../../src/engine/catalog';
import { WORDS } from '../../src/store/words';
import { CLOSED, OPEN, decodeEntities, readPage, requestsToOtherSites } from '../helpers/built';

describe.each([
  ['closed', CLOSED],
  ['open', OPEN],
] as const)('the style guide, store %s', (_label, folder) => {
  const html = readPage(folder, 'style-guide/index.html');
  const text = decodeEntities(html);

  it('is built whichever way the store is', () => {
    expect(text).toContain(`<h1>${WORDS['style.heading']}</h1>`);
  });

  it('draws one garment for every colour of every product', () => {
    const total = PRODUCTS.reduce((sum, product) => sum + product.colours.length, 0);
    expect(html.match(/class="garment"/g)).toHaveLength(total);
  });

  it('gives every drawing a description that names the product and the colour', () => {
    for (const product of PRODUCTS) {
      for (const colour of product.colours) {
        expect(text, `${product.name} ${colour}`).toContain(`aria-label="${product.name} in ${colour}`);
      }
    }
  });

  it('draws two circles of the mark for each colour of the Logo Tee and the Misprint Tee, and none for the rest', () => {
    const printedSkus = Object.entries(ART)
      .filter(([, art]) => art.print !== 'none')
      .map(([sku]) => sku);
    const expectedCircles = PRODUCTS.filter((product) => printedSkus.includes(product.sku)).reduce(
      (sum, product) => sum + product.colours.length * 2,
      0,
    );
    expect(html.match(/<circle /g)?.length ?? 0).toBe(expectedCircles);
  });

  it('asks no other site for anything', () => {
    expect(requestsToOtherSites(html)).toEqual([]);
  });
});
