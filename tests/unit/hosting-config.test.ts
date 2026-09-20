import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const vercel = JSON.parse(
  readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'),
) as { headers: HeaderRule[] };
const robots = readFileSync(new URL('../../public/robots.txt', import.meta.url), 'utf8');

const everyRoute = vercel.headers.find((rule) => rule.source === '/(.*)');
const headers = new Map<string, string>(
  (everyRoute?.headers ?? []).map((header): [string, string] => [header.key, header.value]),
);

describe('vercel.json', () => {
  it('applies headers to every route', () => {
    expect(everyRoute).toBeDefined();
  });

  it('keeps the demo store out of search engines', () => {
    expect(headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it.each([
    ['X-Frame-Options', 'DENY'],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
    ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'],
  ])('sets %s', (key, value) => {
    expect(headers.get(key)).toBe(value);
  });
});

describe('public/robots.txt', () => {
  it('asks all crawlers to stay away', () => {
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Disallow: \/$/m);
  });
});
