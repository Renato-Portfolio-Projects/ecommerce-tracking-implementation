import { describe, expect, it } from 'vitest';
import { listContextFor, productsIn, variantsOf } from '../../src/engine/catalog';
import { fill } from '../../src/engine/fill';
import { pricesInAllCurrencies } from '../../src/engine/money';
import { WORDS } from '../../src/store/words';
import { parseTrackable, trackableProduct } from '../../src/tracking/items';
import { HERO_PROMOTION, parsePromotion } from '../../src/tracking/promotions';
import { OPEN, decodeEntities, externalLinks, fileFor, headingLevels, htmlFiles, internalLinks, readPage, requestsToOtherSites, scriptOf } from '../helpers/built';

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
    expect(html).toContain(`<section id="${collectionId}" class="collection" data-track-seen="list">`);
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

describe('the home page, for tracking', () => {
  it('marks the hero as a promotion to count when it is seen, and its button as the way to select it', () => {
    const hero = html.match(/<section class="hero"([^>]*)>/);
    expect(hero, 'the hero section was found').not.toBeNull();
    expect(hero![1]).toContain('data-track-seen="promotion"');
    const raw = decodeEntities(hero![1].match(/data-track-promotion="([^"]*)"/)![1]);
    expect(parsePromotion(raw)).toStrictEqual(HERO_PROMOTION);
    expect(html).toContain('<a class="btn" data-track-promotion-cta href="#tees">');
  });

  it.each(['tees', 'pants'] as const)('carries every product of the %s collection to tracking as data, built by the same code as the tests', (collectionId) => {
    for (const product of productsIn(collectionId)) {
      const card = html.match(new RegExp(`<a\\s[^>]*data-list-handoff-sku="${product.sku}"[^>]*>`));
      expect(card, `${product.name}'s card was found`).not.toBeNull();
      const raw = decodeEntities(card![0].match(/data-track-item="([^"]*)"/)?.[1] ?? '');
      expect(parseTrackable(raw), product.name).toStrictEqual(trackableProduct(product));
    }
  });

  it('loads the code that looks for the blocks to count when seen, and for clicks on cards and the hero button', () => {
    // Event names would prove nothing: any page that can announce at all carries the whole list of them. These are
    // the names only the wiring uses.
    const script = scriptOf(OPEN, html);
    for (const wiring of ['data-track-seen', 'data-track-promotion-cta', 'a[data-track-item]']) {
      expect(script, wiring).toContain(wiring);
    }
  });
});
