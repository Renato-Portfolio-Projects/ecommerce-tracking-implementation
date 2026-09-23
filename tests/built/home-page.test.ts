import { describe, expect, it } from 'vitest';
import { listContextFor, productsIn, variantsOf } from '../../src/engine/catalog';
import { fill } from '../../src/engine/fill';
import { pricesInAllCurrencies } from '../../src/engine/money';
import { WORDS } from '../../src/store/words';
import { OPEN, decodeEntities, externalLinks, fileFor, headingLevels, htmlFiles, internalLinks, readPage, requestsToOtherSites } from '../helpers/built';

const built = htmlFiles(OPEN);
const html = readPage(OPEN, 'index.html');
const text = decodeEntities(html);

describe('the home page', () => {
  it('is named and described in the store\'s words', () => {
    expect(text).toContain(`<title>${WORDS['site.tagline']} | ${WORDS['site.name']}</title>`);
    expect(text).toContain(`<meta name="description" content="${WORDS['site.description']}"`);
  });

  it('has one heading of level 1, the hero title, and its heading levels never skip', () => {
    const levels = headingLevels(html);
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    levels.forEach((level, index) => {
      if (index > 0) expect(level, `heading ${index + 1} jumps from ${levels[index - 1]} to ${level}`).toBeLessThanOrEqual(levels[index - 1] + 1);
    });
    expect(text).toContain(`<h1>${WORDS['home.heroTitle']}</h1>`);
  });

  it('shows the hero eyebrow, body and a link to the tees section', () => {
    expect(text).toContain(WORDS['home.eyebrow']);
    expect(text).toContain(WORDS['home.heroBody']);
    expect(html).toContain(`href="#tees">${WORDS['home.heroButton']}</a>`);
  });

  it('draws the hero garment, described for people who cannot see it', () => {
    expect(html.match(/<svg class="garment" data-garment/g)!.length).toBeGreaterThanOrEqual(1);
  });

  it.each(['tees', 'pants'] as const)('lists every product of the %s collection', (collectionId) => {
    expect(html).toContain(`<section id="${collectionId}" class="collection">`);
    expect(text).toContain(`<h2>${WORDS[`nav.${collectionId}`]}</h2>`);

    for (const product of productsIn(collectionId)) {
      const context = listContextFor(product);
      const prices = pricesInAllCurrencies(product.priceCad);
      const styles = fill(WORDS['home.styles'], { count: variantsOf(product).length });

      expect(text, product.name).toContain(`<p class="product-name">${product.name}</p>`);
      expect(text, `${product.name} price`).toContain(prices.CAD);
      expect(text, `${product.name} styles`).toContain(styles);
      expect(html, `${product.name} link`).toContain(`href="/products/${product.slug}"`);
      expect(html, `${product.name} list context`).toContain(
        `data-list-handoff-sku="${product.sku}" data-list-handoff-context="${JSON.stringify(context).replace(/"/g, '&quot;')}"`,
      );

      if (product.compareAtCad !== undefined) {
        const comparePrices = pricesInAllCurrencies(product.compareAtCad);
        expect(text, `${product.name} was-price`).toContain(comparePrices.CAD);
      }
    }
  });

  it('shows the brand strip', () => {
    expect(text).toContain(`<p class="label">${WORDS['home.stripLabel']}</p>`);
    expect(text).toContain(WORDS['home.stripText']);
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
