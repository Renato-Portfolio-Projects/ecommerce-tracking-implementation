import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { isStoreOpen, storePages, storeRoutes } from '../../scripts/store-pages.mjs';

const root = mkdtempSync(join(tmpdir(), 'store-pages-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

function touch(path: string) {
  const full = join(root, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, '');
}
for (const path of [
  'about.astro',
  'contact.astro',
  'policies/shipping.astro',
  'policies/returns.astro',
  'products/[slug].astro',
  'products/index.astro',
  '_notes.astro',
  '_private/secret.astro',
  'readme.md',
]) {
  touch(path);
}
const folder = pathToFileURL(`${root}/`);

describe('isStoreOpen', () => {
  it('opens the store only for the exact word "true"', () => {
    expect(isStoreOpen({ PUBLIC_STORE_OPEN: 'true' })).toBe(true);
  });

  it.each([undefined, '', 'false', '1', 'TRUE', 'yes', ' true'])('keeps the store closed for %j', (value) => {
    expect(isStoreOpen({ PUBLIC_STORE_OPEN: value })).toBe(false);
  });

  it('keeps the store closed when the variable is not there at all', () => {
    expect(isStoreOpen({})).toBe(false);
  });
});

describe('storeRoutes', () => {
  it('turns the names of the page files into addresses, and leaves out what is not a page', () => {
    expect(storeRoutes(folder, './src/store-pages')).toEqual([
      { pattern: '/about', entrypoint: './src/store-pages/about.astro' },
      { pattern: '/contact', entrypoint: './src/store-pages/contact.astro' },
      { pattern: '/policies/returns', entrypoint: './src/store-pages/policies/returns.astro' },
      { pattern: '/policies/shipping', entrypoint: './src/store-pages/policies/shipping.astro' },
      { pattern: '/products/[slug]', entrypoint: './src/store-pages/products/[slug].astro' },
      { pattern: '/products', entrypoint: './src/store-pages/products/index.astro' },
    ]);
  });
});

describe('storePages', () => {
  const setup = (open: boolean) => {
    const injectRoute = vi.fn();
    const integration = storePages({ open, folder, entryBase: './src/store-pages' });
    const hook = integration.hooks['astro:config:setup'] as unknown as (options: { injectRoute: typeof injectRoute }) => void;
    hook({ injectRoute });
    return injectRoute;
  };

  it('adds every store page when the store is open', () => {
    expect(setup(true)).toHaveBeenCalledTimes(6);
  });

  it('adds nothing when the store is closed', () => {
    expect(setup(false)).not.toHaveBeenCalled();
  });
});
