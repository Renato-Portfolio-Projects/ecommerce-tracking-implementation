import { describe, expect, it } from 'vitest';
import { fill } from '../../src/engine/fill';
import { CART_LIFETIME_DAYS } from '../../src/store/policy';
import { WORDS } from '../../src/store/words';
import { OPEN, decodeEntities, externalLinks, fileFor, headingLevels, htmlFiles, internalLinks, readPage, requestsToOtherSites } from '../helpers/built';

const built = htmlFiles(OPEN);
const pages = built.filter((file) => readPage(OPEN, file).includes('<header class="header">'));

/** The words a cart panel or the header link carries for its script, read back from the page. */
function wordsOf(html: string, marker: string): Record<string, string> {
  const match = html.match(new RegExp(`${marker} data-words="([^"]*)"`));
  expect(match, marker).not.toBeNull();
  return JSON.parse(decodeEntities(match![1]));
}

describe('the cart page', () => {
  const file = 'cart/index.html';
  const html = readPage(OPEN, file);
  const text = decodeEntities(html);

  it('is built', () => {
    expect(built).toContain(file);
  });

  it('is named and described in the store\'s words, and keeps out of search engines', () => {
    expect(text).toContain(`<title>${WORDS['cart.title']} | ${WORDS['site.name']}</title>`);
    expect(text).toContain(`<meta name="description" content="${WORDS['site.description']}"`);
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"\s*\/?>/);
  });

  it('has one heading of level 1, the title of the cart, and its heading levels never skip', () => {
    const levels = headingLevels(html);
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    levels.forEach((level, index) => {
      if (index > 0) expect(level, `heading ${index + 1} jumps from ${levels[index - 1]} to ${level}`).toBeLessThanOrEqual(levels[index - 1] + 1);
    });
    expect(text).toContain(`>${WORDS['cart.title']}</h1>`);
  });

  it('holds exactly one cart panel, of the page kind, and no drawer over it', () => {
    expect(html.match(/data-cart-panel/g)).toHaveLength(1);
    expect(html).toContain('class="cart-panel cart-panel--page"');
    expect(html).not.toContain('data-cart-drawer');
    expect(html).not.toContain('data-cart-close');
  });

  it('has the words of an empty cart, of a line, and of the total, each in the store\'s own words', () => {
    for (const key of ['cart.empty', 'cart.keepShopping', 'cart.remove', 'cart.subtotal', 'cart.laterNote', 'cart.checkout'] as const) {
      expect(text, key).toContain(WORDS[key]);
    }
    expect(text).toContain(fill(WORDS['cart.saved'], { days: CART_LIFETIME_DAYS }));
    expect(text).toContain(`role="group" aria-label="${WORDS['cart.quantity']}"`);
    expect(text).toContain(`<a class="btn" href="/">${WORDS['cart.keepShopping']}</a>`);
  });

  it('gives its script every word it fills in, the same as the ones in the store\'s words', () => {
    expect(wordsOf(html, 'data-cart-panel')).toEqual({
      limitReached: WORDS['cart.limitReached'],
      droppedOne: WORDS['cart.droppedOne'],
      droppedMany: WORDS['cart.droppedMany'],
      freeAway: WORDS['cart.freeAway'],
      freeReached: WORDS['cart.freeReached'],
      removeLabel: WORDS['cart.removeLabel'],
      decrease: WORDS['cart.decrease'],
      increase: WORDS['cart.increase'],
      added: WORDS['product.added'],
      was: WORDS['product.was'],
    });
  });

  it('gives a line every control and every place its script fills in', () => {
    const template = html.match(/<template data-cart-line>([\s\S]*?)<\/template>/)![1];
    for (const hook of [
      'data-cart-thumb',
      'data-cart-name',
      'data-cart-variant',
      'data-cart-was',
      'data-cart-unit',
      'data-cart-decrease',
      'data-cart-qty',
      'data-cart-increase',
      'data-cart-remove',
      'data-cart-total',
    ]) {
      expect(template, hook).toContain(hook);
    }
  });

  it('links only to pages that were built, and asks no other site for anything', () => {
    for (const address of internalLinks(html)) expect(built, `${address} is linked but was not built`).toContain(fileFor(address));
    for (const address of externalLinks(html)) expect(address).toMatch(/^https:\/\/github\.com\//);
    expect(requestsToOtherSites(html)).toEqual([]);
  });
});

describe('the cart drawer', () => {
  it('is on every page that has the store\'s header, except the cart page, and only once', () => {
    expect(pages.length).toBeGreaterThan(10);
    for (const file of pages) {
      const html = readPage(OPEN, file);
      const expected = file === 'cart/index.html' ? 0 : 1;
      expect(html.match(/<dialog\b/g)?.length ?? 0, file).toBe(expected);
    }
  });

  it('is a dialog named by its own heading, with a way to close it, holding a panel of the drawer kind', () => {
    const html = decodeEntities(readPage(OPEN, 'index.html'));
    expect(html).toContain('<dialog class="cart-drawer" data-cart-drawer aria-labelledby="cart-drawer-title">');
    expect(html.match(/id="cart-drawer-title"/g)).toHaveLength(1);
    expect(html).toContain(`>${WORDS['cart.title']}</h2>`);
    expect(html).toContain('class="cart-panel cart-panel--drawer"');
    expect(html).toContain(`<button type="button" class="cart-close" data-cart-close aria-label="${WORDS['cart.close']}">`);
    expect(html).toContain(`<button type="button" class="btn" data-cart-close>${WORDS['cart.keepShopping']}</button>`);
  });

  it('links to the cart page, in the store\'s words, under the Checkout button, and the cart page does not link to itself', () => {
    for (const file of pages) {
      const html = readPage(OPEN, file);
      const expected = file === 'cart/index.html' ? 0 : 1;
      expect(html.match(/class="cart-view-link"/g)?.length ?? 0, file).toBe(expected);
    }
    const html = decodeEntities(readPage(OPEN, 'index.html'));
    expect(html).toContain(`<a class="cart-view-link" href="/cart">${WORDS['cart.viewCart']}</a>`);
    const order = ['data-cart-checkout', 'class="cart-view-link"', 'class="cart-saved"'].map((marker) => html.indexOf(marker));
    expect(order.every((position) => position > -1), 'a marker is missing').toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe('the cart link in the header', () => {
  it('goes to the cart page from every page that has the header, and starts as the empty cart', () => {
    for (const file of pages) {
      const html = readPage(OPEN, file);
      expect(html, file).toMatch(/<a class="cart-indicator" href="\/cart" data-cart-link data-words="[^"]*">Cart<\/a>/);
    }
  });

  it('gives its script the words for an empty cart, one item and many', () => {
    expect(wordsOf(readPage(OPEN, 'index.html'), 'data-cart-link')).toEqual({
      empty: WORDS['header.cart'],
      count: WORDS['header.cartCount'],
      one: WORDS['header.cartLabelOne'],
      many: WORDS['header.cartLabelMany'],
    });
  });
});
