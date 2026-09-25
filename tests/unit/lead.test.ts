import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_EMAIL_DOMAINS } from '../../src/demo/email-domains';
import { checkLead } from '../../src/engine/checkout-form';
import { welcomeCoupon } from '../../src/engine/coupons';
import { checkEmailDomain, parseDomainList, type MailService } from '../../src/engine/email-domain';
import { clientAddress, leadHandler, TRAP_FIELD, visitorKey, type LeadDependencies } from '../../src/server/lead';
import { createMemoryStore } from '../../src/server/memory-store';
import type { Store } from '../../src/server/store';
import { LEAD_ATTEMPTS_PER_HOUR, LEAD_RECORD_LIFETIME_DAYS } from '../../src/store/policy';

const OPEN = { PUBLIC_STORE_OPEN: 'true' };
const SECRET = 'a-secret-for-the-test';
const ADDRESS = '203.0.113.7';
const HOUR = 60 * 60 * 1000;
const GOOD = { firstName: 'Maya', email: 'maya@example.com', marketing: false, source: 'auto', [TRAP_FIELD]: '' };
const code = welcomeCoupon()!.code;

afterEach(() => vi.restoreAllMocks());

/** A handler wired to a store in memory, a look-up that says what it is told, a clock the test moves and ids it picks. */
function setup(overrides: Partial<LeadDependencies> = {}, env: Record<string, string | undefined> = OPEN) {
  let clock = Date.UTC(2026, 8, 25, 12, 30, 0);
  let ids = 0;
  const store = createMemoryStore(() => clock);
  const lookups: string[] = [];
  const service = { current: 'accepts-mail' as MailService };
  const dependencies: LeadDependencies = {
    store,
    mailServiceOf: async (domain) => {
      lookups.push(domain);
      return service.current;
    },
    disposableDomains: parseDomainList('mailinator.com\n'),
    exemptDomains: DEMO_EMAIL_DOMAINS,
    secret: SECRET,
    now: () => clock,
    newId: () => `id${(ids += 1)}`,
    ...overrides,
  };
  const handler = leadHandler(env, () => dependencies);
  const send = (body: unknown, headers: Record<string, string> = { 'x-forwarded-for': ADDRESS }, method = 'POST') =>
    handler(
      new Request('https://example.test/api/lead', {
        method,
        headers,
        ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
      }),
    );
  return { store, lookups, service, send, advance: (ms: number) => (clock += ms), now: () => clock };
}

const json = async (response: Response) => (await response.json()) as Record<string, unknown>;

describe('a lead that passes every check', () => {
  it('is kept, and the answer carries the welcome code and says it was saved', async () => {
    const t = setup();
    const response = await t.send(GOOD);
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ ok: true, saved: true, code });
    expect(await t.store.readLead('id1')).toEqual({
      firstName: 'Maya',
      email: 'maya@example.com',
      marketing: false,
      source: 'auto',
      createdAt: '2026-09-25T12:30:00.000Z',
    });
  });

  it('answers as JSON that no shared cache may keep, and says nothing but what it must', async () => {
    const response = await setup().send(GOOD);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(Object.keys(await json(response))).toEqual(['ok', 'saved', 'code']);
  });

  it('keeps the lead for seven days, and the visitor\'s counter for one hour', async () => {
    const t = setup();
    await t.send(GOOD);
    const [counter] = t.store.keys().filter((key) => key.startsWith('rl:'));
    expect(t.store.secondsLeft('lead:id1')).toBe(LEAD_RECORD_LIFETIME_DAYS * 24 * 60 * 60);
    expect(t.store.secondsLeft(counter)).toBe(60 * 60);
  });

  it('keeps only what the visitor typed, the time and where the popup was opened from, whatever else the request carried', async () => {
    const t = setup();
    await t.send({ ...GOOD, country: 'CA', userAgent: 'Mozilla', ip: ADDRESS, cart: ['SI-TEE-001'], notes: 'anything' });
    const record = await t.store.readLead('id1');
    expect(Object.keys(record!).sort()).toEqual(['createdAt', 'email', 'firstName', 'marketing', 'source']);
    expect(JSON.stringify(record)).not.toContain(ADDRESS);
    expect(t.store.keys().sort()).toEqual([t.store.keys().find((key) => key.startsWith('rl:')), 'lead:id1'].sort());
  });

  it('keeps the name and email as the checks cleaned them, not as they arrived', async () => {
    const t = setup();
    const raw = { firstName: '  Maya  ', email: '  Maya@Example.com ' };
    const cleaned = checkLead(raw);
    expect(cleaned.ok).toBe(true);
    await t.send({ ...GOOD, ...raw });
    const record = await t.store.readLead('id1');
    if (cleaned.ok) expect({ firstName: record!.firstName, email: record!.email }).toEqual(cleaned.value);
  });

  it('takes the marketing box only when it is exactly true, and the source only when it says auto', async () => {
    const t = setup();
    await t.send({ ...GOOD, marketing: true, source: 'manual' });
    await t.send({ ...GOOD, marketing: 'yes', source: 'somewhere else' });
    await t.send({ ...GOOD, marketing: 1, source: undefined });
    await t.send({ ...GOOD, source: 'auto' });
    const records = await Promise.all(['id1', 'id2', 'id3', 'id4'].map((id) => t.store.readLead(id)));
    expect(records.map((record) => [record!.marketing, record!.source])).toEqual([
      [true, 'manual'],
      [false, 'manual'],
      [false, 'manual'],
      [false, 'auto'],
    ]);
  });
});

describe('a request that is not a lead at all', () => {
  it('is turned away with 404 while the store is closed, and nothing is kept', async () => {
    const t = setup({}, {});
    const response = await t.send(GOOD);
    expect(response.status).toBe(404);
    expect(t.store.keys()).toEqual([]);
  });

  it('is turned away with 405 unless it is a POST, saying which is allowed', async () => {
    const t = setup();
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const response = await t.send(GOOD, {}, method);
      expect(response.status, method).toBe(405);
      expect(response.headers.get('allow')).toBe('POST');
    }
    expect(t.store.keys()).toEqual([]);
  });

  it('is turned away with 400 when the body is not a small JSON object, and is not counted', async () => {
    const t = setup();
    const tooBig = JSON.stringify({ ...GOOD, notes: 'x'.repeat(9000) });
    for (const body of ['', 'not json', '[1,2]', '"text"', 'null', '5', tooBig]) {
      const response = await t.send(body);
      expect(response.status, body.slice(0, 20)).toBe(400);
      expect(await json(response)).toEqual({ ok: false, error: 'bad request' });
    }
    expect(t.store.keys()).toEqual([]);
  });
});

describe('the checks that run again on the server', () => {
  it('turn away a name or an email that fails the same checks the popup runs, with the same messages, and keep and count nothing', async () => {
    const t = setup();
    const bad = { firstName: '', email: 'not an email' };
    const expected = checkLead(bad);
    const response = await t.send({ ...GOOD, ...bad });
    expect(response.status).toBe(400);
    expect(expected.ok).toBe(false);
    if (!expected.ok) expect(await json(response)).toEqual({ ok: false, problems: expected.problems });
    expect(t.store.keys()).toEqual([]);
    expect(t.lookups).toEqual([]);
  });

  it('turn away values that are not text, as if nothing had been typed', async () => {
    const t = setup();
    for (const body of [{ firstName: 5, email: ['a@b.com'] }, { firstName: null, email: {} }, {}]) {
      expect((await t.send(body)).status).toBe(400);
    }
    expect(t.store.keys()).toEqual([]);
  });
});

describe('the hidden trap field', () => {
  it('tells a bot that filled it that all is well, and keeps, counts and looks up nothing', async () => {
    const t = setup();
    const response = await t.send({ ...GOOD, email: 'bot@gmail.com', [TRAP_FIELD]: 'https://spam.example' });
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ ok: true, saved: false, code });
    expect(t.store.keys()).toEqual([]);
    expect(t.lookups).toEqual([]);
  });

  it('catches a value that is not text, but not one that is only spaces or nothing', async () => {
    const t = setup();
    for (const trap of [5, true, ['x'], { a: 1 }]) expect((await json(await t.send({ ...GOOD, [TRAP_FIELD]: trap }))).saved, String(trap)).toBe(false);
    for (const trap of [undefined, null, '', '   ']) expect((await json(await t.send({ ...GOOD, [TRAP_FIELD]: trap }))).saved, String(trap)).toBe(true);
  });

  it('is asked only of a lead that passed the checks, so a bad lead is told what is wrong with it', async () => {
    const t = setup();
    expect((await t.send({ ...GOOD, email: 'nope', [TRAP_FIELD]: 'x' })).status).toBe(400);
  });
});

describe('the rate limit', () => {
  it('lets a visitor send the form ten times an hour, and asks the eleventh to wait, keeping nothing more', async () => {
    const t = setup();
    for (let n = 1; n <= LEAD_ATTEMPTS_PER_HOUR; n += 1) expect((await t.send(GOOD)).status, `try ${n}`).toBe(200);
    const eleventh = await t.send(GOOD);
    expect(eleventh.status).toBe(429);
    expect(await json(eleventh)).toEqual({ ok: false, error: 'too many attempts' });
    expect(await t.store.readLead(`id${LEAD_ATTEMPTS_PER_HOUR + 1}`)).toBeUndefined();
    expect(t.store.keys().filter((key) => key.startsWith('lead:'))).toHaveLength(LEAD_ATTEMPTS_PER_HOUR);
  });

  it('says how many seconds remain until the next hour begins', async () => {
    const t = setup();
    for (let n = 0; n <= LEAD_ATTEMPTS_PER_HOUR; n += 1) await t.send(GOOD);
    // The clock reads 12:30:00, so 30 minutes remain.
    expect((await t.send(GOOD)).headers.get('retry-after')).toBe(String(30 * 60));
    t.advance(10 * 60 * 1000);
    expect((await t.send(GOOD)).headers.get('retry-after')).toBe(String(20 * 60));
  });

  it('starts again when the next hour begins', async () => {
    const t = setup();
    for (let n = 0; n <= LEAD_ATTEMPTS_PER_HOUR; n += 1) await t.send(GOOD);
    expect((await t.send(GOOD)).status).toBe(429);
    t.advance(HOUR);
    expect((await t.send(GOOD)).status).toBe(200);
  });

  it('counts each visitor separately', async () => {
    const t = setup();
    for (let n = 0; n <= LEAD_ATTEMPTS_PER_HOUR; n += 1) await t.send(GOOD);
    expect((await t.send(GOOD)).status).toBe(429);
    expect((await t.send(GOOD, { 'x-forwarded-for': '198.51.100.9' })).status).toBe(200);
  });

  it('is done before the look-up of the email\'s domain, so an attempt that is turned away costs no look-up', async () => {
    const t = setup();
    const notExempt = { ...GOOD, email: 'maya@gmail.com' };
    for (let n = 1; n <= LEAD_ATTEMPTS_PER_HOUR; n += 1) await t.send(notExempt);
    expect(t.lookups).toHaveLength(LEAD_ATTEMPTS_PER_HOUR);
    expect((await t.send(notExempt)).status).toBe(429);
    expect(t.lookups).toHaveLength(LEAD_ATTEMPTS_PER_HOUR);
  });

  it('is not spent by a request that failed the checks, or by the trap', async () => {
    const t = setup();
    for (let n = 0; n < 25; n += 1) await t.send({ ...GOOD, email: 'nope' });
    for (let n = 0; n < 25; n += 1) await t.send({ ...GOOD, [TRAP_FIELD]: 'bot' });
    for (let n = 1; n <= LEAD_ATTEMPTS_PER_HOUR; n += 1) expect((await t.send(GOOD)).status).toBe(200);
  });

  it('names the counter with a hash, so neither the visitor\'s address nor the secret is in what the store holds', async () => {
    const t = setup();
    await t.send(GOOD);
    const [counter] = t.store.keys().filter((key) => key.startsWith('rl:'));
    expect(counter).toMatch(/^rl:[0-9a-f]{64}$/);
    expect(counter).not.toContain(ADDRESS);
    expect(counter).not.toContain(SECRET);
    expect(counter).toBe(visitorKey(ADDRESS, SECRET, t.now()));
  });
});

describe('visitorKey', () => {
  const now = Date.UTC(2026, 8, 25, 12, 30, 0);

  it('is the same for the same visitor in the same hour, and different for another visitor, another hour or another secret', () => {
    const key = visitorKey(ADDRESS, SECRET, now);
    expect(visitorKey(ADDRESS, SECRET, now + 29 * 60 * 1000)).toBe(key);
    expect(visitorKey('198.51.100.9', SECRET, now)).not.toBe(key);
    expect(visitorKey(ADDRESS, SECRET, now + HOUR)).not.toBe(key);
    expect(visitorKey(ADDRESS, 'another secret', now)).not.toBe(key);
  });

  it('keeps the address and the hour apart, so 10.0.0.1 in hour 25 is not 10.0.0.12 in hour 5', () => {
    // Joined with nothing between them, both would read 10.0.0.125.
    expect(visitorKey('10.0.0.1', SECRET, 25 * HOUR)).not.toBe(visitorKey('10.0.0.12', SECRET, 5 * HOUR));
  });
});

describe('clientAddress', () => {
  const from = (headers: Record<string, string>) => clientAddress(new Request('https://example.test/', { headers }));

  it('is the first address x-forwarded-for gives, then x-real-ip, then "unknown"', () => {
    expect(from({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })).toBe('203.0.113.7');
    expect(from({ 'x-forwarded-for': ' 203.0.113.7 ' })).toBe('203.0.113.7');
    expect(from({ 'x-real-ip': '198.51.100.9' })).toBe('198.51.100.9');
    expect(from({ 'x-forwarded-for': '', 'x-real-ip': '198.51.100.9' })).toBe('198.51.100.9');
    expect(from({})).toBe('unknown');
  });
});

describe('the look-up of the email\'s domain', () => {
  it('turns away a temporary domain with the message the check gives, without a look-up, and keeps nothing', async () => {
    const t = setup();
    const response = await t.send({ ...GOOD, email: 'maya@mailinator.com' });
    const expected = checkEmailDomain('maya@mailinator.com', { disposableDomains: parseDomainList('mailinator.com\n'), mailService: 'accepts-mail' });
    expect(response.status).toBe(400);
    expect(expected.ok).toBe(false);
    if (!expected.ok) expect(await json(response)).toEqual({ ok: false, problems: [expected.problem] });
    expect(t.lookups).toEqual([]);
    expect(t.store.keys().filter((key) => key.startsWith('lead:'))).toEqual([]);
  });

  it('turns away a domain that cannot receive mail', async () => {
    const t = setup();
    t.service.current = 'no-mail';
    const response = await t.send({ ...GOOD, email: 'maya@some-typo.com' });
    expect(response.status).toBe(400);
    expect(((await json(response)).problems as { field: string }[])[0].field).toBe('email');
    expect(t.store.keys().filter((key) => key.startsWith('lead:'))).toEqual([]);
  });

  it('lets an address through when the look-up cannot say, or fails, so a hiccup never blocks a real customer', async () => {
    const t = setup();
    t.service.current = 'unknown';
    expect((await t.send({ ...GOOD, email: 'maya@gmail.com' })).status).toBe(200);
    const broken = setup({ mailServiceOf: async () => Promise.reject(new Error('the resolver fell over')) });
    expect((await broken.send({ ...GOOD, email: 'maya@gmail.com' })).status).toBe(200);
  });

  it('keeps an address whose domain accepts mail', async () => {
    const t = setup();
    expect((await t.send({ ...GOOD, email: 'maya@gmail.com' })).status).toBe(200);
    expect(await t.store.readLead('id1')).toMatchObject({ email: 'maya@gmail.com' });
  });

  it('asks about the domain only, never the address, and not at all for the demo domains', async () => {
    const t = setup();
    await t.send({ ...GOOD, email: 'maya@gmail.com' });
    for (const domain of DEMO_EMAIL_DOMAINS) await t.send({ ...GOOD, email: `maya@${domain}` });
    expect(t.lookups).toEqual(['gmail.com']);
  });
});

describe('when the store cannot be reached', () => {
  const broken = (which: 'increment' | 'saveLead'): Store => ({
    ...createMemoryStore(),
    [which]: async () => Promise.reject(new Error('the database is down')),
  });

  it('says it could not save, with 503, when the counter cannot be read, and keeps nothing', async () => {
    const t = setup({ store: broken('increment') });
    const response = await t.send(GOOD);
    expect(response.status).toBe(503);
    expect(await json(response)).toEqual({ ok: false, error: 'could not save' });
  });

  it('says it could not save, and does not say saved, when the lead cannot be kept', async () => {
    const t = setup({ store: broken('saveLead') });
    const response = await t.send(GOOD);
    expect(response.status).toBe(503);
    const body = await json(response);
    expect(body).toEqual({ ok: false, error: 'could not save' });
    expect(body).not.toHaveProperty('saved');
    expect(body).not.toHaveProperty('code');
  });

  it('logs only the kind of fault, never the name, the email or the message of the fault', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const t = setup({ store: broken('saveLead') });
    await t.send({ ...GOOD, firstName: 'Zelda', email: 'zelda@example.com' });
    const logged = JSON.stringify(spy.mock.calls);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(logged).toContain('Error');
    for (const secret of ['Zelda', 'zelda@example.com', 'the database is down']) expect(logged).not.toContain(secret);
  });
});
