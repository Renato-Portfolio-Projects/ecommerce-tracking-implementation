import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The code is kept in four folders under src:
//   engine: the reusable code, which knows nothing about one particular store
//   store:  one store's own data (its products, prices, countries, rules)
//   demo:   what exists only for the demo, which a real store deletes
//   server: the code that runs on the server, in Vercel functions, which may use the other three
// Each folder may depend only on the folders named below. These tests read every import and fail if
// one points somewhere it should not, so the boundaries cannot wear away without anyone noticing.

const srcRoot = fileURLToPath(new URL('../../src/', import.meta.url));

/** Every TypeScript file under one folder of src. */
function sourceFiles(folder: string): string[] {
  const found: string[] = [];
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      const full = join(directory, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.ts')) found.push(full);
    }
  };
  walk(join(srcRoot, folder));
  return found;
}

/** The places a file's imports and re-exports point to, including an import that only runs a file (`import './x';`). */
function importSpecifiers(code: string): string[] {
  return [...code.matchAll(/^(?:import|export)\b[^;]*?\bfrom\s+'([^']+)';|^import\s+'([^']+)';/gm)].map((match) => match[1] ?? match[2]);
}

/**
 * The folder of src that an import lands in, such as `engine`. It is undefined for a package, which
 * is not our code.
 */
function folderOf(file: string, specifier: string): string | undefined {
  if (!specifier.startsWith('.')) return undefined;
  return relative(srcRoot, resolve(dirname(file), specifier)).split(/[\\/]/)[0];
}

/** Every import in a folder that lands outside the folders it is allowed to depend on. */
function offenders(folder: string, allowed: string[]): string[] {
  const found: string[] = [];
  for (const file of sourceFiles(folder)) {
    for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
      const target = folderOf(file, specifier);
      if (target !== undefined && !allowed.includes(target)) {
        found.push(`${relative(srcRoot, file)} imports ${specifier}`);
      }
    }
  }
  return found;
}

describe('how the code is organised', () => {
  it('has an engine, a store, a demo and a server folder, and no folder called shop', () => {
    for (const folder of ['engine', 'store', 'demo', 'server']) expect(existsSync(join(srcRoot, folder)), folder).toBe(true);
    expect(existsSync(join(srcRoot, 'shop'))).toBe(false);
  });

  it("keeps a store's data free of the engine and the demo, so a store's folder can be swapped whole", () => {
    expect(offenders('store', ['store'])).toEqual([]);
  });

  it('keeps the engine free of the demo and of the server, so deleting the demo folder leaves the engine working and the engine never depends on the server', () => {
    expect(offenders('engine', ['engine', 'store'])).toEqual([]);
  });

  it('keeps the demo free of the server, so the demo is what a real store deletes and nothing more', () => {
    expect(offenders('demo', ['demo', 'engine', 'store'])).toEqual([]);
  });

  it('lets the server use the engine, the store and the demo, and nothing that runs in the browser', () => {
    expect(offenders('server', ['server', 'engine', 'store', 'demo'])).toEqual([]);
  });

  it('has code in each folder, so the checks above are not passing on empty folders', () => {
    for (const folder of ['engine', 'store', 'demo', 'server']) expect(sourceFiles(folder).length, folder).toBeGreaterThan(0);
  });
});

describe('the checks that keep the boundaries', () => {
  const inStore = join(srcRoot, 'store', 'products.ts');
  const inEngine = join(srcRoot, 'engine', 'pricing.ts');

  it('finds every kind of import, including several lines long, type-only and re-exports', () => {
    const code = [
      "import { a } from './a';",
      "import type { B } from '../store/b';",
      'import {',
      '  c,',
      '  type D,',
      "} from '../demo/c';",
      "export { e } from './e';",
      "import { readFileSync } from 'node:fs';",
      "import '../demo/only-runs-a-file';",
      'const text = "from \'../demo/not-an-import\'";',
    ].join('\n');
    expect(importSpecifiers(code)).toEqual(['./a', '../store/b', '../demo/c', './e', 'node:fs', '../demo/only-runs-a-file']);
  });

  it('says which folder an import lands in, and ignores packages', () => {
    expect(folderOf(inStore, './currencies')).toBe('store');
    expect(folderOf(inStore, '../engine/money')).toBe('engine');
    expect(folderOf(inEngine, '../demo/personas')).toBe('demo');
    expect(folderOf(inEngine, '../store/policy')).toBe('store');
    expect(folderOf(inEngine, 'node:fs')).toBeUndefined();
  });
});
