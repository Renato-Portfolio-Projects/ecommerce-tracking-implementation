import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, parseOklch, readColourTokens } from '../helpers/colour';
import { tableUnderHeading } from '../helpers/markdown';

const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');
const brand = readFileSync(new URL('../../docs/brand.md', import.meta.url), 'utf8');
const tokens = readColourTokens(css);

const unquote = (cell: string) => cell.replace(/`/g, '');
const tokenName = (cell: string) => unquote(cell).replace(/^--/, '');

describe('the contrast helper', () => {
  it('gives 21 for black on white and 1 for a colour on itself', () => {
    const black = parseOklch('oklch(0% 0 0)');
    const white = parseOklch('oklch(100% 0 0)');
    expect(contrastRatio(black, white)).toBeCloseTo(21, 1);
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
  });

  it('does not care which colour is named first', () => {
    const a = parseOklch(tokens['ink']);
    const b = parseOklch(tokens['paper']);
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });

  it('refuses a colour it cannot read', () => {
    expect(() => parseOklch('#ffffff')).toThrow('Not an oklch colour');
  });
});

describe('docs/brand.md colours', () => {
  it('lists every colour token in src/styles/tokens.css with the value it has there', () => {
    const rows = tableUnderHeading(brand, '## Colour');
    const listed = Object.fromEntries(rows.map(([token, value]) => [tokenName(token), unquote(value)]));
    expect(listed).toEqual(tokens);
  });
});

describe('docs/brand.md contrast', () => {
  const rows = tableUnderHeading(brand, '## Contrast');

  it('lists the pairs that carry text', () => {
    expect(rows.length).toBeGreaterThan(8);
  });

  it('shows the ratio that the tokens really give, for each pair', () => {
    for (const [text, background, , ratio] of rows) {
      const worked = contrastRatio(parseOklch(tokens[tokenName(text)]), parseOklch(tokens[tokenName(background)]));
      expect(ratio, `${text} on ${background}`).toBe(worked.toFixed(2));
    }
  });

  it('holds every pair to what it needs: 4.5 for small text, 3 for large text', () => {
    for (const [text, background, , , needs] of rows) {
      expect(['3', '4.5'], `${text} on ${background} needs ${needs}`).toContain(needs);
      const worked = contrastRatio(parseOklch(tokens[tokenName(text)]), parseOklch(tokens[tokenName(background)]));
      expect(worked, `${text} on ${background}`).toBeGreaterThanOrEqual(Number(needs));
    }
  });

  it('only lets the bright red carry large text, and gives small red text the darker red', () => {
    const needsFor = (text: string, background: string) =>
      rows.find(([t, b]) => tokenName(t) === text && tokenName(b) === background)?.[4];
    expect(needsFor('spot-red', 'paper')).toBe('3');
    expect(needsFor('spot-red-text', 'paper')).toBe('4.5');
    expect(rows.some(([t, , , , needs]) => tokenName(t) === 'spot-red' && needs === '4.5')).toBe(false);
  });
});
