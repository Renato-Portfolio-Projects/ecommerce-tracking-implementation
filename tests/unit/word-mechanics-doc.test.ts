import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fill } from '../../src/engine/fill';

// docs/word-mechanics.md says which files hand words to a script through a data-words attribute, and which
// scripts read them. This test reads the code and fails if a file starts doing either, or stops, without that
// page saying so.

const root = fileURLToPath(new URL('../../', import.meta.url));
const doc = readFileSync(join(root, 'docs', 'word-mechanics.md'), 'utf8');

/** Every .ts and .astro file under src. */
function sourceFiles(directory = join(root, 'src')): string[] {
  const found: string[] = [];
  for (const name of readdirSync(directory)) {
    const full = join(directory, name);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (name.endsWith('.ts') || name.endsWith('.astro')) found.push(full);
  }
  return found;
}
const files = sourceFiles().map((path) => ({
  name: path.replace(/^.*[\\/]/, ''),
  code: readFileSync(path, 'utf8'),
}));

const CARRIERS = ['CartPanel.astro', 'Header.astro', 'LeadPopup.astro', 'checkout.astro', 'thank-you.astro'];
const READERS = ['cart-ui.ts', 'lead-popup-ui.ts', 'lead-popup-form.ts', 'checkout-review.ts', 'checkout-steps.ts', 'thank-you.ts'];

describe('the word-mechanics page and the code', () => {
  it('names every file that hands a script words through a data-words attribute, and no other', () => {
    const found = files.filter(({ code }) => /data-words=\{JSON\.stringify\(/.test(code)).map((file) => file.name);
    expect([...new Set(found)].sort()).toEqual([...CARRIERS].sort());
    for (const name of CARRIERS) expect(doc, name).toContain(name);
  });

  it('names every script that reads a data-words attribute, and no other', () => {
    const found = files.filter(({ code }) => /dataset\.words/.test(code)).map((file) => file.name);
    expect([...new Set(found)].sort()).toEqual([...READERS].sort());
    for (const name of READERS) expect(doc, name).toContain(name);
  });

  it('is linked from docs/site-words.md', () => {
    const siteWords = readFileSync(join(root, 'docs', 'site-words.md'), 'utf8');
    expect(siteWords).toContain('](word-mechanics.md)');
  });
});

describe('fill(), which the page describes', () => {
  it('fills a blank with the value given for it', () => {
    expect(fill('Thank you, {firstName}.', { firstName: 'Priya' })).toBe('Thank you, Priya.');
  });

  it('throws when a blank has no value given for it', () => {
    expect(() => fill('Thank you, {firstName}.', {})).toThrow();
  });

  it('throws when a value is given that no blank uses', () => {
    expect(() => fill('Thank you.', { firstName: 'Priya' })).toThrow();
  });
});
