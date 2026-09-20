import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8');

describe('the built holding page', () => {
  it('tells search engines to stay away', () => {
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"\s*\/?>/);
  });

  it('says plainly that it is a demo', () => {
    expect(html).toContain('Portfolio demo store');
  });

  it('shows the store name and tagline', () => {
    expect(html).toContain('Second Impression');
    expect(html).toContain('Worth a second look.');
  });

  it('makes no third-party requests', () => {
    const external = [...html.matchAll(/(?:src|href|action)="(https?:\/\/[^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(external).toEqual([]);
  });
});
