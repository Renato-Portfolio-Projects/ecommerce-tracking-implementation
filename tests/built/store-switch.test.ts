import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WORDS } from '../../src/store/words';

/** The built site with the store closed, which is what production builds. */
const closed = new URL('../../dist/', import.meta.url);
/** The built site with the store open, which is what a preview builds (npm run build:store). */
const open = new URL('../../dist-store/', import.meta.url);

function htmlFiles(folder: URL, sub = ''): string[] {
  const found: string[] = [];
  for (const name of readdirSync(new URL(sub, folder))) {
    const path = `${sub}${name}`;
    if (statSync(new URL(path, folder)).isDirectory()) found.push(...htmlFiles(folder, `${path}/`));
    else if (name.endsWith('.html')) found.push(path);
  }
  return found.sort();
}

describe('the site built with the store closed', () => {
  it('holds the placeholder page and nothing else', () => {
    expect(htmlFiles(closed)).toEqual(['index.html']);
  });

  it('has none of the store\'s pages', () => {
    expect(existsSync(new URL('about/index.html', closed))).toBe(false);
  });
});

describe('the site built with the store open', () => {
  const about = readFileSync(new URL('about/index.html', open), 'utf8');

  it('holds the placeholder page and the store\'s pages', () => {
    expect(htmlFiles(open)).toEqual(['about/index.html', 'index.html']);
  });

  it('shows the words from src/store/words.ts on the About page', () => {
    expect(about).toContain(WORDS['about.heading']);
    expect(about).toContain(WORDS['about.p1']);
    expect(about).toContain(`<title>${WORDS['about.title']} | ${WORDS['site.name']}</title>`);
  });

  it('keeps every page out of search engines and free of third-party requests', () => {
    for (const path of htmlFiles(open)) {
      const html = readFileSync(new URL(path, open), 'utf8');
      expect(html, path).toMatch(/<meta name="robots" content="noindex, nofollow"\s*\/?>/);
      const external = [...html.matchAll(/(?:src|href|action)="(https?:\/\/[^"]+)"/g)].map((match) => match[1]);
      expect(external, path).toEqual([]);
    }
  });
});
