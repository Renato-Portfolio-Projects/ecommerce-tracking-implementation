// Tries the real database once, by hand: keeps one demo lead, reads it back, checks how long it has left, counts two
// tries, and deletes all of it. Run it with `npm run smoke:lead`.
//
// It needs the two settings that Vercel gives a Preview, KV_REST_API_URL and KV_REST_API_TOKEN, in a file called
// .env.local at the top of the repository. That file is not kept in git, and it holds a key that allows writing to the
// database, so it is never pasted, printed or shared. This script prints results only, never a setting, and it does
// not print an error's own text, which could carry the database's address.
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const WEEK = 7 * 24 * 60 * 60;
const HOUR = 60 * 60;

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;
if (!url || !token) {
  console.log('The two settings, KV_REST_API_URL and KV_REST_API_TOKEN, are not both set. Put them in .env.local and run `npm run smoke:lead`.');
  process.exit(1);
}

let failures = 0;
const check = (name, ok) => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
};

// The store's own code is TypeScript, so it is bundled into a temporary file first, the way the local server does.
const work = mkdtempSync(join(tmpdir(), 'second-impression-smoke-'));
const outfile = join(work, 'store.mjs');
await build({
  stdin: {
    contents: "export * from './src/server/upstash-store.ts'; export * from './src/server/store.ts';",
    resolveDir: ROOT,
    loader: 'ts',
  },
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  logLevel: 'silent',
});
const { createRedis, createUpstashStore, leadKey } = await import(pathToFileURL(outfile).href);

const redis = createRedis(url, token);
const store = createUpstashStore(redis);
const id = `smoke-${randomBytes(6).toString('hex')}`;
const counter = `rl:smoke-${randomBytes(6).toString('hex')}`;
const key = leadKey(id);
const record = { firstName: 'Maya', email: 'maya@example.com', marketing: false, source: 'manual', createdAt: new Date().toISOString() };

try {
  await store.saveLead(id, record, WEEK);
  check('a demo lead is kept', true);

  const back = await store.readLead(id);
  check('it reads back exactly as it was kept', JSON.stringify(back) === JSON.stringify(record));

  // The client gives a hash back as a flat list of names and values, since nothing is converted on the way.
  const list = (await redis.hgetall(key)) ?? [];
  const held = Array.isArray(list) ? Object.fromEntries(Array.from({ length: list.length / 2 }, (_, i) => [list[2 * i], list[2 * i + 1]])) : list;
  check('what is held is exactly the five fields, all as text', Object.keys(held).sort().join() === 'createdAt,email,firstName,marketing,source' && Object.values(held).every((value) => typeof value === 'string'));

  const left = await redis.ttl(key);
  check(`it expires by itself, in 7 days or less (${Math.round(left / 3600)} hours left)`, left > WEEK - 120 && left <= WEEK);

  const first = await store.increment(counter, HOUR);
  const second = await store.increment(counter, HOUR);
  check('a counter counts 1, then 2', first === 1 && second === 2);

  const counterLeft = await redis.ttl(counter);
  check(`the counter expires by itself, in an hour or less (${Math.round(counterLeft / 60)} minutes left)`, counterLeft > HOUR - 120 && counterLeft <= HOUR);
} catch (error) {
  failures += 1;
  console.log(`FAIL  the database could not be used (${error instanceof Error ? error.name : typeof error}). Check the two settings in .env.local.`);
} finally {
  try {
    await redis.del(key, counter);
    check('the demo lead and the counter are deleted again', (await store.readLead(id)) === undefined);
  } catch {
    failures += 1;
    console.log('FAIL  the demo lead and the counter could not be deleted. They expire by themselves, the lead in 7 days.');
  }
  rmSync(work, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAll good. The database keeps a lead, reads it back, and lets it expire.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
