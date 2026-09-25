import { afterEach, describe, expect, it, vi } from 'vitest';
import { welcomeCoupon } from '../../src/engine/coupons';
import { visitorKey } from '../../src/server/lead';
import { DATABASE_TOKEN_SETTING, DATABASE_URL_SETTING, MEMORY_STORE_SETTING, liveLeadHandler } from '../../src/server/live';
import type { DnsResolver } from '../../src/server/mail-service';
import type { RedisCommands } from '../../src/server/upstash-store';

const URL_VALUE = 'https://example-database.upstash.io';
const TOKEN = 'a-token-for-the-test';
const ADDRESS = '203.0.113.7';
const GOOD = { firstName: 'Maya', email: 'maya@example.com', marketing: false, source: 'auto', website: '' };
const code = welcomeCoupon()!.code;
const OPEN = { PUBLIC_STORE_OPEN: 'true' };
const WITH_DATABASE = { ...OPEN, [DATABASE_URL_SETTING]: URL_VALUE, [DATABASE_TOKEN_SETTING]: TOKEN };

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** A client for the database that records what it is asked, and a factory that records how it was made. */
function database() {
  const sent: string[] = [];
  const made: [string, string][] = [];
  const redis: RedisCommands = {
    multi() {
      sent.push('MULTI');
      const t = {
        incr: (key: string) => (sent.push(`INCR ${key}`), t),
        expire: (key: string, seconds: number) => (sent.push(`EXPIRE ${key} ${seconds}`), t),
        hset: (key: string, fields: Record<string, string>) => (sent.push(`HSET ${key} ${Object.keys(fields).join(',')}`), t),
        exec: async () => (sent.push('EXEC'), [1, 1]),
      };
      return t;
    },
    async hgetall() {
      return null;
    },
  };
  return {
    sent,
    made,
    factory: (url: string, token: string) => {
      made.push([url, token]);
      return redis;
    },
  };
}

const fault = (codeName: string) => Object.assign(new Error(codeName), { code: codeName });

/** A name system with a plan of its own, so no test asks the real one. */
const resolver = (mx: unknown): DnsResolver => ({
  resolveMx: async () => {
    if (mx instanceof Error) throw mx;
    return mx as never;
  },
  resolve4: async () => [],
  resolve6: async () => [],
});

const post = (handler: (request: Request) => Promise<Response>, body: unknown = GOOD) =>
  handler(new Request('https://example.test/api/lead', { method: 'POST', headers: { 'x-forwarded-for': ADDRESS }, body: JSON.stringify(body) }));

describe('the function with the database\'s settings', () => {
  it('makes the client for that address and key, once, and keeps a lead through it', async () => {
    const db = database();
    const handler = liveLeadHandler(WITH_DATABASE, { redis: db.factory, resolver: resolver([]) });
    const response = await post(handler);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, saved: true, code });
    await post(handler);
    await post(handler);
    expect(db.made).toEqual([[URL_VALUE, TOKEN]]);
  });

  it('sends, for a lead, exactly the counter and the lead, each with its expiry', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 8, 25, 12, 30, 0));
    const db = database();
    await post(liveLeadHandler(WITH_DATABASE, { redis: db.factory, resolver: resolver([]) }));
    const counter = `rl:${visitorKeyHash()}`;
    expect(db.sent).toHaveLength(8);
    expect(db.sent.slice(0, 4)).toEqual(['MULTI', `INCR ${counter}`, `EXPIRE ${counter} 3600`, 'EXEC']);
    expect(db.sent[4]).toBe('MULTI');
    expect(db.sent[5]).toMatch(/^HSET lead:[0-9a-f]{32} firstName,email,marketing,source,createdAt$/);
    expect(db.sent[6]).toMatch(/^EXPIRE lead:[0-9a-f]{32} 604800$/);
    expect(db.sent[7]).toBe('EXEC');
  });

  it('keys the hash of the visitor with the database\'s own key, so no other setting is needed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 8, 25, 12, 30, 0));
    const db = database();
    await post(liveLeadHandler(WITH_DATABASE, { redis: db.factory, resolver: resolver([]) }));
    expect(db.sent[1]).toBe(`INCR ${visitorKey(ADDRESS, TOKEN, Date.now())}`);
  });

  it('gives each lead an id of its own, as long as 32 hexadecimal characters', async () => {
    const db = database();
    const handler = liveLeadHandler(WITH_DATABASE, { redis: db.factory, resolver: resolver([]) });
    await post(handler);
    await post(handler);
    const ids = db.sent.filter((line) => line.startsWith('HSET')).map((line) => line.split(' ')[1]);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
    for (const id of ids) expect(id).toMatch(/^lead:[0-9a-f]{32}$/);
  });
});

describe('the function without the database\'s settings', () => {
  it('says it could not save, and does not pretend to, when neither setting is there', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await post(liveLeadHandler(OPEN, { resolver: resolver([]) }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: 'could not save' });
    expect(JSON.stringify(spy.mock.calls)).not.toContain('maya');
  });

  it('does the same when only one of the two settings is there', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const settings of [{ [DATABASE_URL_SETTING]: URL_VALUE }, { [DATABASE_TOKEN_SETTING]: TOKEN }, { [DATABASE_URL_SETTING]: '', [DATABASE_TOKEN_SETTING]: TOKEN }]) {
      const db = database();
      const response = await post(liveLeadHandler({ ...OPEN, ...settings }, { redis: db.factory, resolver: resolver([]) }));
      expect(response.status, JSON.stringify(settings)).toBe(503);
      expect(db.made).toEqual([]);
    }
  });

  it('keeps leads in memory when it is asked to, which is how the local server runs', async () => {
    const handler = liveLeadHandler({ ...OPEN, [MEMORY_STORE_SETTING]: 'true' }, { resolver: resolver([]) });
    const response = await post(handler);
    expect(response.status).toBe(200);
    expect((await response.json()) as { saved: boolean }).toMatchObject({ saved: true });
  });

  it('refuses to keep leads in memory on Vercel, where they would be lost while the visitor was told they were saved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await post(liveLeadHandler({ ...OPEN, [MEMORY_STORE_SETTING]: 'true', VERCEL: '1' }, { resolver: resolver([]) }));
    expect(response.status).toBe(503);
  });

  it('asks for the memory store only when the setting says exactly true', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const value of ['1', 'TRUE', 'yes', '']) {
      const response = await post(liveLeadHandler({ ...OPEN, [MEMORY_STORE_SETTING]: value }, { resolver: resolver([]) }));
      expect(response.status, value).toBe(503);
    }
  });

  it('uses the database rather than memory when both are available', async () => {
    const db = database();
    await post(liveLeadHandler({ ...WITH_DATABASE, [MEMORY_STORE_SETTING]: 'true' }, { redis: db.factory, resolver: resolver([]) }));
    expect(db.made).toHaveLength(1);
  });
});

describe('a store that is closed', () => {
  it('answers 404 and never makes the client, or looks anything up', async () => {
    const db = database();
    const handler = liveLeadHandler({ [DATABASE_URL_SETTING]: URL_VALUE, [DATABASE_TOKEN_SETTING]: TOKEN }, { redis: db.factory });
    const response = await post(handler);
    expect(response.status).toBe(404);
    expect(db.made).toEqual([]);
    expect(db.sent).toEqual([]);
  });
});

describe('the look-up and the list of temporary domains, as the function really has them', () => {
  it('turns away a domain on the real list of temporary domains, without asking the name system', async () => {
    const asked: string[] = [];
    const watching: DnsResolver = { resolveMx: async (d) => (asked.push(d), []), resolve4: async () => [], resolve6: async () => [] };
    const response = await post(liveLeadHandler(WITH_DATABASE, { redis: database().factory, resolver: watching }), { ...GOOD, email: 'maya@mailinator.com' });
    expect(response.status).toBe(400);
    expect(asked).toEqual([]);
  });

  it('turns away a domain that the name system says does not exist, and keeps an address whose domain takes mail', async () => {
    const db = database();
    const missing = liveLeadHandler(WITH_DATABASE, { redis: db.factory, resolver: resolver(fault('ENOTFOUND')) });
    expect((await post(missing, { ...GOOD, email: 'maya@no-such-domain.com' })).status).toBe(400);
    const takes = liveLeadHandler(WITH_DATABASE, { redis: db.factory, resolver: resolver([{ exchange: 'mx.example.net', priority: 10 }]) });
    expect((await post(takes, { ...GOOD, email: 'maya@shop.org' })).status).toBe(200);
  });

  it('lets an address through when the name system fails', async () => {
    const handler = liveLeadHandler(WITH_DATABASE, { redis: database().factory, resolver: resolver(fault('ESERVFAIL')) });
    expect((await post(handler, { ...GOOD, email: 'maya@shop.org' })).status).toBe(200);
  });
});

/** The hash for the counter as the handler makes it, for the time the test has set. */
function visitorKeyHash(): string {
  return visitorKey(ADDRESS, TOKEN, Date.now()).slice('rl:'.length);
}
