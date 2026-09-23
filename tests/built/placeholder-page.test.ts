import { describe, expect, it } from 'vitest';
import { WORDS } from '../../src/store/words';
import { CLOSED, readPage, requestsToOtherSites } from '../helpers/built';

const html = readPage(CLOSED, 'index.html');

describe('the built placeholder page', () => {
  it('tells search engines to stay away', () => {
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"\s*\/?>/);
  });

  it('says plainly that it is a demo', () => {
    expect(html).toContain('Portfolio demo store');
  });

  it('shows the store name and tagline from src/store/words.ts, not text of its own', () => {
    expect(html).toContain(WORDS['site.name']);
    expect(html).toContain(WORDS['site.tagline']);
    expect(html).toContain(`<title>${WORDS['site.name']}</title>`);
    expect(html).toContain(`content="${WORDS['site.description']}"`);
  });

  it('makes no third-party requests', () => {
    expect(requestsToOtherSites(html)).toEqual([]);
  });
});
