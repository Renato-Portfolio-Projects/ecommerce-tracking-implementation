import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WORDS } from '../../src/store/words';
import { CLOSED, OPEN, decodeEntities, htmlFiles, readPage, requestsToOtherSites } from '../helpers/built';

describe('the site built with the store closed', () => {
  it('holds the placeholder page and the 404 page, and nothing else', () => {
    expect(htmlFiles(CLOSED)).toEqual(['404.html', 'index.html', 'style-guide/index.html']);
  });

  it('has none of the store\'s pages', () => {
    const paths = [
      'about',
      'contact',
      'policies/shipping',
      'policies/returns',
      'policies/terms',
      'products/plain-tee',
      'products/logo-tee',
      'products/misprint-tee',
      'products/plain-chino',
      'products/relaxed-chino',
      'products/pleated-chino',
    ];
    for (const path of paths) {
      expect(existsSync(new URL(`${path}/index.html`, CLOSED)), path).toBe(false);
    }
  });
});

describe('the site built with the store open', () => {
  it('holds the placeholder page, the 404 page and the store\'s pages', () => {
    expect(htmlFiles(OPEN)).toEqual([
      '404.html',
      'about/index.html',
      'contact/index.html',
      'index.html',
      'policies/returns/index.html',
      'policies/shipping/index.html',
      'policies/terms/index.html',
      'products/logo-tee/index.html',
      'products/misprint-tee/index.html',
      'products/plain-chino/index.html',
      'products/plain-tee/index.html',
      'products/pleated-chino/index.html',
      'products/relaxed-chino/index.html',
      'style-guide/index.html',
    ]);
  });

  it('shows the words from src/store/words.ts on the About page', () => {
    const about = decodeEntities(readPage(OPEN, 'about/index.html'));
    expect(about).toContain(WORDS['about.heading']);
    expect(about).toContain(WORDS['about.p1']);
    expect(about).toContain(`<title>${WORDS['about.title']} | ${WORDS['site.name']}</title>`);
  });

  it('keeps every page out of search engines and free of third-party requests', () => {
    for (const path of htmlFiles(OPEN)) {
      const html = readPage(OPEN, path);
      expect(html, path).toMatch(/<meta name="robots" content="noindex, nofollow"\s*\/?>/);
      expect(requestsToOtherSites(html), path).toEqual([]);
    }
  });
});
