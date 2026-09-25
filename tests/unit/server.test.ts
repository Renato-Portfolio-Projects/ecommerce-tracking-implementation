import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CURRENCIES } from '../../src/store/currencies';
import { COUNTRY_HEADER, currencyHandler } from '../../src/server/currency';
import { storeIsOpen } from '../../src/server/gate';
import { answer, guarded, notFound } from '../../src/server/http';

const OPEN = { PUBLIC_STORE_OPEN: 'true' };
const request = (method = 'GET', headers: Record<string, string> = {}) => new Request('https://example.test/api/x', { method, headers });

afterEach(() => vi.restoreAllMocks());

describe('storeIsOpen, the gate every server function stands behind', () => {
  it('is open only for exactly "true", the same rule as the pages', () => {
    expect(storeIsOpen({ PUBLIC_STORE_OPEN: 'true' })).toBe(true);
    for (const value of ['TRUE', 'True', '1', 'yes', ' true', 'true ', '', 'false', undefined]) {
      expect(storeIsOpen({ PUBLIC_STORE_OPEN: value }), String(value)).toBe(false);
    }
    expect(storeIsOpen({})).toBe(false);
  });

  it('agrees with the switch that opens the pages, so the two can never disagree', async () => {
    const { isStoreOpen } = await import('../../scripts/store-pages.mjs');
    for (const value of ['true', 'TRUE', '1', '', undefined, 'false']) {
      expect(storeIsOpen({ PUBLIC_STORE_OPEN: value }), String(value)).toBe(isStoreOpen({ PUBLIC_STORE_OPEN: value }));
    }
  });
});

describe('answer and notFound', () => {
  it('give JSON that no shared cache may keep', async () => {
    for (const response of [answer({ a: 1 }), answer({ a: 1 }, 201), notFound(), answer({ b: 2 }, 405, { allow: 'GET' })]) {
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    }
    expect(await answer({ a: 1 }).json()).toEqual({ a: 1 });
  });

  it('say a missing function in the store\'s own words, so a deployment that ran can be told from one that never was', async () => {
    const response = notFound();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not found' });
  });
});

describe('guarded, the rules every function follows', () => {
  it('runs nothing and says 404 while the store is closed, whatever was asked', async () => {
    const work = vi.fn(() => answer({ ok: true }));
    for (const env of [{}, { PUBLIC_STORE_OPEN: 'false' }, { PUBLIC_STORE_OPEN: 'TRUE' }]) {
      const response = await guarded(env, ['GET'], work)(request());
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'not found' });
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    expect(work).not.toHaveBeenCalled();
  });

  it('reads the environment on every request, so opening the store needs no new deployment of the code', async () => {
    const env: Record<string, string | undefined> = {};
    const handler = guarded(env, ['GET'], () => answer({ ok: true }));
    expect((await handler(request())).status).toBe(404);
    env.PUBLIC_STORE_OPEN = 'true';
    expect((await handler(request())).status).toBe(200);
    env.PUBLIC_STORE_OPEN = 'false';
    expect((await handler(request())).status).toBe(404);
  });

  it('accepts only the methods it names, says which, and runs nothing for another', async () => {
    const work = vi.fn(() => answer({ ok: true }));
    const handler = guarded(OPEN, ['GET', 'POST'], work);
    for (const method of ['DELETE', 'PUT', 'PATCH']) {
      const response = await handler(request(method));
      expect(response.status, method).toBe(405);
      expect(response.headers.get('allow')).toBe('GET, POST');
      expect(await response.json()).toEqual({ error: 'method not allowed' });
    }
    expect(work).not.toHaveBeenCalled();
    expect((await handler(request('GET'))).status).toBe(200);
    expect((await handler(request('POST'))).status).toBe(200);
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('hands the request to the work and returns what it answers', async () => {
    const seen: string[] = [];
    const handler = guarded(OPEN, ['GET'], (incoming) => {
      seen.push(incoming.headers.get('x-test') ?? '');
      return answer({ hello: 'there' }, 201);
    });
    const response = await handler(request('GET', { 'x-test': 'marker' }));
    expect(seen).toEqual(['marker']);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ hello: 'there' });
  });

  it('marks an answer as not to be cached even when the work forgot to', async () => {
    const response = await guarded(OPEN, ['GET'], () => new Response('plain text'))(request());
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('plain text');
  });

  it('keeps a cache header the work chose for itself', async () => {
    const response = await guarded(OPEN, ['GET'], () => new Response('x', { headers: { 'cache-control': 'private, max-age=5' } }))(request());
    expect(response.headers.get('cache-control')).toBe('private, max-age=5');
  });

  it('turns a fault, thrown or from a promise, into a plain 500 that names nothing', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const secret = 'ana@example.com typed by a visitor';
    for (const work of [
      () => {
        throw new Error(secret);
      },
      async () => {
        throw new TypeError(secret);
      },
    ]) {
      const response = await guarded(OPEN, ['GET'], work)(request());
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'something went wrong' });
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    // An Error turns into {} when it is made into JSON, so each thing logged is written out with its name and its message.
    const logged = log.mock.calls.flat().map((thing) => (thing instanceof Error ? `${thing.name}: ${thing.message}` : String(thing))).join(' | ');
    expect(logged).not.toContain('ana@example.com');
    expect(logged).not.toContain('typed by a visitor');
    expect(logged).toContain('Error');
    expect(logged).toContain('TypeError');
  });

  it('even copes with something thrown that is not an error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await guarded(OPEN, ['GET'], () => {
      throw 'a plain string';
    })(request());
    expect(response.status).toBe(500);
  });
});

describe('the currency function, /api/currency', () => {
  const ask = async (country: string | null, env: Record<string, string | undefined> = OPEN) => currencyHandler(env)(request('GET', country === null ? {} : { [COUNTRY_HEADER]: country }));
  const currencyFor = async (country: string | null) => ((await (await ask(country)).json()) as { currency: string }).currency;

  it('reads the country from the header Vercel adds', () => {
    expect(COUNTRY_HEADER).toBe('x-vercel-ip-country');
  });

  it('starts each kind of visitor in the currency the shop rules say', async () => {
    expect(await currencyFor('CA')).toBe('CAD');
    expect(await currencyFor('US')).toBe('USD');
    expect(await currencyFor('GB')).toBe('GBP');
    for (const euro of ['FR', 'DE', 'ES', 'IT', 'IE', 'NL', 'BG']) expect(await currencyFor(euro), euro).toBe('EUR');
    for (const other of ['JP', 'AU', 'BR', 'IN', 'CH', 'SE']) expect(await currencyFor(other), other).toBe('USD');
  });

  it('gives the fallback for a missing, empty or unrecognisable country, and copes with lower case', async () => {
    expect(await currencyFor(null)).toBe('USD');
    expect(await currencyFor('')).toBe('USD');
    expect(await currencyFor('ZZ')).toBe('USD');
    expect(await currencyFor('<script>alert(1)</script>')).toBe('USD');
    expect(await currencyFor('ca')).toBe('CAD');
  });

  it('answers only with a currency the store offers', async () => {
    const offered = CURRENCIES.map((currency) => currency.code) as string[];
    for (const country of ['CA', 'US', 'GB', 'FR', 'JP', '', 'ZZ']) expect(offered).toContain(await currencyFor(country));
  });

  it('answers with the currency alone: the country is used and dropped, never sent back', async () => {
    // The whole body is compared, so any extra field, such as the country, would fail. (A country code can also be
    // a piece of its currency's name, CA in CAD, so looking for the code in the text would prove nothing.)
    for (const [country, currency] of [['CA', 'CAD'], ['GB', 'GBP'], ['FR', 'EUR'], ['JP', 'USD'], ['', 'USD']]) {
      const text = await (await ask(country)).text();
      expect(text, country).toBe(JSON.stringify({ currency }));
    }
  });

  it('is marked not to be cached, since the answer depends on who asks', async () => {
    expect((await ask('CA')).headers.get('cache-control')).toBe('no-store');
  });

  it('answers only a GET, and only while the store is open', async () => {
    expect((await currencyHandler(OPEN)(request('POST', { [COUNTRY_HEADER]: 'CA' }))).status).toBe(405);
    expect((await ask('CA', {})).status).toBe(404);
    expect((await ask('CA', { PUBLIC_STORE_OPEN: 'false' })).status).toBe(404);
    expect((await ask('CA')).status).toBe(200);
  });
});

describe('the files in api/, which Vercel runs as functions', () => {
  const folder = new URL('../../api/', import.meta.url);
  const files = readdirSync(folder).filter((name) => name.endsWith('.ts'));

  it('has the currency function', () => {
    expect(files).toContain('currency.ts');
  });

  it('only hand the request to a handler in src/server, so none of the logic is out of reach of the tests', () => {
    for (const name of files) {
      const lines = readFileSync(new URL(name, folder), 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '' && !line.trim().startsWith('//'));
      expect(lines, name).toHaveLength(2);
      expect(lines[0], name).toMatch(/^import \{ \w+ \} from '\.\.\/src\/server\/[\w-]+';$/);
      expect(lines[1], name).toMatch(/^export default \{ fetch: \w+\(process\.env\) \};$/);
    }
  });
});
