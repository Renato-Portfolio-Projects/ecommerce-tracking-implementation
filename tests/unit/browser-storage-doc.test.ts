import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { tableUnderHeading } from '../helpers/markdown';

// docs/browser-storage.md says what the store keeps in a visitor's browser. These tests read the code and that page, so a
// key that is added to the code, or a cookie, cannot go unmentioned.

const root = fileURLToPath(new URL('../../', import.meta.url));
const doc = readFileSync(join(root, 'docs', 'browser-storage.md'), 'utf8');

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
const files = sourceFiles().map((path) => ({ path, code: readFileSync(path, 'utf8') }));

/**
 * Each key the store uses, the kind of storage it lives in, and the names the code refers to it by. The list hand-off's key is
 * made by a function, since it has one for each product.
 */
const KEYS = [
  { key: 'second-impression:cart', kind: 'localStorage', names: ['CART_STORAGE_KEY'] },
  { key: 'second-impression:currency', kind: 'localStorage', names: ['second-impression:currency'] },
  { key: 'second-impression:lead-popup', kind: 'localStorage', names: ['LEAD_POPUP_KEY'] },
  { key: 'second-impression:persona', kind: 'sessionStorage', names: ['PERSONA_STORAGE_KEY'] },
  { key: 'second-impression:default-currency', kind: 'sessionStorage', names: ['DEFAULT_CURRENCY_KEY'] },
  { key: 'second-impression:list-handoff:<sku>', kind: 'sessionStorage', names: ['listHandoffKey'] },
] as const;

const rows = tableUnderHeading(doc, '## What this store keeps, exactly');
const inTable = (cell: string) => cell.replace(/`/g, '');

describe('the storage page and the code', () => {
  it('lists every storage key the code contains, and no other', () => {
    const inCode = new Set<string>();
    for (const { code } of files) {
      for (const match of code.matchAll(/second-impression:[a-z][a-z-]*(?::\$\{\w+\})?/g)) {
        inCode.add(match[0].replace(/:\$\{\w+\}$/, ':<sku>'));
      }
    }
    expect([...inCode].sort()).toEqual(KEYS.map((entry) => entry.key).sort());
    expect(rows.map((row) => inTable(row[0])).sort()).toEqual(KEYS.map((entry) => entry.key).sort());
  });

  it('gives each key the kind of storage the code uses for it', () => {
    for (const entry of KEYS) {
      const row = rows.find((candidate) => inTable(candidate[0]) === entry.key)!;
      expect(inTable(row[1]), entry.key).toBe(entry.kind);
    }
  });

  it('keeps each key in the one kind of storage its page says, in every file that touches it', () => {
    for (const entry of KEYS) {
      const other = entry.kind === 'localStorage' ? 'sessionStorage' : 'localStorage';
      const touching = files.filter(({ code }) => entry.names.some((name) => code.includes(name)));
      expect(touching.length, `${entry.key} is used somewhere`).toBeGreaterThan(0);
      for (const { path, code } of touching) {
        expect(code, `${path} must not use ${other} for ${entry.key}`).not.toContain(other + '.');
      }
      // and at least one of them really uses the kind the page says
      expect(
        touching.some(({ code }) => code.includes(entry.kind + '.')),
        `${entry.key} is really kept in ${entry.kind}`,
      ).toBe(true);
    }
  });

  it('says the store\'s own code sets no cookies, and the code sets none', () => {
    for (const { path, code } of files) {
      expect(code, `${path} writes a cookie, so docs/browser-storage.md must say so`).not.toMatch(/document\s*\.\s*cookie/);
    }
    expect(doc).toContain('The store\'s own code sets no cookies');
  });

  it('gives every key a description, a lifetime and what happens when the browser will not keep it', () => {
    for (const row of rows) {
      expect(row, row[0]).toHaveLength(5);
      for (const cell of row) expect(cell.trim().length, row[0]).toBeGreaterThan(10);
    }
  });
});

describe('the storage page as a page', () => {
  it('links every source and gives a date or says there is none', () => {
    const sources = doc.slice(doc.indexOf('## Sources'));
    const lines = sources.split(/\r?\n/).filter((line) => line.startsWith('- ['));
    expect(lines.length).toBeGreaterThanOrEqual(6);
    for (const line of lines) {
      expect(line).toMatch(/\]\(https:\/\//);
      expect(line).toMatch(/\((?:modified|updated) \d{4}-\d{2}-\d{2}\)$|\(no date shown on the page\)$/);
    }
  });

  it('is linked from the README, and its own links to other pages point at files that exist', () => {
    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    expect(readme).toContain('](docs/browser-storage.md)');
    for (const match of doc.matchAll(/\]\(([a-z-]+\.md)\)/g)) {
      expect(() => statSync(join(root, 'docs', match[1])), match[1]).not.toThrow();
    }
  });
});
