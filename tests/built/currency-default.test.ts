import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CURRENCY_KEY } from '../../src/components/default-currency';
import { PRODUCTS } from '../../src/engine/catalog';
import { CURRENCIES } from '../../src/store/currencies';
import { CLOSED, OPEN, htmlFiles, readPage, scriptOf } from '../helpers/built';

const built = htmlFiles(OPEN);
const pages = built.filter((file) => readPage(OPEN, file).includes('id="currency-select"'));

// The page is static, so it cannot know the visitor's country. These tests check what can be read from the built
// site: that every page is built in Canadian dollars, the store's own, and that the code which asks for a starting
// currency, and keeps it, is in what every page loads. What it does when the answer comes is checked by driving a
// page in a browser, since these tests cannot run a script or answer a request.
describe('the pages, before any script has chosen a currency', () => {
  it('include the currency selector on every page with the store\'s header, so the checks below cover them all', () => {
    const withHeader = built.filter((file) => readPage(OPEN, file).includes('<header class="header">'));
    expect(pages.length).toBeGreaterThan(10);
    expect(pages).toEqual(withHeader);
  });

  it('are built in Canadian dollars, whatever country the build ran in, with no currency marked as chosen', () => {
    const base = CURRENCIES[0];
    expect(base.code).toBe('CAD');
    let priced = 0;
    for (const file of pages) {
      const html = readPage(OPEN, file);
      const select = html.match(/<select id="currency-select">[\s\S]*?<\/select>/)![0];
      expect(select, file).not.toMatch(/\sselected[\s>=]/);
      for (const match of html.matchAll(/<span\b[^>]*\sdata-prices="([^"]*)"[^>]*>([^<]*)</g)) {
        const prices = JSON.parse(match[1].replace(/&quot;/g, '"')) as Record<string, string>;
        expect(match[2], file).toBe(prices[base.code]);
        priced += 1;
      }
    }
    // So the loop above cannot pass by finding no prices at all: each product's price, and its earlier price if it
    // has one, is on the home page and on its own page, and nowhere else is a price built into a page.
    const perPlace = PRODUCTS.length + PRODUCTS.filter((product) => product.compareAtCad !== undefined).length;
    expect(priced).toBe(2 * perPlace);
  });
});

describe('the script that starts a visitor in their own currency', () => {
  it('is loaded by every page that has the selector, and carries the address it asks and the two notes it reads', () => {
    for (const file of pages) {
      const script = scriptOf(OPEN, readPage(OPEN, file));
      expect(script, file).toContain('/api/currency');
      expect(script, file).toContain(DEFAULT_CURRENCY_KEY);
      expect(script, file).toContain('second-impression:currency');
    }
  });

  it('is the only script in the whole site that asks for it, so a page cannot ask twice', () => {
    const assets = new URL('_astro/', OPEN);
    const asking = readdirSync(assets).filter(
      (name) => name.endsWith('.js') && readFileSync(new URL(name, assets), 'utf8').includes('/api/currency'),
    );
    expect(asking).toHaveLength(1);
  });

  it('is not loaded by any page of the store built closed, which has no functions to ask', () => {
    for (const file of htmlFiles(CLOSED)) {
      expect(scriptOf(CLOSED, readPage(CLOSED, file)), file).not.toContain('/api/currency');
    }
  });
});
