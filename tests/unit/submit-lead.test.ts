import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitLead, type LeadSubmission } from '../../src/components/submit-lead';
import { DEMO_EMAIL_DOMAINS } from '../../src/demo/email-domains';
import { welcomeCoupon } from '../../src/engine/coupons';
import { parseDomainList, type MailService } from '../../src/engine/email-domain';
import { leadHandler, TRAP_FIELD } from '../../src/server/lead';
import { createMemoryStore } from '../../src/server/memory-store';
import type { Store } from '../../src/server/store';
import { LEAD_ATTEMPTS_PER_HOUR, LEAD_TRAP_FIELD } from '../../src/store/policy';

const code = welcomeCoupon()!.code;
const lead: LeadSubmission = { firstName: 'Ana', email: 'ana@example.com', marketing: false, source: 'manual', trap: '' };

const reply = (status: number, body: unknown) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

type FetchArguments = [string, RequestInit];
const stubFetch = (answer: (url: string, init: RequestInit) => Promise<Response>) => {
  const stub = vi.fn(answer);
  vi.stubGlobal('fetch', stub);
  return stub;
};
/** What the popup sent, as the function would have read it. */
const sentBody = (stub: ReturnType<typeof stubFetch>) => JSON.parse((stub.mock.calls[0] as FetchArguments)[1].body as string) as Record<string, unknown>;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// submitLead is the one place that decides a lead was taken. These tests state what the popup relies on: the request
// it sends, and that every answer is turned into one of four results, so that the code is shown only for a lead the
// server says it took.
describe('submitLead: what it sends', () => {
  it('posts the lead as JSON to /api/lead, with the five things the function reads and nothing else', async () => {
    const stub = stubFetch(async () => reply(200, { ok: true, saved: true, code }));
    await submitLead({ ...lead, marketing: true, source: 'auto' });
    expect(stub).toHaveBeenCalledTimes(1);
    const [url, init] = stub.mock.calls[0] as FetchArguments;
    expect(url).toBe('/api/lead');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
    expect(sentBody(stub)).toEqual({ firstName: 'Ana', email: 'ana@example.com', marketing: true, source: 'auto', website: '' });
  });

  it('names the trap field the way the function does, and carries whatever is in it', async () => {
    const stub = stubFetch(async () => reply(200, { ok: true, saved: false, code }));
    await submitLead({ ...lead, trap: 'http://spam.example' });
    expect(LEAD_TRAP_FIELD).toBe(TRAP_FIELD);
    expect(sentBody(stub)[TRAP_FIELD]).toBe('http://spam.example');
  });

  it('leaves the browser\'s cookies as they are, since a Preview behind Vercel\'s login needs its own to get through', async () => {
    const stub = stubFetch(async () => reply(200, { ok: true, saved: true, code }));
    await submitLead(lead);
    const [, init] = stub.mock.calls[0] as FetchArguments;
    expect(init.credentials).toBeUndefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('submitLead: a lead the server took', () => {
  it('gives the code the server sent, and says the lead was saved', async () => {
    stubFetch(async () => reply(200, { ok: true, saved: true, code: 'SECOND10' }));
    expect(await submitLead(lead)).toEqual({ status: 'accepted', code: 'SECOND10', saved: true });
  });

  it('gives the code without saying it was saved when the server says it kept nothing, which is what a filled trap gets', async () => {
    stubFetch(async () => reply(200, { ok: true, saved: false, code }));
    expect(await submitLead(lead)).toEqual({ status: 'accepted', code, saved: false });
  });

  it('shows the code as the server wrote it, without spaces around it', async () => {
    stubFetch(async () => reply(200, { ok: true, saved: true, code: '  SECOND10 \n' }));
    expect(await submitLead(lead)).toEqual({ status: 'accepted', code: 'SECOND10', saved: true });
  });

  it.each([
    ['says it is not ok', { ok: false, saved: true, code }],
    ['has no code', { ok: true, saved: true }],
    ['has a code that is not text', { ok: true, saved: true, code: 10 }],
    ['has an empty code', { ok: true, saved: true, code: '   ' }],
    ['has a code too long to be one', { ok: true, saved: true, code: 'X'.repeat(41) }],
    ['does not say whether it was saved', { ok: true, code }],
    ['says "saved" in words', { ok: true, saved: 'yes', code }],
    ['is not an object', 'SECOND10'],
    ['is nothing', 'null'],
    ['is a list', [{ ok: true, saved: true, code }]],
  ])('does not take a 200 answer that %s, and shows no code', async (_what, body) => {
    stubFetch(async () => reply(200, body));
    expect(await submitLead(lead)).toEqual({ status: 'failed' });
  });

  it('does not take a 200 answer that is not JSON at all', async () => {
    stubFetch(async () => reply(200, '<html>an error page</html>'));
    expect(await submitLead(lead)).toEqual({ status: 'failed' });
  });
});

describe('submitLead: a lead the server found a problem with', () => {
  it('gives the problems the server named, for the fields of this form', async () => {
    const problems = [{ field: 'email', message: 'That looks like a temporary email address. Please use one you check regularly.' }];
    stubFetch(async () => reply(400, { ok: false, problems }));
    expect(await submitLead(lead)).toEqual({ status: 'problems', problems });
  });

  it('keeps the problems it can use and drops the rest: another field, no message, an empty or a very long one', async () => {
    stubFetch(async () =>
      reply(400, {
        ok: false,
        problems: [
          { field: 'firstName', message: 'Please enter your first name.' },
          { field: 'phone', message: 'Not a field of this form.' },
          { field: 'email' },
          { field: 'email', message: '  ' },
          { field: 'email', message: 'x'.repeat(201) },
          'a string',
          null,
        ],
      }),
    );
    expect(await submitLead(lead)).toEqual({ status: 'problems', problems: [{ field: 'firstName', message: 'Please enter your first name.' }] });
  });

  it.each([
    ['none it can use', { ok: false, problems: [{ field: 'phone', message: 'Nope.' }] }],
    ['an empty list', { ok: false, problems: [] }],
    ['no list', { ok: false }],
    ['a list that is not one', { ok: false, problems: 'email' }],
    ['no object', 'null'],
  ])('says the save failed when a 400 answer has %s, so a fault is never passed off as a wrong field', async (_what, body) => {
    stubFetch(async () => reply(400, body));
    expect(await submitLead(lead)).toEqual({ status: 'failed' });
  });

  it('says the save failed when a 400 answer is not JSON', async () => {
    stubFetch(async () => reply(400, 'bad request'));
    expect(await submitLead(lead)).toEqual({ status: 'failed' });
  });
});

describe('submitLead: too many tries, and everything that goes wrong', () => {
  it('says too many tries for a 429, without reading the answer', async () => {
    stubFetch(async () => reply(429, { ok: false, error: 'too many attempts' }));
    expect(await submitLead(lead)).toEqual({ status: 'too-many-tries' });
  });

  it.each([201, 204, 302, 401, 403, 404, 405, 500, 502, 503, 504])('says the save failed for a %i answer, whatever it says', async (status) => {
    stubFetch(async () => reply(status, { ok: true, saved: true, code }));
    expect(await submitLead(lead)).toEqual({ status: 'failed' });
  });

  it('says the save failed when there is no connection', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await submitLead(lead)).toEqual({ status: 'failed' });
  });

  it('says the save failed when the answer breaks off while it is being read', async () => {
    stubFetch(async () => {
      const response = reply(200, { ok: true, saved: true, code });
      vi.spyOn(response, 'json').mockRejectedValue(new TypeError('terminated'));
      return response;
    });
    expect(await submitLead(lead)).toEqual({ status: 'failed' });
  });

  it('gives up after six seconds, and not before, and says the save failed', async () => {
    vi.useFakeTimers();
    const stub = stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
        }),
    );
    let answer: unknown;
    const pending = submitLead(lead).then((result) => (answer = result));
    await vi.advanceTimersByTimeAsync(5999);
    expect(answer).toBeUndefined();
    expect((stub.mock.calls[0] as FetchArguments)[1].signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(answer).toEqual({ status: 'failed' });
  });

  it('leaves no timer running once it has an answer, whichever answer it is', async () => {
    vi.useFakeTimers();
    for (const answer of [() => reply(200, { ok: true, saved: true, code }), () => reply(429, {}), () => reply(500, {})]) {
      stubFetch(async () => answer());
      await submitLead(lead);
      expect(vi.getTimerCount()).toBe(0);
    }
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    await submitLead(lead);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never hands back what it was given, so nothing personal can leak into what the popup says', async () => {
    for (const answer of [() => reply(429, {}), () => reply(500, {}), () => reply(200, { ok: true, saved: true, code })]) {
      stubFetch(async () => answer());
      expect(JSON.stringify(await submitLead(lead))).not.toMatch(/ana/i);
    }
  });
});

// The same function, connected to the real lead function (with a store in memory and no network), so that what the
// popup sends and how it reads the answers are tested against the code that answers, and not against a guess of it.
describe('submitLead against the real lead function', () => {
  const OPEN = { PUBLIC_STORE_OPEN: 'true' };

  function connected(overrides: { store?: Store; mailService?: MailService } = {}) {
    const clock = Date.UTC(2026, 8, 25, 12, 30, 0);
    let ids = 0;
    const store = overrides.store ?? createMemoryStore(() => clock);
    const handler = leadHandler(OPEN, () => ({
      store,
      mailServiceOf: async () => overrides.mailService ?? 'accepts-mail',
      disposableDomains: parseDomainList('mailinator.com\n'),
      exemptDomains: DEMO_EMAIL_DOMAINS,
      secret: 'a-secret-for-the-test',
      now: () => clock,
      newId: () => `id${(ids += 1)}`,
    }));
    stubFetch(async (url, init) =>
      handler(new Request(`https://example.test${url}`, { ...init, headers: { ...(init.headers as Record<string, string>), 'x-forwarded-for': '203.0.113.7' } })),
    );
    return { store: store as ReturnType<typeof createMemoryStore> };
  }

  it('is given the code, and the lead is kept exactly as the form sent it', async () => {
    const { store } = connected();
    expect(await submitLead({ ...lead, marketing: true, source: 'auto' })).toEqual({ status: 'accepted', code, saved: true });
    expect(await store.readLead('id1')).toEqual({
      firstName: 'Ana',
      email: 'ana@example.com',
      marketing: true,
      source: 'auto',
      createdAt: '2026-09-25T12:30:00.000Z',
    });
  });

  it('is given the code but nothing is kept, and it is told so, when the trap is filled', async () => {
    const { store } = connected();
    expect(await submitLead({ ...lead, trap: 'http://spam.example' })).toEqual({ status: 'accepted', code, saved: false });
    expect(await store.readLead('id1')).toBeUndefined();
  });

  it('is given the problem, in the store\'s own words, for a temporary email domain', async () => {
    const { store } = connected();
    const answer = await submitLead({ ...lead, email: 'ana@mailinator.com' });
    expect(answer).toEqual({
      status: 'problems',
      problems: [{ field: 'email', message: 'That looks like a temporary email address. Please use one you check regularly.' }],
    });
    expect(await store.readLead('id1')).toBeUndefined();
  });

  it('is given the problem for an address the browser\'s own checks would have stopped, if they had been skipped', async () => {
    connected();
    const answer = await submitLead({ ...lead, firstName: '', email: 'not an email' });
    expect(answer.status).toBe('problems');
  });

  it('is told too many tries on the try after the limit, and not before', async () => {
    connected();
    for (let attempt = 1; attempt <= LEAD_ATTEMPTS_PER_HOUR; attempt += 1) {
      expect((await submitLead(lead)).status, `try ${attempt}`).toBe('accepted');
    }
    expect(await submitLead(lead)).toEqual({ status: 'too-many-tries' });
  });

  it('is told the save failed, with no code, when the store cannot be used', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken: Store = {
      increment: async () => {
        throw new Error('the database is down');
      },
      saveLead: async () => {
        throw new Error('the database is down');
      },
      readLead: async () => undefined,
    };
    connected({ store: broken });
    expect(await submitLead(lead)).toEqual({ status: 'failed' });
    vi.restoreAllMocks();
  });
});
