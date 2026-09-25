import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transformSync } from 'esbuild';
import { afterAll, describe, expect, it } from 'vitest';

// Vercel runs a function as a native ES module, file by file, with no bundling. Node then needs every relative import to
// name its file with an extension, which TypeScript does not ask for and which the local server (scripts/dev-server.mjs)
// hides, because esbuild bundles the function there. The first Preview deployment of v0.2c-1 failed for exactly this
// reason: "Cannot find module '/var/task/src/server/currency'". So this test does what Vercel does. It turns each file
// the functions reach into JavaScript one by one, puts them in a temporary folder, and imports each function with plain Node.

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const made = mkdtempSync(join(tmpdir(), 'second-impression-native-'));
afterAll(() => rmSync(made, { recursive: true, force: true }));

/** The relative import specifiers of a source file: `from '...'`, `import '...'` and `export ... from '...'`. */
function relativeImports(code: string): string[] {
  const found = [...code.matchAll(/(?:from|import)\s*['"](\.{1,2}\/[^'"]+)['"]/g)].map((match) => match[1]);
  return [...new Set(found)];
}

/** Every file a function reaches, following the imports as written, with the TypeScript file each one means. */
function reach(entry: string): string[] {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const specifier of relativeImports(readFileSync(file, 'utf8'))) {
      const wanted = resolve(dirname(file), specifier).replace(/\.js$/, '');
      visit(`${wanted}.ts`);
    }
  };
  visit(entry);
  return [...seen];
}

const functions = readdirSync(join(root, 'api'))
  .filter((name) => name.endsWith('.ts'))
  .map((name) => join(root, 'api', name));

describe('the functions in api/, run the way Vercel runs them', () => {
  it('finds the functions, and the shared code they reach', () => {
    expect(functions.length).toBeGreaterThan(0);
    const reached = new Set(functions.flatMap(reach).map((file) => relative(root, file).replace(/\\/g, '/')));
    expect(reached).toContain('src/server/gate.ts');
    expect(reached).toContain('src/store/currencies.ts');
  });

  it('turns each file into JavaScript on its own and runs each function with plain Node, with no bundling', () => {
    const files = new Set(functions.flatMap(reach));
    for (const file of files) {
      const output = join(made, relative(root, file).replace(/\.ts$/, '.js'));
      mkdirSync(dirname(output), { recursive: true });
      const { code } = transformSync(readFileSync(file, 'utf8'), { loader: 'ts', format: 'esm', target: 'node22' });
      writeFileSync(output, code);
    }
    writeFileSync(join(made, 'package.json'), JSON.stringify({ type: 'module' }));

    for (const file of functions) {
      const compiled = pathToFileURL(join(made, 'api', `${relative(join(root, 'api'), file).replace(/\.ts$/, '.js')}`)).href;
      const script = `
        const loaded = await import(${JSON.stringify(compiled)});
        const worker = loaded.default;
        if (typeof worker?.fetch !== 'function') throw new Error('the function has no fetch handler');
        const response = await worker.fetch(new Request('https://example.test/api/x', { headers: { 'x-vercel-ip-country': 'FR' } }));
        console.log(JSON.stringify({ status: response.status, type: response.headers.get('content-type') }));
      `;
      const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        encoding: 'utf8',
        env: { ...process.env, PUBLIC_STORE_OPEN: 'true' },
      });
      const answer = JSON.parse(out.trim().split('\n').pop()!) as { status: number; type: string };
      expect(answer.status, file).toBeLessThan(500);
      expect(answer.type, file).toContain('application/json');
    }
  });
});
