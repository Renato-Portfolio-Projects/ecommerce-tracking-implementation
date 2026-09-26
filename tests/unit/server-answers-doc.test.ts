import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitLead, type LeadAnswer } from '../../src/components/submit-lead';
import { DEMO_EMAIL_DOMAINS } from '../../src/demo/email-domains';
import { welcomeCoupon } from '../../src/engine/coupons';
import { parseDomainList } from '../../src/engine/email-domain';
import { currencyHandler } from '../../src/server/currency';
import { guarded } from '../../src/server/http';
import { leadHandler } from '../../src/server/lead';
import { createMemoryStore } from '../../src/server/memory-store';
import type { Store } from '../../src/server/store';
import { CURRENCIES } from '../../src/store/currencies';
import { LEAD_ATTEMPTS_PER_HOUR, LEAD_TRAP_FIELD } from '../../src/store/policy';
import { WORDS } from '../../src/store/words';
import { tableUnderHeading } from '../helpers/markdown';

// docs/server-answers.md says what each server function answers, and what the popup does with each answer. These tests run
// every function in every situation it can be in, and read that page, in both directions: an answer the page does not list
// fails, and so does a row of the page that no answer matches any more.

const root = fileURLToPath(new URL('../../', import.meta.url));
const doc = readFileSync(join(root, 'docs', 'server-answers.md'), 'utf8');
const readme = readFileSync(join(root, 'README.md'), 'utf8');

/** Every table between a heading and the next one, each as its data rows. */
function tablesUnder(markdown: string, heading: string): string[][][] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) throw new Error(`Heading not found: ${heading}`);
  const tables: string[][][] = [];
  let current: string[][] | undefined;
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) break;
    if (trimmed.startsWith('|')) {
      current ??= [];
      const inner = trimmed.endsWith('|') ? trimmed.slice(1, -1) : trimmed.slice(1);
      current.push(inner.split('|').map((cell) => cell.trim()));
    } else if (current) {
      tables.push(current.slice(2));
      current = undefined;
    }
  }
  if (current) tables.push(current.slice(2));
  return tables;
}

const standard = tableUnderHeading(doc, '## The numbers, and who decided what'); // number, name, defined in, used for
const common = tableUnderHeading(doc, '## Rules every function follows').filter((row) => /^\d{3}$/.test(row[0])); // number, when, body
const currencyRows = tableUnderHeading(doc, '## /api/currency'); // number, when, body
const [sentFields, leadRows] = tablesUnder(doc, '## /api/lead'); // field, holds; and number, when, body, the popup
const popupRows = tableUnderHeading(doc, '## How the popup reads each answer'); // number, body, result, what the visitor sees

const OPEN = { PUBLIC_STORE_OPEN: 'true' };
const code = welcomeCoupon()!.code;
const GOOD = { firstName: 'Maya', email: 'maya@example.com', marketing: true, source: 'auto', [LEAD_TRAP_FIELD]: '' };

/** The names the standard gives these numbers, as the IANA registry lists them (read on 2026-09-25). */
const STANDARD_NAMES: Record<number, string> = {
  200: 'OK',
  400: 'Bad Request',
  404: 'Not Found',
  405: 'Method Not Allowed',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

interface Seen {
  label: string;
  status: number;
  body: unknown;
  headers: Headers;
}

async function seen(label: string, response: Promise<Response> | Response): Promise<Seen> {
  const r = await response;
  return { label, status: r.status, body: JSON.parse(await r.text()), headers: r.headers };
}

/** The lead function, with a store in memory and a look-up that says the domain takes mail. */
function leadFunction(overrides: { store?: Store; env?: Record<string, string | undefined> } = {}) {
  const clock = Date.UTC(2026, 8, 25, 12, 30, 0);
  let ids = 0;
  const store = overrides.store ?? createMemoryStore(() => clock);
  const handler = leadHandler(overrides.env ?? OPEN, () => ({
    store,
    mailServiceOf: async (domain) => (domain === 'no-mail.invalid-check.com' ? 'no-mail' : 'accepts-mail'),
    disposableDomains: parseDomainList('mailinator.com\n'),
    exemptDomains: DEMO_EMAIL_DOMAINS,
    secret: 'a-secret-for-the-test',
    now: () => clock,
    newId: () => `id${(ids += 1)}`,
  }));
  const post = (body: unknown, method = 'POST') =>
    handler(new Request('https://example.test/api/lead', { method, headers: { 'x-forwarded-for': '203.0.113.7' }, ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) }));
  return { post };
}

/** Everything `/api/lead` can answer, each produced by the real function. */
async function everyLeadAnswer(): Promise<Seen[]> {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const out: Seen[] = [];
  const t = leadFunction();
  out.push(await seen('a lead that is kept', t.post(GOOD)));
  out.push(await seen('a filled trap', leadFunction().post({ ...GOOD, [LEAD_TRAP_FIELD]: 'http://spam.example' })));
  out.push(await seen('a wrong email', leadFunction().post({ ...GOOD, email: 'not an email' })));
  out.push(await seen('a wrong first name', leadFunction().post({ ...GOOD, firstName: '' })));
  out.push(await seen('a temporary domain', leadFunction().post({ ...GOOD, email: 'a@mailinator.com' })));
  out.push(await seen('a domain that takes no mail', leadFunction().post({ ...GOOD, email: 'a@no-mail.invalid-check.com' })));
  out.push(await seen('a body that is not JSON', leadFunction().post('not json')));
  out.push(await seen('a body that is a list', leadFunction().post('[1]')));
  out.push(await seen('a body that is too long', leadFunction().post(JSON.stringify({ ...GOOD, padding: 'x'.repeat(9000) }))));
  const limited = leadFunction();
  for (let attempt = 0; attempt < LEAD_ATTEMPTS_PER_HOUR; attempt += 1) await limited.post(GOOD);
  out.push(await seen('one try too many', limited.post(GOOD)));
  const broken: Store = {
    increment: async () => 1,
    saveLead: async () => {
      throw new Error('the database is down');
    },
    readLead: async () => undefined,
  };
  out.push(await seen('a store that cannot save', leadFunction({ store: broken }).post(GOOD)));
  return out;
}

/** Everything that every function answers in the same way, from each function. */
async function everyCommonAnswer(): Promise<Seen[]> {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const out: Seen[] = [];
  out.push(await seen('lead, store closed', leadFunction({ env: {} }).post(GOOD)));
  out.push(await seen('currency, store closed', currencyHandler({})(new Request('https://example.test/api/currency'))));
  out.push(await seen('lead, wrong method', leadFunction().post(undefined, 'GET')));
  out.push(await seen('currency, wrong method', currencyHandler(OPEN)(new Request('https://example.test/api/currency', { method: 'POST', body: '{}' }))));
  const fails = guarded(OPEN, ['GET'], () => {
    throw new Error('something the function did not expect');
  });
  out.push(await seen('a fault', fails(new Request('https://example.test/api/x'))));
  return out;
}

const tidy = (cell: string) => cell.replace(/^`|`$/g, '');

/**
 * Whether what a function answered is what a row of the page says it answers. The page's body is JSON, where "..." stands for
 * any text, and inside a list only the keys are compared, since a list holds as many entries as there are problems.
 */
function matches(actual: unknown, documented: unknown, inList = false): boolean {
  if (documented === '...') return typeof actual === 'string' && actual !== '';
  if (Array.isArray(documented)) return Array.isArray(actual) && actual.length > 0 && actual.every((item) => matches(item, documented[0], true));
  if (typeof documented === 'object' && documented !== null) {
    if (typeof actual !== 'object' || actual === null) return false;
    const keys = (o: object) => Object.keys(o).sort().join();
    if (keys(actual) !== keys(documented)) return false;
    return Object.entries(documented).every(([key, value]) => (inList ? typeof (actual as Record<string, unknown>)[key] === typeof value : matches((actual as Record<string, unknown>)[key], value)));
  }
  return actual === documented;
}

const documentedBody = (row: string[], column: number) => JSON.parse(tidy(row[column]).replace(/`/g, '')) as unknown;

/** Checks that every answer seen has a row, and every row has an answer. `bodyColumn` is where the row's body is. */
function bothWays(answers: Seen[], rows: string[][], bodyColumn = 2) {
  const used = new Set<string[]>();
  for (const answer of answers) {
    const row = rows.find((candidate) => Number(candidate[0]) === answer.status && matches(answer.body, documentedBody(candidate, bodyColumn)));
    expect(row, `no row in the page matches the answer to "${answer.label}": ${answer.status} ${JSON.stringify(answer.body)}`).toBeDefined();
    used.add(row!);
  }
  for (const row of rows) expect(used.has(row), `no answer matches the page's row: ${row[0]} ${row[bodyColumn]}`).toBe(true);
}

afterEach(() => vi.restoreAllMocks());

describe('the numbers, and who decided what', () => {
  it('lists every number the functions answer with, and no other, with the names the standard gives', async () => {
    const answers = [...(await everyLeadAnswer()), ...(await everyCommonAnswer()), await seen('currency', currencyHandler(OPEN)(new Request('https://example.test/api/currency')))];
    const used = [...new Set(answers.map((a) => a.status))].sort();
    expect(standard.map(([number]) => Number(number)).sort()).toEqual(used);
    for (const [number, name, definedIn] of standard) {
      expect(name, number).toBe(STANDARD_NAMES[Number(number)]);
      expect(definedIn, number).toContain(Number(number) === 429 ? 'RFC 6585' : 'RFC 9110');
    }
  });

  it('finds no status number in the server\'s code that the page does not list', () => {
    const listed = new Set(standard.map(([number]) => Number(number)));
    const found = new Set<number>();
    for (const name of readdirSync(join(root, 'src', 'server')).filter((file) => file.endsWith('.ts'))) {
      const code = readFileSync(join(root, 'src', 'server', name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const match of code.matchAll(/\b(?:answer|failed)\((?:[^()]|\([^()]*\))*?,\s*(\d{3})\b/g)) found.add(Number(match[1]));
      for (const match of code.matchAll(/\bnew Response\([^)]*status:\s*(\d{3})/g)) found.add(Number(match[1]));
    }
    expect(found.size).toBeGreaterThan(3);
    for (const status of found) expect(listed.has(status), `${status} is in the server's code, and not on the page`).toBe(true);
  });

  it('has a section for every function in the api folder, and none for one that is not there', () => {
    const functions = readdirSync(join(root, 'api'))
      .filter((file) => file.endsWith('.ts'))
      .map((file) => `/api/${file.replace(/\.ts$/, '')}`);
    const sections = [...doc.matchAll(/^## (\/api\/[a-z-]+)$/gm)].map((match) => match[1]);
    expect(sections.sort()).toEqual(functions.sort());
  });
});

describe('what every function does, in the same way', () => {
  it('answers a closed store, a wrong method and a fault as the page says, from every function', async () => {
    bothWays(await everyCommonAnswer(), common);
  });

  it('says which methods it accepts when it turns one down, as the standard requires', async () => {
    const answers = await everyCommonAnswer();
    expect(answers.find((a) => a.label === 'lead, wrong method')!.headers.get('allow')).toBe('POST');
    expect(answers.find((a) => a.label === 'currency, wrong method')!.headers.get('allow')).toBe('GET');
    expect(doc).toContain('`Allow` header');
  });

  it('sends every answer as JSON that no shared cache may keep, every answer of every function', async () => {
    const answers = [...(await everyLeadAnswer()), ...(await everyCommonAnswer()), await seen('currency', currencyHandler(OPEN)(new Request('https://example.test/api/currency')))];
    for (const answer of answers) {
      expect(answer.headers.get('cache-control'), answer.label).toBe('no-store');
      expect(answer.headers.get('content-type'), answer.label).toBe('application/json; charset=utf-8');
    }
    expect(doc).toContain('`Cache-Control: no-store`');
    expect(doc).toContain('`application/json; charset=utf-8`');
  });
});

describe('/api/currency', () => {
  it('answers as the page says, with one of the store\'s own currencies', async () => {
    const answers = [
      await seen('with a country', currencyHandler(OPEN)(new Request('https://example.test/api/currency', { headers: { 'x-vercel-ip-country': 'CA' } }))),
      await seen('with none', currencyHandler(OPEN)(new Request('https://example.test/api/currency'))),
    ];
    bothWays(answers, currencyRows);
    for (const answer of answers) expect(CURRENCIES.map((currency) => currency.code)).toContain((answer.body as { currency: string }).currency);
  });

  it('says which country gets which currency, as the function gives it', async () => {
    const when = currencyRows[0][1];
    for (const { code: currency } of CURRENCIES) expect(when, currency).toContain(`\`${currency}\``);
    expect(when).toContain('Canada gives CAD, the United Kingdom GBP, the euro-area countries EUR, and everyone else, and a missing or unrecognisable country, USD');
    const from = async (country: string | undefined) =>
      ((await (await currencyHandler(OPEN)(new Request('https://example.test/api/currency', { headers: country ? { 'x-vercel-ip-country': country } : {} }))).json()) as { currency: string }).currency;
    expect([await from('CA'), await from('GB'), await from('DE'), await from('US'), await from('XX'), await from(undefined)]).toEqual(['CAD', 'GBP', 'EUR', 'USD', 'USD', 'USD']);
  });
});

describe('/api/lead', () => {
  it('answers in every situation as the page says, and the page lists no answer that the function no longer gives', async () => {
    bothWays(await everyLeadAnswer(), leadRows);
  });

  it('gives the welcome code in the two answers that carry one, and says how many seconds to wait with a 429', async () => {
    const answers = await everyLeadAnswer();
    for (const label of ['a lead that is kept', 'a filled trap']) expect((answers.find((a) => a.label === label)!.body as { code: string }).code, label).toBe(code);
    const wait = Number(answers.find((a) => a.label === 'one try too many')!.headers.get('retry-after'));
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(3600);
    expect(doc).toContain('`Retry-After`');
  });

  it('accepts a body of 8 KB and turns down one a character longer, as the page says', async () => {
    const at = (length: number) => {
      const base = JSON.stringify({ ...GOOD, padding: '' });
      return JSON.stringify({ ...GOOD, padding: 'x'.repeat(length - base.length) });
    };
    expect(at(8192)).toHaveLength(8192);
    const fine = await seen('exactly 8 KB', leadFunction().post(at(8192)));
    const tooLong = await seen('one over', leadFunction().post(at(8193)));
    expect(fine.body).toEqual({ ok: true, saved: true, code });
    expect(tooLong.body).toEqual({ ok: false, error: 'bad request' });
    expect(leadRows.some((row) => row[1].includes('at most 8 KB'))).toBe(true);
  });

  it('lists the five fields the popup sends, and they are the ones it sends', async () => {
    const sent: string[][] = [];
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      sent.push(Object.keys(JSON.parse(init.body as string)));
      return new Response('{}', { status: 500 });
    });
    await submitLead({ firstName: 'Ana', email: 'ana@example.com', marketing: false, source: 'auto', trap: '' });
    vi.unstubAllGlobals();
    const listed = sentFields.map(([field]) => tidy(field));
    expect(sent).toHaveLength(1);
    expect([...sent[0]].sort()).toEqual([...listed].sort());
    expect(listed).toContain(LEAD_TRAP_FIELD);
    expect(listed.filter((field) => field !== LEAD_TRAP_FIELD)).toEqual(['firstName', 'email', 'marketing', 'source']);
  });
});

describe('how the popup reads each answer', () => {
  const reply = (status: number, body: unknown) => async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  const lead = { firstName: 'Ana', email: 'ana@example.com', marketing: false, source: 'manual' as const, trap: '' };

  /** What the popup made of an answer, given as a status and a body, or of no answer at all. */
  async function resultOf(answer: (() => Promise<Response>) | 'no answer'): Promise<LeadAnswer['status']> {
    vi.stubGlobal('fetch', answer === 'no answer' ? async () => Promise.reject(new TypeError('Failed to fetch')) : answer);
    const result = await submitLead(lead);
    vi.unstubAllGlobals();
    return result.status;
  }

  const cases: { number: string; result: string; answers: (() => Promise<Response>)[] }[] = [
    { number: '200', result: 'accepted', answers: [reply(200, { ok: true, saved: true, code }), reply(200, { ok: true, saved: false, code })] },
    { number: '200', result: 'failed', answers: [reply(200, {}), reply(200, { ok: true, saved: true }), reply(200, '<html>sign in</html>'), reply(200, { ok: false, saved: true, code })] },
    { number: '400', result: 'problems', answers: [reply(400, { ok: false, problems: [{ field: 'email', message: 'Enter your email address.' }] })] },
    { number: '400', result: 'failed', answers: [reply(400, { ok: false, error: 'bad request' }), reply(400, { ok: false, problems: [{ field: 'phone', message: 'No.' }] })] },
    { number: '429', result: 'too-many-tries', answers: [reply(429, { ok: false, error: 'too many attempts' })] },
    { number: 'Any other', result: 'failed', answers: [201, 204, 302, 401, 404, 405, 500, 503].map((status) => reply(status, { ok: true, saved: true, code })) },
  ];

  it('gives each answer the result the page says, and each row of the page has an answer to prove it', async () => {
    const proved = new Set<string[]>();
    for (const { number, result, answers } of cases) {
      const row = popupRows.find((candidate) => candidate[0] === number && candidate[2] === result);
      expect(row, `the page has no row for ${number}, ${result}`).toBeDefined();
      proved.add(row!);
      for (const answer of answers) expect(await resultOf(answer), `${number}, ${result}`).toBe(result);
    }
    expect(await resultOf('no answer')).toBe('failed');
    expect(popupRows.find((row) => row[0] === 'Any other')![1]).toContain('no connection at all');
    for (const row of popupRows) expect(proved.has(row), `no case proves the page's row: ${row[0]}, ${row[2]}`).toBe(true);
  });

  it('gives up after six seconds, as the page says', () => {
    expect(doc).toContain('It waits six seconds at most');
    expect(popupRows.find((row) => row[0] === 'Any other')![1]).toContain('no answer in six seconds');
  });

  it('names the two messages by their keys in the words file, and the words exist', () => {
    const shown = popupRows.map((row) => row[3]).join(' ');
    for (const key of ['popup.saveFailed', 'popup.tooManyTries'] as const) {
      expect(shown, key).toContain(`\`${key}\``);
      expect(WORDS[key], key).toBeTruthy();
    }
    expect(popupRows.find((row) => row[2] === 'too-many-tries')![3]).toContain('popup.tooManyTries');
    for (const row of popupRows.filter((r) => r[2] === 'failed')) expect(row[3]).toContain('popup.saveFailed');
  });
});

describe('the page as a page', () => {
  it('links only to https pages, cites the standard and the registry, and says on which day it read them', () => {
    const links = [...doc.matchAll(/\]\((https?:[^)\s]+)\)/g)].map((match) => match[1]);
    for (const link of links) expect(link.startsWith('https://'), link).toBe(true);
    for (const wanted of ['https://www.rfc-editor.org/rfc/rfc9110.html', 'https://www.rfc-editor.org/rfc/rfc6585.html', 'https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml']) {
      expect(links, wanted).toContain(wanted);
    }
    expect(doc).toMatch(/All three pages were read on \d{4}-\d{2}-\d{2}/);
    expect(doc).toMatch(/RFC 9457\]\([^)]+\), "Problem Details for HTTP APIs" \(July 2023, read on \d{4}-\d{2}-\d{2}\)/);
    expect(doc).toContain('Not verified:');
  });

  it('is linked from the README, and its links to other pages point at files that exist', () => {
    expect(readme).toContain('(docs/server-answers.md)');
    for (const match of doc.matchAll(/\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g)) {
      expect(existsSync(join(dirname(join(root, 'docs', 'server-answers.md')), match[1])), match[1]).toBe(true);
    }
  });

  it('says what is the store\'s own choice, and names the alternatives the standard allows', () => {
    const own = doc.slice(doc.indexOf('## What is this store\'s own choice'));
    for (const word of ['422', 'Unprocessable Content', 'deliberate untruth', 'idempotency key', 'RFC 9457']) expect(own, word).toContain(word);
  });
});
