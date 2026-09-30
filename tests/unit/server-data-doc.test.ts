import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEMO_EMAIL_DOMAINS } from '../../src/demo/email-domains';
import { parseDomainList } from '../../src/engine/email-domain';
import { leadHandler, visitorKey } from '../../src/server/lead';
import { DATABASE_TOKEN_SETTING, DATABASE_URL_SETTING, MEMORY_STORE_SETTING, liveDependencies, liveOrderDependencies } from '../../src/server/live';
import { createMemoryStore } from '../../src/server/memory-store';
import { orderHandler } from '../../src/server/order';
import { IDEMPOTENCY_KEY_PREFIX, LEAD_KEY_PREFIX, ORDER_KEY_PREFIX, RATE_LIMIT_KEY_PREFIX } from '../../src/server/store';
import { createUpstashStore, type RedisCommands, type RedisTransaction } from '../../src/server/upstash-store';
import { LEAD_ATTEMPTS_PER_HOUR, LEAD_RECORD_LIFETIME_DAYS, ORDER_ATTEMPTS_PER_HOUR, ORDER_RECORD_LIFETIME_DAYS } from '../../src/store/policy';
import { tableUnderHeading } from '../helpers/markdown';

// docs/server-data.md says what the server keeps in its database, and what is sent to it. These tests run the code that keeps
// and sends it, and read that page, so a key, a field, a command, an expiry or a setting cannot change, or be added, without
// the page saying so.

const root = fileURLToPath(new URL('../../', import.meta.url));
const doc = readFileSync(join(root, 'docs', 'server-data.md'), 'utf8');
const readme = readFileSync(join(root, 'README.md'), 'utf8');

const kept = tableUnderHeading(doc, '## What is kept'); // key, the rest of the name, what it holds, fields, expires, why
const commands = tableUnderHeading(doc, '## What is sent to the database'); // command, sent when, why
const settings = tableUnderHeading(doc, '## Where the settings live'); // setting, what it is

const OPEN = { PUBLIC_STORE_OPEN: 'true' };
const ADDRESS = '203.0.113.7';
const GOOD = { firstName: 'Maya', email: 'maya@example.com', marketing: true, source: 'auto', website: '' };
const GOOD_ORDER = {
  lines: [{ sku: 'SI-TEE-002', colour: 'Paper', size: 'XS', quantity: 1 }],
  currency: 'CAD',
  shippingMethod: 'standard',
  contact: { email: 'liam.okafor@example.com', phone: '+1 416 555 0117' },
  address: { country: 'CA', firstName: 'Liam', lastName: 'Okafor', address1: '310 Alder Street', city: 'Toronto', province: 'ON', postalCode: 'M6K 2P8' },
  payment: { brand: 'Visa', last4: '4242' },
  idempotencyKey: 'attempt-1',
};

/** Every .ts file directly in a folder of the repository, without its comments, so a comment can say what it likes. */
function codeIn(folder: string): { file: string; code: string }[] {
  return readdirSync(join(root, folder))
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({
      file: `${folder}/${name}`,
      code: readFileSync(join(root, folder, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''),
    }));
}

/** A client that writes down every command it is asked to send, in order, and answers as if all went well. */
function recordingClient() {
  const sent: string[] = [];
  const fields: string[][] = [];
  const redis: RedisCommands = {
    multi() {
      sent.push('MULTI');
      const transaction: RedisTransaction = {
        incr: () => (sent.push('INCR'), transaction),
        expire: () => (sent.push('EXPIRE'), transaction),
        hset: (_key, values) => (sent.push('HSET'), fields.push(Object.keys(values)), transaction),
        exec: async () => (sent.push('EXEC'), [1, 1]),
      };
      return transaction;
    },
    async hgetall() {
      sent.push('HGETALL');
      return null;
    },
  };
  return { redis, sent, fields };
}

/** One lead sent through the real handler to a store in memory: what is kept, and for how long. */
async function keepOneLead() {
  let clock = Date.UTC(2026, 8, 25, 12, 30, 0);
  const store = createMemoryStore(() => clock);
  const handler = leadHandler(OPEN, () => ({
    store,
    mailServiceOf: async () => 'accepts-mail',
    disposableDomains: parseDomainList('mailinator.com\n'),
    exemptDomains: DEMO_EMAIL_DOMAINS,
    secret: 'a-secret-for-the-test',
    now: () => clock,
    newId: () => 'a'.repeat(32),
  }));
  await handler(new Request('https://example.test/api/lead', { method: 'POST', headers: { 'x-forwarded-for': ADDRESS }, body: JSON.stringify({ ...GOOD, country: 'CA', ip: ADDRESS }) }));
  return { store, keys: store.keys(), now: clock };
}

/** One order placed through the real handler to a store in memory: what is kept, and for how long. */
async function keepOneOrder() {
  let clock = Date.UTC(2026, 8, 25, 12, 30, 0);
  const store = createMemoryStore(() => clock);
  const handler = orderHandler(OPEN, () => ({
    store,
    now: () => clock,
    newOrderToken: () => 'b'.repeat(32),
    newOrderNumber: () => 'SI-ABCD1234',
    secret: 'a-secret-for-the-test',
  }));
  await handler(new Request('https://example.test/api/order', { method: 'POST', headers: { 'x-forwarded-for': ADDRESS }, body: JSON.stringify(GOOD_ORDER) }));
  return { store, keys: store.keys(), now: clock };
}

describe('the keys the page lists, and the keys the code writes', () => {
  const tagOf = (cell: string) => cell.match(/^`([a-z-]+:)<[a-z]+>`$/)?.[1];

  it('lists every tag the code names its keys with, and no other', () => {
    const listed = kept.map(([key]) => tagOf(key));
    expect(listed.every((tag) => tag !== undefined), 'each key is written as `tag:<id>`').toBe(true);
    expect([...listed].sort()).toEqual([LEAD_KEY_PREFIX, RATE_LIMIT_KEY_PREFIX, ORDER_KEY_PREFIX, IDEMPOTENCY_KEY_PREFIX].sort());
  });

  it('lists the tags of the keys that really are written when a lead is kept', async () => {
    const { keys } = await keepOneLead();
    const written = keys.map((key) => key.match(/^[a-z-]+:/)![0]);
    expect([...new Set(written)].sort()).toEqual([LEAD_KEY_PREFIX, RATE_LIMIT_KEY_PREFIX].sort());
  });

  it('lists the tags of the keys that really are written when an order is placed', async () => {
    const { keys } = await keepOneOrder();
    const written = keys.map((key) => key.match(/^[a-z-]+:/)![0]);
    expect([...new Set(written)].sort()).toEqual([ORDER_KEY_PREFIX, RATE_LIMIT_KEY_PREFIX, IDEMPOTENCY_KEY_PREFIX].sort());
  });

  it('writes no tag, across both forms, that the page does not list, and leaves none of the page\'s tags unwritten', async () => {
    const lead = (await keepOneLead()).keys.map((key) => key.match(/^[a-z-]+:/)![0]);
    const order = (await keepOneOrder()).keys.map((key) => key.match(/^[a-z-]+:/)![0]);
    expect([...new Set([...lead, ...order])].sort()).toEqual(kept.map(([key]) => tagOf(key)).sort());
  });

  it('leaves the naming of keys to one file, so no other file in the server builds a key with a tag of its own', () => {
    const found: string[] = [];
    for (const { file, code } of codeIn('src/server')) {
      if (file.endsWith('/store.ts')) continue;
      for (const match of code.matchAll(/(['"`])[a-z][a-z0-9-]*:(?:\1|\$\{)/g)) found.push(`${file}: ${match[0]}`);
    }
    expect(found).toEqual([]);
  });

  it('says how long the ids are, as they are made', async () => {
    const lead = kept.find(([key]) => tagOf(key) === LEAD_KEY_PREFIX)!;
    const counter = kept.find(([key]) => tagOf(key) === RATE_LIMIT_KEY_PREFIX)!;
    const order = kept.find(([key]) => tagOf(key) === ORDER_KEY_PREFIX)!;
    expect(liveDependencies({}).newId()).toMatch(/^[0-9a-f]{32}$/);
    expect(lead[1]).toContain('32 random hexadecimal characters');
    expect(visitorKey(ADDRESS, 'a-secret', Date.now())).toMatch(/^rl:[0-9a-f]{64}$/);
    expect(counter[1]).toContain('64 hexadecimal characters');
    expect(liveOrderDependencies({}).newOrderToken()).toMatch(/^[0-9a-f]{32}$/);
    expect(order[1]).toContain('32 random hexadecimal characters');
  });
});

describe('the fields of a lead', () => {
  it('are the ones the page lists, in the request that keeps a lead, and no others', async () => {
    const { redis, fields } = recordingClient();
    await createUpstashStore(redis).saveLead('a', { firstName: 'Maya', email: 'maya@example.com', marketing: true, source: 'auto', createdAt: '2026-09-25T12:30:00.000Z' }, 60);
    const listed = kept.find(([key]) => key.startsWith('`lead:'))![3].split(',').map((name) => name.replace(/`/g, '').trim());
    expect(fields).toHaveLength(1);
    expect([...fields[0]].sort()).toEqual([...listed].sort());
  });

  it('are all a lead holds, whatever else the request carried, so what the page says is never kept is not', async () => {
    const { store, keys } = await keepOneLead();
    const lead = keys.find((key) => key.startsWith(LEAD_KEY_PREFIX))!;
    const record = await store.readLead(lead.slice(LEAD_KEY_PREFIX.length));
    const listed = kept.find(([key]) => key.startsWith('`lead:'))![3].split(',').map((name) => name.replace(/`/g, '').trim());
    expect(Object.keys(record!).sort()).toEqual([...listed].sort());
    expect(JSON.stringify(record)).not.toContain(ADDRESS);
  });
});

describe('the field of an order, and of an idempotency attempt', () => {
  it('are the one field the page lists, in the request that keeps each, and no others', async () => {
    const { store: memory, keys } = await keepOneOrder();
    const orderRecord = (await memory.readOrder(keys.find((key) => key.startsWith(ORDER_KEY_PREFIX))!.slice(ORDER_KEY_PREFIX.length)))!;
    const { redis, fields } = recordingClient();
    const store = createUpstashStore(redis);
    await store.saveOrder('tok', orderRecord, 60);
    await store.saveIdempotencyKey('attempt-1', 'tok', 60);
    const fieldNameOf = (tag: string) => kept.find(([key]) => key.startsWith(tag))![3].match(/^`([a-z]+)`/)![1];
    expect(fields).toEqual([[fieldNameOf('`order:')], [fieldNameOf('`idem:')]]);
  });

  it('is never anything about the card beyond the brand and last four digits, whatever else the request carried', async () => {
    const { store, keys } = await keepOneOrder();
    const order = keys.find((key) => key.startsWith(ORDER_KEY_PREFIX))!;
    const record = await store.readOrder(order.slice(ORDER_KEY_PREFIX.length));
    expect(Object.keys(record!.payment).sort()).toEqual(['brand', 'last4']);
    expect(JSON.stringify(record)).not.toMatch(/securityCode|expiry|4242.*4242.*4242/i);
  });
});

describe('how long things are kept', () => {
  it('says the numbers of seconds the code really gives a lead and a counter, and the days and tries the store\'s rules name', async () => {
    const { store, keys } = await keepOneLead();
    const lead = keys.find((key) => key.startsWith(LEAD_KEY_PREFIX))!;
    const counter = keys.find((key) => key.startsWith(RATE_LIMIT_KEY_PREFIX))!;
    const leadRow = kept.find(([key]) => key.startsWith('`lead:'))!;
    const counterRow = kept.find(([key]) => key.startsWith('`rl:'))!;
    expect(leadRow[4]).toContain(`${LEAD_RECORD_LIFETIME_DAYS} days (${store.secondsLeft(lead)} seconds)`);
    expect(counterRow[4]).toContain(`1 hour (${store.secondsLeft(counter)} seconds)`);
    expect(commands.map(([, when]) => when).join(' ')).toContain(`(${store.secondsLeft(counter)} seconds)`);
    expect(commands.map(([, when]) => when).join(' ')).toContain(`(${store.secondsLeft(lead)} seconds)`);
    expect(counterRow[5]).toContain(`limit of ${LEAD_ATTEMPTS_PER_HOUR} tries an hour`);
  });

  it('says the numbers of seconds the code really gives an order and an idempotency attempt, and the days and tries the store\'s rules name', async () => {
    const { store, keys } = await keepOneOrder();
    const order = keys.find((key) => key.startsWith(ORDER_KEY_PREFIX))!;
    const idem = keys.find((key) => key.startsWith(IDEMPOTENCY_KEY_PREFIX))!;
    const orderRow = kept.find(([key]) => key.startsWith('`order:'))!;
    const idemRow = kept.find(([key]) => key.startsWith('`idem:'))!;
    expect(orderRow[4]).toContain(`${ORDER_RECORD_LIFETIME_DAYS} days (${store.secondsLeft(order)} seconds)`);
    expect(idemRow[4]).toContain(`${ORDER_RECORD_LIFETIME_DAYS} days (${store.secondsLeft(idem)} seconds)`);
    expect(doc).toContain(`limit of ${ORDER_ATTEMPTS_PER_HOUR}`);
  });

  it('says the seven days on this page as the browser-storage page says them for records on the server', () => {
    const storage = readFileSync(join(root, 'docs', 'browser-storage.md'), 'utf8');
    expect(storage).toContain(`${LEAD_RECORD_LIFETIME_DAYS} days`);
    expect(doc).toContain(`${LEAD_RECORD_LIFETIME_DAYS} days`);
  });
});

describe('the commands sent to the database', () => {
  it('are the ones the page lists, and no others, across everything the store does with a lead, an order and an idempotency attempt', async () => {
    const { redis, sent } = recordingClient();
    const store = createUpstashStore(redis);
    await store.increment('rl:a', 3600);
    await store.saveLead('a', { firstName: 'Maya', email: 'maya@example.com', marketing: false, source: 'manual', createdAt: '2026-09-25T12:30:00.000Z' }, 60);
    await store.readLead('a');
    const oneOrder = await keepOneOrder();
    const orderRecord = (await oneOrder.store.readOrder(oneOrder.keys.find((key) => key.startsWith(ORDER_KEY_PREFIX))!.slice(ORDER_KEY_PREFIX.length)))!;
    await store.saveOrder('tok', orderRecord, 60);
    await store.readOrder('tok');
    await store.saveIdempotencyKey('attempt-1', 'tok', 60);
    await store.readIdempotencyKey('attempt-1');
    const listed = commands.flatMap(([command]) => [...command.matchAll(/`([A-Z]+)`/g)].map((match) => match[1]));
    expect([...new Set(sent)].sort()).toEqual([...new Set(listed)].sort());
  });

  it('are sent by one file, the only one that names the database\'s client', () => {
    const importers: string[] = [];
    const walk = (directory: string) => {
      for (const name of readdirSync(directory)) {
        const full = join(directory, name);
        if (statSync(full).isDirectory()) {
          if (name !== 'node_modules') walk(full);
        } else if (/\.(ts|astro|mjs)$/.test(name) && readFileSync(full, 'utf8').match(/from\s+'@upstash\/redis'/)) {
          importers.push(relative(root, full).replace(/\\/g, '/'));
        }
      }
    };
    for (const folder of ['src', 'api', 'scripts']) walk(join(root, folder));
    expect(importers).toEqual(['src/server/upstash-store.ts']);
    expect(doc).toContain('`src/server/upstash-store.ts`');
  });
});

describe('the settings', () => {
  it('are the three the code reads, and no others', () => {
    const listed = settings.map(([setting]) => setting.replace(/`/g, ''));
    expect([...listed].sort()).toEqual([DATABASE_URL_SETTING, DATABASE_TOKEN_SETTING, MEMORY_STORE_SETTING].sort());
  });
});

describe('the page as a page', () => {
  it('links only to https pages, and says on which day it read the pages it cites about copies and backups', () => {
    const links = [...doc.matchAll(/\]\((https?:[^)\s]+)\)/g)].map((match) => match[1]);
    expect(links.length).toBeGreaterThan(2);
    for (const link of links) expect(link.startsWith('https://'), link).toBe(true);
    expect(doc).toMatch(/read on \d{4}-\d{2}-\d{2}/);
    expect(doc).toContain('Not verified:');
  });

  it('is linked from the README, and its links to other pages point at files that exist', () => {
    expect(readme).toContain('(docs/server-data.md)');
    for (const match of doc.matchAll(/\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g)) {
      expect(existsSync(join(dirname(join(root, 'docs', 'server-data.md')), match[1])), match[1]).toBe(true);
    }
  });

  it('says what is never kept, and names the address on the network, the browser, cookies and card numbers', () => {
    const never = doc.slice(doc.indexOf('## What is never kept'), doc.indexOf('## When something goes wrong'));
    for (const word of ['address on the network', 'browser', 'cookies', 'Card numbers', 'log']) expect(never, word).toContain(word);
  });
});
