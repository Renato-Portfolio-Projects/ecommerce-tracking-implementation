import { describe, expect, it } from 'vitest';
import { garmentLabelTemplate } from '../../src/components/garment-label';
import { isSoldOut, PRODUCTS } from '../../src/engine/catalog';
import { fill } from '../../src/engine/fill';
import { formatMoney, pricesInAllCurrencies } from '../../src/engine/money';
import { ART } from '../../src/store/art';
import { MAX_QUANTITY_PER_LINE } from '../../src/store/policy';
import { FREE_SHIPPING_FROM_CAD } from '../../src/store/shipping-methods';
import { WORDS, type WordKey } from '../../src/store/words';
import { OPEN, decodeEntities, externalLinks, fileFor, headingLevels, htmlFiles, internalLinks, readPage, requestsToOtherSites } from '../helpers/built';

const built = htmlFiles(OPEN);

describe.each(PRODUCTS)('the product page for $name', (product) => {
  const file = `products/${product.slug}/index.html`;
  const html = readPage(OPEN, file);
  const text = decodeEntities(html);
  const art = ART[product.sku];
  const blurb = WORDS[`product.${product.sku}.blurb` as WordKey];
  const prices = pricesInAllCurrencies(product.priceCad);

  it('is built', () => {
    expect(built).toContain(file);
  });

  it('is named and described in the store\'s words', () => {
    expect(text).toContain(`<title>${product.name} | ${WORDS['site.name']}</title>`);
    expect(text).toContain(`<meta name="description" content="${blurb}"`);
    expect(html).toContain('<html lang="en-CA">');
  });

  it('has one heading of level 1, and its heading levels never skip', () => {
    const levels = headingLevels(html);
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    levels.forEach((level, index) => {
      if (index > 0) expect(level, `heading ${index + 1} jumps from ${levels[index - 1]} to ${level}`).toBeLessThanOrEqual(levels[index - 1] + 1);
    });
    expect(text).toContain(`<h1>${product.name}</h1>`);
  });

  it('shows its blurb, its three details and the price in CAD', () => {
    expect(text).toContain(blurb);
    for (let n = 1; n <= 3; n += 1) expect(text).toContain(WORDS[`product.${product.sku}.detail${n}` as WordKey]);
    expect(text).toContain(prices.CAD);
    if (product.compareAtCad !== undefined) {
      const comparePrices = pricesInAllCurrencies(product.compareAtCad);
      expect(text).toContain(fill(WORDS['product.was'], { price: comparePrices.CAD }));
    }
  });

  it('names every colour and size it comes in', () => {
    for (const colour of product.colours) expect(text, colour).toContain(colour);
    for (const size of product.sizes) expect(text, size).toContain(`>${size}<`);
  });

  it('disables only the sizes sold out in the colour shown first, and nothing else', () => {
    const firstColour = product.colours[0];
    for (const size of product.sizes) {
      const match = html.match(new RegExp(`<input\\s+type="radio"\\s+name="size"\\s+value="${size}"([^>]*)>`));
      expect(match, size).not.toBeNull();
      const soldOut = isSoldOut(product, firstColour, size);
      expect(match![1].includes('disabled'), `${size} in ${firstColour}`).toBe(soldOut);
    }
  });

  it('starts with no size chosen and Add to cart disabled', () => {
    expect(text).toContain(WORDS['product.chooseSize']);
    expect(html).toMatch(/<button type="button" class="btn" data-add-to-cart disabled>/);
  });

  it('offers a quantity from 1 up to the most one line may hold', () => {
    expect(html).toContain(`<input type="number" min="1" max="${MAX_QUANTITY_PER_LINE}" value="1" data-quantity>`);
  });

  it('carries its own SKU and a quantity field, which is what Add to cart reads', () => {
    expect(html).toContain(`data-sku="${product.sku}"`);
    expect(html.match(/data-quantity/g)).toHaveLength(1);
  });

  it('names the free shipping threshold', () => {
    expect(text).toContain(fill(WORDS['product.freeShipping'], { freeFrom: formatMoney(FREE_SHIPPING_FROM_CAD, 'CAD') }));
  });

  it('links back to its own collection', () => {
    const collectionName = product.collection === 'tees' ? WORDS['nav.tees'] : WORDS['nav.pants'];
    expect(text).toContain(`href="/#${product.collection}">${fill(WORDS['product.back'], { collection: collectionName })}</a>`);
  });

  it('carries a schema.org Product script with the sku, the CAD price and whether it is in stock', () => {
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const json = JSON.parse(match![1]);
    expect(json['@type']).toBe('Product');
    expect(json.sku).toBe(product.sku);
    expect(json.name).toBe(product.name);
    expect(json.offers.priceCurrency).toBe('CAD');
    expect(json.offers.price).toBe((product.priceCad / 100).toFixed(2));
    const anyInStock = product.colours.some((colour) => product.sizes.some((size) => !isSoldOut(product, colour, size)));
    expect(json.offers.availability).toBe(anyInStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock');
  });

  it('draws the garment for its first colour, described for people who cannot see it', () => {
    expect(html).toContain(`data-garment`);
    expect(html.match(/<svg class="garment" data-garment/g)).toHaveLength(1);
    // The page carries the sentence that describes the drawing, so its script does not have to carry every word.
    expect(text).toContain(`data-label="${garmentLabelTemplate(art.print)}"`);
  });

  it('has the demo bar, a skip link first, the header, the main area and the footer', () => {
    expect(text.indexOf('class="skip-link"'), 'the skip link comes before the demo bar').toBeLessThan(text.indexOf('class="demo-bar"'));
    expect(text).toContain(`<nav class="nav" aria-label="${WORDS['nav.label']}">`);
    expect(html.match(/<header\b/g)).toHaveLength(1);
    expect(html.match(/<main\b[^>]*id="content"/g)).toHaveLength(1);
    expect(html.match(/<footer\b/g)).toHaveLength(1);
  });

  it('links only to pages that were built, or to the outside places the header and footer already allow', () => {
    for (const address of internalLinks(html)) {
      expect(built, `${address} is linked but was not built`).toContain(fileFor(address));
    }
    for (const address of externalLinks(html)) expect(address).toMatch(/^https:\/\/github\.com\//);
  });

  it('keeps out of search engines and asks no other site for anything', () => {
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"\s*\/?>/);
    expect(requestsToOtherSites(html)).toEqual([]);
  });
});
