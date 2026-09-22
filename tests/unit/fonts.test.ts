import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tableUnderHeading } from '../helpers/markdown';

const css = readFileSync(new URL('../../src/styles/fonts.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');
const brand = readFileSync(new URL('../../docs/brand.md', import.meta.url), 'utf8');

/** All the fonts together, in bytes. The budget is written in docs/brand.md as "under 60 KB". */
const FONT_BUDGET_BYTES = 60_000;

interface FontFace {
  family: string;
  weight: string;
  display: string;
  url: string;
}

const faces: FontFace[] = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((match) => {
  const block = match[1];
  const read = (property: string) => block.match(new RegExp(`${property}:\\s*([^;]+);`))?.[1].trim() ?? '';
  return {
    family: read('font-family').replace(/['"]/g, ''),
    weight: read('font-weight'),
    display: read('font-display'),
    url: block.match(/url\(['"]?([^'")]+)['"]?\)/)?.[1] ?? '',
  };
});

const fileOf = (url: string) => new URL(url, new URL('../../src/styles/fonts.css', import.meta.url));

describe('src/styles/fonts.css', () => {
  it('declares the three faces the store uses', () => {
    expect(faces.map((face) => `${face.family} ${face.weight}`)).toEqual(['Fraunces 700', 'Public Sans 400', 'Public Sans 600']);
  });

  it('serves every face from a file in this repo, and never from another site', () => {
    expect(css).not.toMatch(/https?:/);
    for (const face of faces) {
      expect(face.url.startsWith('../assets/fonts/'), `${face.url} is not in src/assets/fonts`).toBe(true);
      expect(existsSync(fileOf(face.url)), `${face.url} does not exist`).toBe(true);
    }
  });

  it('serves real woff2 files', () => {
    for (const face of faces) {
      const start = readFileSync(fileOf(face.url)).subarray(0, 4).toString('latin1');
      expect(start, face.url).toBe('wOF2');
    }
  });

  it('keeps all the fonts together under the budget', () => {
    const total = faces.reduce((sum, face) => sum + statSync(fileOf(face.url)).size, 0);
    expect(total).toBeGreaterThan(20_000);
    expect(total).toBeLessThan(FONT_BUDGET_BYTES);
  });

  it('shows the fallback text straight away and swaps when the font arrives', () => {
    for (const face of faces) expect(face.display, `${face.family} ${face.weight}`).toBe('swap');
  });

  it('keeps a licence file for every family', () => {
    for (const family of new Set(faces.map((face) => face.family))) {
      const file = new URL(`../../src/assets/fonts/LICENSE-${family.replace(/ /g, '-')}.txt`, import.meta.url);
      expect(existsSync(file), `no licence file for ${family}`).toBe(true);
      expect(readFileSync(file, 'utf8')).toContain('SIL OPEN FONT LICENSE');
    }
  });

  it('is named first in the font stacks in src/styles/tokens.css', () => {
    expect(tokens).toMatch(/--font-display:\s*'Fraunces',/);
    expect(tokens).toMatch(/--font-body:\s*'Public Sans',/);
  });
});

describe('docs/brand.md type', () => {
  it('lists each family with the weights that are loaded, and its licence file', () => {
    const rows = tableUnderHeading(brand, '## Type');
    const loaded = new Map<string, string[]>();
    for (const face of faces) loaded.set(face.family, [...(loaded.get(face.family) ?? []), face.weight]);
    expect(rows.length).toBe(loaded.size);
    for (const [, family, weights, licence] of rows) {
      expect(weights.split(', '), family).toEqual(loaded.get(family));
      expect(existsSync(new URL(`../../${licence.replace(/`/g, '')}`, import.meta.url)), `${licence} does not exist`).toBe(true);
    }
  });
});
