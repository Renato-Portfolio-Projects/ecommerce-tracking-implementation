import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRedis, createUpstashStore } from '../../src/server/upstash-store';
import type { LeadRecord } from '../../src/server/store';
import { startFakeUpstash, type FakeUpstash } from '../helpers/fake-upstash';

// The real client, @upstash/redis, talking to a stand-in for Upstash's web interface over a real connection on this
// machine. Nothing else in the tests can say what actually goes over the wire, and this is the closest a test can come
// to the real database without using it: it reads off the requests the client really sends.

const RECORD: LeadRecord = {
  firstName: 'Maya',
  email: 'maya@example.com',
  marketing: false,
  source: 'auto',
  createdAt: '2026-09-25T12:30:00.000Z',
};
const WEEK = 7 * 24 * 60 * 60;

let fake: FakeUpstash;
beforeEach(async () => {
  fake = await startFakeUpstash();
});
afterEach(async () => {
  await fake.close();
});

const storeFor = (upstash: FakeUpstash, timeoutMs?: number) => createUpstashStore(createRedis(upstash.url, upstash.token), timeoutMs);
/** The commands of a request, with each command's name in capitals, as Redis reads them. */
const commands = (body: unknown): unknown[][] =>
  (body as unknown[][]).map(([name, ...rest]) => [String(name).toUpperCase(), ...rest]);

describe('counting a visitor\'s tries, with the real client', () => {
  it('sends one request, a transaction of the increase and the expiry, and nothing else', async () => {
    await storeFor(fake).increment('rl:abc', 3600);
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0].path).toBe('/multi-exec');
    expect(commands(fake.requests[0].body)).toEqual([['INCR', 'rl:abc'], ['EXPIRE', 'rl:abc', 3600]]);
  });

  it('counts up, and the expiry is set each time', async () => {
    const store = storeFor(fake);
    expect([await store.increment('rl:abc', 3600), await store.increment('rl:abc', 3600), await store.increment('rl:abc', 3600)]).toEqual([1, 2, 3]);
    expect(fake.expiries.get('rl:abc')).toBe(3600);
  });
});

describe('keeping and reading a lead, with the real client', () => {
  it('sends one request, a transaction of the five fields as text and the seven-day expiry, and nothing else', async () => {
    await storeFor(fake).saveLead('abc123', RECORD, WEEK);
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0].path).toBe('/multi-exec');
    expect(commands(fake.requests[0].body)).toEqual([
      ['HSET', 'lead:abc123', 'firstName', 'Maya', 'email', 'maya@example.com', 'marketing', 'false', 'source', 'auto', 'createdAt', '2026-09-25T12:30:00.000Z'],
      ['EXPIRE', 'lead:abc123', 604800],
    ]);
    expect(fake.expiries.get('lead:abc123')).toBe(WEEK);
  });

  it('reads it back exactly as kept, with one request for the one lead', async () => {
    const store = storeFor(fake);
    await store.saveLead('abc123', { ...RECORD, marketing: true, source: 'manual' }, WEEK);
    fake.requests.length = 0;
    expect(await store.readLead('abc123')).toEqual({ ...RECORD, marketing: true, source: 'manual' });
    expect(fake.requests).toHaveLength(1);
    expect(commands([fake.requests[0].body])).toEqual([['HGETALL', 'lead:abc123']]);
  });

  it('keeps every value as the text it was, so a name that is only digits, or looks like JSON, is not changed', async () => {
    const store = storeFor(fake);
    for (const firstName of ['1234', 'true', '{"a":1}', 'null', '0012', 'Zoë 😀']) {
      await store.saveLead('n', { ...RECORD, firstName }, WEEK);
      expect((await store.readLead('n'))?.firstName, firstName).toBe(firstName);
    }
  });

  it('says there is none for a lead that was never kept', async () => {
    expect(await storeFor(fake).readLead('nothing-here')).toBeUndefined();
  });

  it('holds exactly the five fields, and nothing else, whatever the record carried', async () => {
    await storeFor(fake).saveLead('abc', { ...RECORD, ip: '203.0.113.7' } as LeadRecord, WEEK);
    expect([...fake.hashes.get('lead:abc')!.keys()].sort()).toEqual(['createdAt', 'email', 'firstName', 'marketing', 'source']);
  });
});

describe('what the client says about itself', () => {
  it('sends the key to authorise, and nothing about where it runs or which client it is', async () => {
    await storeFor(fake).increment('rl:abc', 60);
    const headers = fake.requests[0].headers;
    expect(headers.authorization).toBe(`Bearer ${fake.token}`);
    expect(Object.keys(headers).filter((name) => name.startsWith('upstash-telemetry'))).toEqual([]);
  });

  it('does not put the key in the address or the body', async () => {
    const store = storeFor(fake);
    await store.increment('rl:abc', 60);
    await store.saveLead('abc', RECORD, WEEK);
    for (const request of fake.requests) {
      expect(request.path).not.toContain(fake.token);
      expect(JSON.stringify(request.body)).not.toContain(fake.token);
    }
  });
});

describe('a database that cannot be used', () => {
  it('refuses a wrong key, and does not say saved', async () => {
    const wrong = createUpstashStore(createRedis(fake.url, 'not-the-key'));
    await expect(wrong.saveLead('abc', RECORD, WEEK)).rejects.toThrow();
    await expect(wrong.increment('rl:abc', 60)).rejects.toThrow();
    expect(fake.hashes.size).toBe(0);
  });

  it('gives up within the limit when the database is not there at all, however long the client would keep trying', async () => {
    const gone = await startFakeUpstash();
    await gone.close();
    const store = storeFor(gone, 300);
    const started = Date.now();
    await expect(store.saveLead('abc', RECORD, WEEK)).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
