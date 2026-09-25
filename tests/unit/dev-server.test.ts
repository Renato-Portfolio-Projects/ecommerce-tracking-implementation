import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request as rawRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDevServer } from '../../scripts/dev-server.mjs';

// scripts/dev-server.mjs serves the built store and runs the functions in api/, on this machine, for the browser
// checks. These tests start it on a small folder of their own and ask it things over a real connection.

const parent = mkdtempSync(join(tmpdir(), 'second-impression-dev-server-test-'));
const root = join(parent, 'site');
writeFileSync(join(parent, 'outside.txt'), 'THIS FILE IS OUTSIDE THE SITE');
mkdirSync(join(root, 'about'), { recursive: true });
mkdirSync(join(root, '_astro'), { recursive: true });
writeFileSync(join(root, 'index.html'), '<h1>the home page</h1>');
writeFileSync(join(root, 'about', 'index.html'), '<h1>about</h1>');
writeFileSync(join(root, '404.html'), '<h1>not found page</h1>');
writeFileSync(join(root, '_astro', 'app.js'), 'console.log(1)');
writeFileSync(join(root, '_astro', 'style.css'), 'body{}');
writeFileSync(join(root, 'data.bin'), 'x');
writeFileSync(join(root, 'a file with spaces.html'), '<h1>spaces</h1>');

let server: Awaited<ReturnType<typeof startDevServer>>;
let base = '';
const previous = process.env.PUBLIC_STORE_OPEN;

/** A request with the path sent exactly as written, since fetch would tidy a path like /../x before sending it. */
function raw(path: string, method = 'GET', headers: Record<string, string> = {}): Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const req = rawRequest({ host: '127.0.0.1', port: server.port, path, method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8'), headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

beforeAll(async () => {
  server = await startDevServer({ root, port: 0 });
  base = `http://127.0.0.1:${server.port}`;
});

afterAll(async () => {
  await server.close();
  rmSync(parent, { recursive: true, force: true });
  if (previous === undefined) delete process.env.PUBLIC_STORE_OPEN;
  else process.env.PUBLIC_STORE_OPEN = previous;
});

describe('the built store, as the server gives it', () => {
  it('gives a page for its address, with or without the folder\'s index', async () => {
    for (const [path, text] of [['/', 'the home page'], ['/index.html', 'the home page'], ['/about', 'about'], ['/about/', 'about'], ['/about/index.html', 'about']]) {
      const response = await fetch(base + path);
      expect(response.status, path).toBe(200);
      expect(await response.text(), path).toContain(text);
    }
  });

  it('decodes an address before it looks for the file, so a name with a space is found', async () => {
    const response = await fetch(`${base}/a%20file%20with%20spaces.html`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('spaces');
  });

  it('says what kind of file each one is', async () => {
    const type = async (path: string) => (await fetch(base + path)).headers.get('content-type');
    expect(await type('/')).toBe('text/html; charset=utf-8');
    expect(await type('/_astro/app.js')).toBe('text/javascript; charset=utf-8');
    expect(await type('/_astro/style.css')).toBe('text/css; charset=utf-8');
    expect(await type('/data.bin')).toBe('application/octet-stream');
  });

  it('gives the store\'s own not-found page, with a 404, for an address that is not there', async () => {
    const response = await fetch(`${base}/no-such-page`);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('not found page');
  });

  it('gives a page for a HEAD request without its body', async () => {
    const response = await raw('/', 'HEAD');
    expect(response.status).toBe(200);
    expect(response.body).toBe('');
  });
});

describe('what it will never give, however the path is written', () => {
  const outside = 'THIS FILE IS OUTSIDE THE SITE';

  it('keeps to the site\'s folder', async () => {
    for (const path of ['/../outside.txt', '/..%2foutside.txt', '/%2e%2e/outside.txt', '/..%2Foutside.txt', '/%2e%2e%2foutside.txt', '/..\\outside.txt', '/..%5coutside.txt', '/about/../../outside.txt', '//../outside.txt', '/%00', '/%zz', '/%2e%2e%5coutside.txt']) {
      const response = await raw(path);
      expect(response.body, path).not.toContain(outside);
      expect(response.status, path).not.toBe(200);
    }
  });

  it('does not treat an address that names a file above the folder as a page', async () => {
    const response = await raw('/..%2fpackage.json');
    expect(response.body).not.toContain('"name"');
  });
});

describe('the functions in api/', () => {
  it('runs the currency function, taking the country from the header the browser sent', async () => {
    const answers: Record<string, string> = { CA: 'CAD', GB: 'GBP', FR: 'EUR', JP: 'USD' };
    for (const [country, currency] of Object.entries(answers)) {
      const response = await fetch(`${base}/api/currency`, { headers: { 'x-vercel-ip-country': country } });
      expect(response.status, country).toBe(200);
      expect(await response.json(), country).toEqual({ currency });
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('gives the fallback for a browser that sent no country', async () => {
    expect(await (await fetch(`${base}/api/currency`)).json()).toEqual({ currency: 'USD' });
  });

  it('says a function that is not there is not there, and only for a plain name', async () => {
    for (const path of ['/api/nothing', '/api/', '/api', '/api/../package.json', '/api/currency/extra', '/api/%2e%2e/package.json', '/api/currency.ts']) {
      const response = await raw(path);
      expect(response.body, path).not.toContain('"name"');
      expect(response.body, path).not.toContain('export default');
      expect(response.status, path).toBe(404);
    }
  });

  it('gives a function the method the browser used', async () => {
    expect((await fetch(`${base}/api/currency`, { method: 'POST', body: '{}' })).status).toBe(405);
  });
});

describe('the country it is asked to pretend to be in, and a closed store', () => {
  it('sends its own country when the browser sent none, and lets the browser\'s win when it did', async () => {
    const fromFrance = await startDevServer({ root, port: 0, country: 'FR' });
    try {
      const ask = (headers: Record<string, string> = {}) => fetch(`http://127.0.0.1:${fromFrance.port}/api/currency`, { headers }).then((r) => r.json());
      expect(await ask()).toEqual({ currency: 'EUR' });
      expect(await ask({ 'x-vercel-ip-country': 'JP' })).toEqual({ currency: 'USD' });
    } finally {
      await fromFrance.close();
    }
  });

  it('runs the functions as production does when it is told the store is closed', async () => {
    const closed = await startDevServer({ root, port: 0, open: false });
    try {
      const response = await fetch(`http://127.0.0.1:${closed.port}/api/currency`, { headers: { 'x-vercel-ip-country': 'CA' } });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'not found' });
    } finally {
      await closed.close();
      process.env.PUBLIC_STORE_OPEN = 'true';
    }
  });

  it('hands a function the whole request, method, headers and body, as a POST to a later function will need', async () => {
    const folder = join(parent, 'echo-api');
    mkdirSync(folder);
    writeFileSync(
      join(folder, 'echo.ts'),
      "export default { async fetch(request: Request) { return new Response(JSON.stringify({ method: request.method, mark: request.headers.get('x-mark'), body: await request.text() }), { headers: { 'content-type': 'application/json' } }); } };",
    );
    const echo = await startDevServer({ root, apiFolder: folder, port: 0 });
    try {
      const response = await fetch(`http://127.0.0.1:${echo.port}/api/echo`, { method: 'POST', headers: { 'x-mark': 'yes' }, body: '{"hello":"there"}' });
      expect(await response.json()).toEqual({ method: 'POST', mark: 'yes', body: '{"hello":"there"}' });
    } finally {
      await echo.close();
      process.env.PUBLIC_STORE_OPEN = 'true';
    }
  });

  it('turns a function that throws into a plain 500 that names nothing', async () => {
    const folder = join(parent, 'boom-api');
    mkdirSync(folder);
    writeFileSync(join(folder, 'boom.ts'), "export default { fetch() { throw new Error('ana@example.com typed by a visitor'); } };");
    const boom = await startDevServer({ root, apiFolder: folder, port: 0 });
    try {
      const response = await fetch(`http://127.0.0.1:${boom.port}/api/boom`);
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toBe(JSON.stringify({ error: 'something went wrong' }));
      expect(text).not.toContain('ana@example.com');
    } finally {
      await boom.close();
      process.env.PUBLIC_STORE_OPEN = 'true';
    }
  });

  it('refuses a function file that does not export a fetch function, and says which', async () => {
    const bad = join(parent, 'bad-api');
    mkdirSync(bad);
    writeFileSync(join(bad, 'broken.ts'), 'export default { notFetch: 1 };');
    await expect(startDevServer({ root, apiFolder: bad, port: 0 })).rejects.toThrow('broken.ts');
    process.env.PUBLIC_STORE_OPEN = 'true';
  });

  it('is the script `npm run serve:store` runs', () => {
    const scripts = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).scripts;
    expect(scripts['serve:store']).toBe('node scripts/dev-server.mjs');
  });
});
