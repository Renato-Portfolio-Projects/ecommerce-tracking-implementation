import { describe, expect, it } from 'vitest';
import { priceOrder } from '../../src/engine/pricing';
import { createRedis, createUpstashStore, type RedisCommands, type RedisTransaction } from '../../src/server/upstash-store';
import type { LeadRecord, OrderRecord } from '../../src/server/store';

const RECORD: LeadRecord = {
  firstName: 'Maya',
  email: 'maya@example.com',
  marketing: true,
  source: 'auto',
  createdAt: '2026-09-25T12:30:00.000Z',
};
const WEEK = 7 * 24 * 60 * 60;

const priced = priceOrder({
  lines: [{ sku: 'SI-TEE-002', colour: 'Paper', size: 'XS', quantity: 1 }],
  currency: 'CAD',
  shippingMethod: 'standard',
  destination: { country: 'CA', province: 'ON' },
});
if (!priced.ok) throw new Error('the fixture order does not price');
const ORDER: OrderRecord = {
  orderNumber: 'SI-ABCD1234',
  order: priced.order,
  contact: { email: 'liam.okafor@example.com', phone: '+1 416 555 0117' },
  address: { country: 'CA', firstName: 'Liam', lastName: 'Okafor', address1: '310 Alder Street', city: 'Toronto', province: 'ON', postalCode: 'M6K 2P8' },
  payment: { brand: 'Visa', last4: '4242' },
  createdAt: '2026-09-25T12:30:00.000Z',
};

/**
 * A client that records, in order, every command it is asked to send, and answers from a small database of its own,
 * so a test can see exactly what would go to Upstash, and that a lead written can be read back.
 */
function fakeRedis(overrides: { exec?: () => Promise<unknown[]>; hgetall?: () => Promise<Record<string, unknown> | unknown[] | null> } = {}) {
  const sent: string[] = [];
  const hashes = new Map<string, Record<string, string>>();
  const redis: RedisCommands = {
    multi() {
      sent.push('MULTI');
      const queued: (() => void)[] = [];
      const transaction: RedisTransaction = {
        incr(key) {
          sent.push(`INCR ${key}`);
          return transaction;
        },
        expire(key, seconds) {
          sent.push(`EXPIRE ${key} ${seconds}`);
          return transaction;
        },
        hset(key, fields) {
          sent.push(`HSET ${key} ${JSON.stringify(fields)}`);
          queued.push(() => hashes.set(key, { ...fields }));
          return transaction;
        },
        async exec() {
          sent.push('EXEC');
          if (overrides.exec) return overrides.exec();
          queued.forEach((run) => run());
          return [1, 1];
        },
      };
      return transaction;
    },
    async hgetall(key) {
      sent.push(`HGETALL ${key}`);
      if (overrides.hgetall) return overrides.hgetall();
      return hashes.get(key) ?? null;
    },
  };
  return { redis, sent };
}

describe('counting a visitor\'s tries', () => {
  it('sends the increase and the expiry together, as one transaction, and nothing else', async () => {
    const { redis, sent } = fakeRedis();
    await createUpstashStore(redis).increment('rl:abc', 3600);
    expect(sent).toEqual(['MULTI', 'INCR rl:abc', 'EXPIRE rl:abc 3600', 'EXEC']);
  });

  it('gives back the new count that the store answered with', async () => {
    const { redis } = fakeRedis({ exec: async () => [7, 1] });
    expect(await createUpstashStore(redis).increment('rl:abc', 3600)).toBe(7);
  });

  it('refuses an answer that is not a count, rather than counting on it', async () => {
    for (const bad of [[], ['3', 1], [null, 1], [{}, 1]]) {
      const { redis } = fakeRedis({ exec: async () => bad });
      await expect(createUpstashStore(redis).increment('rl:abc', 3600), JSON.stringify(bad)).rejects.toThrow('not a count');
    }
  });
});

describe('keeping a lead', () => {
  it('sends the five fields as text, and the expiry, together as one transaction, and nothing else', async () => {
    const { redis, sent } = fakeRedis();
    await createUpstashStore(redis).saveLead('abc123', RECORD, WEEK);
    expect(sent).toEqual([
      'MULTI',
      `HSET lead:abc123 ${JSON.stringify({
        firstName: 'Maya',
        email: 'maya@example.com',
        marketing: 'true',
        source: 'auto',
        createdAt: '2026-09-25T12:30:00.000Z',
      })}`,
      'EXPIRE lead:abc123 604800',
      'EXEC',
    ]);
  });

  it('sends the marketing box as the text false when it was not ticked', async () => {
    const { redis, sent } = fakeRedis();
    await createUpstashStore(redis).saveLead('abc', { ...RECORD, marketing: false, source: 'manual' }, WEEK);
    expect(sent[1]).toContain('"marketing":"false"');
    expect(sent[1]).toContain('"source":"manual"');
  });

  it('sends only what the record holds, so a field that was never in a lead cannot be sent', async () => {
    const { redis, sent } = fakeRedis();
    await createUpstashStore(redis).saveLead('abc', { ...RECORD, ip: '203.0.113.7', country: 'CA' } as LeadRecord, WEEK);
    const fields = JSON.parse(sent[1].replace('HSET lead:abc ', '')) as Record<string, string>;
    expect(Object.keys(fields).sort()).toEqual(['createdAt', 'email', 'firstName', 'marketing', 'source']);
  });

  it('is not kept, and is not answered as kept, when the store refuses', async () => {
    const { redis } = fakeRedis({ exec: async () => Promise.reject(new Error('the store refused')) });
    await expect(createUpstashStore(redis).saveLead('abc', RECORD, WEEK)).rejects.toThrow('the store refused');
  });
});

describe('reading a lead back', () => {
  it('sends only the one read, and gives the lead as it was kept', async () => {
    const { redis, sent } = fakeRedis();
    const store = createUpstashStore(redis);
    await store.saveLead('abc', RECORD, WEEK);
    sent.length = 0;
    expect(await store.readLead('abc')).toEqual(RECORD);
    expect(sent).toEqual(['HGETALL lead:abc']);
  });

  it('keeps a name made only of digits as a name, since every value is text from start to end', async () => {
    const { redis } = fakeRedis();
    const store = createUpstashStore(redis);
    await store.saveLead('abc', { ...RECORD, firstName: '1234' }, WEEK);
    expect((await store.readLead('abc'))?.firstName).toBe('1234');
  });

  it('understands the flat list of names and values that Upstash gives, in any order', async () => {
    const list = ['source', 'manual', 'createdAt', '2026-09-25T12:30:00.000Z', 'email', 'maya@example.com', 'marketing', 'true', 'firstName', 'Maya'];
    const { redis } = fakeRedis({ hgetall: async () => list });
    expect(await createUpstashStore(redis).readLead('x')).toEqual({ ...RECORD, source: 'manual', marketing: true });
  });

  it('says there is none for a flat list that is cut short, or is empty, even when every field of a lead is there before the cut', async () => {
    const whole = ['firstName', 'Maya', 'email', 'maya@example.com', 'marketing', 'false', 'source', 'auto', 'createdAt', '2026-09-25T12:30:00.000Z'];
    for (const list of [[], ['firstName'], ['firstName', 'Maya', 'email'], [...whole, 'extra']]) {
      const { redis } = fakeRedis({ hgetall: async () => list });
      expect(await createUpstashStore(redis).readLead('x'), JSON.stringify(list)).toBeUndefined();
    }
  });

  it('says there is none when there is none, however the store says it', async () => {
    for (const nothing of [null, {}]) {
      const { redis } = fakeRedis({ hgetall: async () => nothing });
      expect(await createUpstashStore(redis).readLead('gone'), JSON.stringify(nothing)).toBeUndefined();
    }
  });

  it('says there is none when what is held is not a lead the way this code writes one', async () => {
    const good = { firstName: 'Maya', email: 'maya@example.com', marketing: 'true', source: 'auto', createdAt: '2026-09-25T12:30:00.000Z' };
    const broken: Record<string, unknown>[] = [
      { ...good, firstName: undefined },
      { ...good, email: 5 },
      { ...good, createdAt: undefined },
      { ...good, source: 'elsewhere' },
      { ...good, marketing: 'yes' },
      { ...good, marketing: true },
      { ...good, marketing: undefined },
    ];
    for (const held of broken) {
      const { redis } = fakeRedis({ hgetall: async () => held });
      expect(await createUpstashStore(redis).readLead('x'), JSON.stringify(held)).toBeUndefined();
    }
  });

  it('ignores anything extra that is held, and gives only the five fields', async () => {
    const held = { firstName: 'Maya', email: 'maya@example.com', marketing: 'false', source: 'manual', createdAt: '2026-09-25T12:30:00.000Z', extra: 'x' };
    const { redis } = fakeRedis({ hgetall: async () => held });
    expect(await createUpstashStore(redis).readLead('x')).toEqual({ ...RECORD, marketing: false, source: 'manual' });
  });
});

describe('keeping an order', () => {
  it('sends the whole order as one JSON field, and the expiry, together as one transaction, and nothing else', async () => {
    const { redis, sent } = fakeRedis();
    await createUpstashStore(redis).saveOrder('tok', ORDER, WEEK);
    expect(sent).toEqual(['MULTI', `HSET order:tok ${JSON.stringify({ data: JSON.stringify(ORDER) })}`, 'EXPIRE order:tok 604800', 'EXEC']);
  });

  it('is not kept, and is not answered as kept, when the store refuses', async () => {
    const { redis } = fakeRedis({ exec: async () => Promise.reject(new Error('the store refused')) });
    await expect(createUpstashStore(redis).saveOrder('tok', ORDER, WEEK)).rejects.toThrow('the store refused');
  });
});

describe('reading an order back', () => {
  it('sends only the one read, and gives the order as it was kept', async () => {
    const { redis, sent } = fakeRedis();
    const store = createUpstashStore(redis);
    await store.saveOrder('tok', ORDER, WEEK);
    sent.length = 0;
    expect(await store.readOrder('tok')).toEqual(ORDER);
    expect(sent).toEqual(['HGETALL order:tok']);
  });

  it('says there is none when there is none, however the store says it', async () => {
    for (const nothing of [null, {}]) {
      const { redis } = fakeRedis({ hgetall: async () => nothing });
      expect(await createUpstashStore(redis).readOrder('gone'), JSON.stringify(nothing)).toBeUndefined();
    }
  });

  it('says there is none when the field is missing, is not text, or is not JSON that shapes up as an order', async () => {
    for (const held of [{}, { data: 5 }, { data: 'not json' }, { data: '"just a string"' }, { data: '{}' }, { data: JSON.stringify({ ...ORDER, order: undefined }) }]) {
      const { redis } = fakeRedis({ hgetall: async () => held });
      expect(await createUpstashStore(redis).readOrder('x'), JSON.stringify(held)).toBeUndefined();
    }
  });
});

describe('an idempotency attempt', () => {
  it('sends the order token as one field, and the expiry, together as one transaction, and nothing else', async () => {
    const { redis, sent } = fakeRedis();
    await createUpstashStore(redis).saveIdempotencyKey('attempt-1', 'tok', WEEK);
    expect(sent).toEqual(['MULTI', 'HSET idem:attempt-1 {"token":"tok"}', 'EXPIRE idem:attempt-1 604800', 'EXEC']);
  });

  it('reads the order token back, or nothing when there is none', async () => {
    const { redis } = fakeRedis();
    const store = createUpstashStore(redis);
    await store.saveIdempotencyKey('attempt-1', 'tok', WEEK);
    expect(await store.readIdempotencyKey('attempt-1')).toBe('tok');
    expect(await store.readIdempotencyKey('never-sent')).toBeUndefined();
  });
});

describe('a store that does not answer', () => {
  const never = () => new Promise<never>(() => {});

  it('gives up after the limit, for each kind of call, so a visitor is never held up by it', async () => {
    const store = createUpstashStore(fakeRedis({ exec: never, hgetall: never }).redis, 30);
    const calls = [
      () => store.increment('rl:a', 60),
      () => store.saveLead('a', RECORD, WEEK),
      () => store.readLead('a'),
      () => store.saveOrder('a', ORDER, WEEK),
      () => store.readOrder('a'),
      () => store.saveIdempotencyKey('a', 'tok', WEEK),
      () => store.readIdempotencyKey('a'),
    ];
    for (const call of calls) {
      const started = Date.now();
      await expect(call()).rejects.toThrow('took too long');
      expect(Date.now() - started).toBeLessThan(1000);
    }
  });

  it('answers as soon as the store does, not after the limit', async () => {
    const started = Date.now();
    await createUpstashStore(fakeRedis().redis, 5000).increment('rl:a', 60);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe('the real client', () => {
  it('is made without reaching the network, and has the calls the store uses', () => {
    const redis = createRedis('https://example-database.upstash.io', 'a-token-for-the-test');
    expect(typeof redis.multi).toBe('function');
    expect(typeof redis.hgetall).toBe('function');
  });
});
