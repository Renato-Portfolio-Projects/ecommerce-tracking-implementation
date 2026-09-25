// Serves the built open store and runs the functions in api/ together, on this machine, for looking at the
// store and for browser checks. `astro dev` does not run the api folder, and `vercel dev` needs a login and a
// linked project, so this small server does both from what is already built. Usage:
//
//   npm run build:store
//   npm run serve:store                       (http://localhost:4700)
//   node scripts/dev-server.mjs --port 4800 --country FR
//
// `--country` is sent as the country header Vercel would add, when the browser did not send one, so a visit
// from another country can be tried. `--closed` runs the functions as they run in production, with the store
// closed. It is for this machine only: it is not deployed, and it never serves anything outside the folder it
// is given. The functions are bundled once, when it starts, so a change to one needs a restart.
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT_OF_REPOSITORY = fileURLToPath(new URL('../', import.meta.url));
const COUNTRY_HEADER = 'x-vercel-ip-country';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.ico': 'image/x-icon',
};

/** A JSON answer in the shape the functions use, for a request that never reached one. */
function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

/**
 * Bundles every function in a folder and loads it. A function's file imports from src/server, in TypeScript,
 * so it is bundled into one plain module first, in a temporary folder, as Vercel does when it deploys it.
 * Gives the functions by name (currency for /api/currency), and a way to delete the temporary folder.
 */
async function loadFunctions(apiFolder) {
  const work = mkdtempSync(join(tmpdir(), 'second-impression-api-'));
  const found = new Map();
  for (const file of readdirSync(apiFolder).filter((name) => /\.(ts|js|mjs)$/.test(name))) {
    const name = file.replace(/\.[^.]+$/, '');
    const out = join(work, `${name}.mjs`);
    await build({ entryPoints: [join(apiFolder, file)], outfile: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'silent' });
    const loaded = await import(pathToFileURL(out).href);
    if (typeof loaded.default?.fetch !== 'function') throw new Error(`api/${file} does not export a default with a fetch function`);
    found.set(name, loaded.default.fetch);
  }
  return { functions: found, remove: () => rmSync(work, { recursive: true, force: true }) };
}

/** Turns what Node received into a standard Request, adding the country header when asked to. */
async function toRequest(req, url, country) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.append(name, Array.isArray(value) ? value.join(', ') : value);
  }
  if (country && !headers.has(COUNTRY_HEADER)) headers.set(COUNTRY_HEADER, country);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && chunks.length > 0;
  return new Request(url.href, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined });
}

async function runFunction(functions, req, res, url, country) {
  const name = url.pathname.slice('/api/'.length);
  const run = /^[A-Za-z][\w-]*$/.test(name) ? functions.get(name) : undefined;
  if (!run) return json(res, 404, { error: 'not found' });
  try {
    const response = await run(await toRequest(req, url, country));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error('A function threw:', error instanceof Error ? error.name : typeof error);
    json(res, 500, { error: 'something went wrong' });
  }
}

/** The file a path names inside the folder, or nothing if it names anything outside it. */
function fileFor(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  if (decoded.includes('\0')) return undefined;
  const file = resolve(root, `.${decoded.startsWith('/') ? '' : '/'}${decoded}`);
  const inside = relative(root, file);
  return inside.startsWith('..') || isAbsolute(inside) ? undefined : file;
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function serveStatic(root, res, url) {
  const file = fileFor(root, url.pathname);
  const candidates = file ? [file, join(file, 'index.html'), `${file}.html`] : [];
  const found = candidates.find(isFile);
  const missing = join(root, '404.html');
  const chosen = found ?? (isFile(missing) ? missing : undefined);
  if (!chosen) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('not found');
  }
  res.writeHead(found ? 200 : 404, { 'content-type': TYPES[extname(chosen)] ?? 'application/octet-stream' });
  res.end(readFileSync(chosen));
}

/**
 * Starts the server. `root` is the built store, `apiFolder` holds the functions, `port` can be 0 to let the
 * system choose, `country` is sent as Vercel's country header when the browser sends none, and `open` (true
 * unless said otherwise) sets PUBLIC_STORE_OPEN for the functions, which read it from the environment.
 *
 * @param {{ root?: string, apiFolder?: string, port?: number, country?: string, open?: boolean }} [options]
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
export async function startDevServer({ root = join(ROOT_OF_REPOSITORY, 'dist-store'), apiFolder = join(ROOT_OF_REPOSITORY, 'api'), port = 4700, country, open = true } = {}) {
  process.env.PUBLIC_STORE_OPEN = open ? 'true' : 'false';
  const resolvedRoot = resolve(root);
  const { functions, remove } = await loadFunctions(apiFolder);
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      runFunction(functions, req, res, url, country).catch(() => json(res, 500, { error: 'something went wrong' }));
    } else {
      serveStatic(resolvedRoot, res, url);
    }
  });
  await new Promise((done) => server.listen(port, done));
  return {
    port: server.address().port,
    close: () =>
      new Promise((done) => {
        server.close(() => {
          remove();
          done();
        });
        server.closeAllConnections();
      }),
  };
}

// Run from the command line, not when a test imports it.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const option = (name) => {
    const at = args.indexOf(`--${name}`);
    return at === -1 ? undefined : args[at + 1];
  };
  const port = Number(option('port') ?? 4700);
  const country = option('country');
  const open = !args.includes('--closed');
  const server = await startDevServer({ port, country, open, root: option('root') ?? undefined });
  console.log(`Serving the built store and the functions in api/ at http://localhost:${server.port}`);
  console.log(`Country header: ${country ?? 'the browser\'s own (none)'}. Store: ${open ? 'open' : 'closed'}.`);
}
