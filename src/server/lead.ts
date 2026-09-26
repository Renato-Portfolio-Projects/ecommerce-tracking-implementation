import { createHmac } from 'node:crypto';
import { checkLead } from '../engine/checkout-form.js';
import { welcomeCoupon } from '../engine/coupons.js';
import { checkEmailDomain, emailDomainOf, isDisposableDomain, type MailService } from '../engine/email-domain.js';
import { LEAD_ATTEMPTS_PER_HOUR, LEAD_RECORD_LIFETIME_DAYS, LEAD_TRAP_FIELD } from '../store/policy.js';
import type { Environment } from './gate.js';
import { answer, guarded } from './http.js';
import { RATE_LIMIT_KEY_PREFIX, type LeadRecord, type Store } from './store.js';

/**
 * `/api/lead`: takes the lead the popup has collected, checks it again, and keeps it for seven days. Everything it
 * needs from the outside world comes in as an input, so a test can use a store in memory, a look-up that says
 * whatever the test wants, a clock it moves, and ids it chooses, and touch no network and no database.
 */
export interface LeadDependencies {
  store: Store;
  /** What the domain's mail service says. The real one asks the name system (mail-service.ts). It never throws. */
  mailServiceOf: (domain: string) => Promise<MailService>;
  /** The temporary email domains, from `parseDomainList`. */
  disposableDomains: ReadonlySet<string>;
  /** Domains accepted with no mail check at all, which the demo people use. */
  exemptDomains: readonly string[];
  /** The secret that keys the hash of a visitor's address, so the address is never kept and cannot be recovered. */
  secret: string;
  /** The time in milliseconds, as `Date.now` gives it. */
  now: () => number;
  /** A new, unpredictable id for a saved lead. */
  newId: () => string;
}

/** The most that a request may carry. A lead is a name and an email, so this is very generous. */
const MAX_BODY_CHARACTERS = 8 * 1024;
const HOUR_SECONDS = 60 * 60;
const HOUR_MILLISECONDS = HOUR_SECONDS * 1000;
const RECORD_LIFETIME_SECONDS = LEAD_RECORD_LIFETIME_DAYS * 24 * HOUR_SECONDS;

/** The name of the hidden field that no person ever fills. A bot that fills every field it finds gives itself away. The popup writes the same name (policy.ts). */
export const TRAP_FIELD = LEAD_TRAP_FIELD;

/**
 * The address of the visitor's connection, as Vercel says it (`x-forwarded-for` is the public address of the client,
 * and Vercel overwrites whatever the visitor sent). Used only to tell one visitor from another for the rate limit, and
 * never kept.
 */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * The name of the counter for one visitor in one hour: `rl:` and a hash of their address and the hour, made with
 * a secret. It means nothing to anyone without the secret, and it cannot be turned back into an address: someone who
 * held the secret could only test a guess of an address against it. It changes with the hour, so a counter is only
 * ever about one hour, and the store deletes it soon after.
 */
export function visitorKey(address: string, secret: string, now: number): string {
  const hour = Math.floor(now / HOUR_MILLISECONDS);
  return `${RATE_LIMIT_KEY_PREFIX}${createHmac('sha256', secret).update(`${address}|${hour}`).digest('hex')}`;
}

const failed = (error: string, status: number, extra: Record<string, string> = {}) => answer({ ok: false, error }, status, extra);

/** The store could not be reached or refused. Logs only what kind of fault it was, never anything about the lead. */
function couldNotSave(error: unknown): Response {
  console.error('The lead store failed:', error instanceof Error ? error.name : typeof error);
  return failed('could not save', 503);
}

/**
 * The function's work. In this order, and each step only for a request that got through the one before:
 * 1. the body is read, and must be a small JSON object;
 * 2. `checkLead` checks the name and the email again, since anything from a browser can be forged (400);
 * 3. the hidden trap field: filled means a bot, which is told it worked and gets nothing kept (200, `saved: false`);
 * 4. the rate limit: at most LEAD_ATTEMPTS_PER_HOUR tries per visitor per hour (429);
 * 5. the email's domain: not a temporary domain, and able to receive mail, looked up for at most two seconds and
 *    let through if that fails (400 for a domain turned down);
 * 6. the lead is kept for seven days (200 with the welcome code, or 503 if it could not be kept).
 * The cheap checks come first, and the rate limit comes before the look-up, so a turned-away attempt costs nothing
 * on the network. Only a lead that is really kept is answered with `saved: true`.
 */
export function leadHandler(env: Environment, dependencies: () => LeadDependencies): (request: Request) => Promise<Response> {
  return guarded(env, ['POST'], async (request) => {
    const deps = dependencies();

    // 1. The body.
    let input: Record<string, unknown>;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY_CHARACTERS) return failed('bad request', 400);
      const body: unknown = JSON.parse(text);
      if (typeof body !== 'object' || body === null || Array.isArray(body)) return failed('bad request', 400);
      input = body as Record<string, unknown>;
    } catch {
      return failed('bad request', 400);
    }

    // 2. The checks again.
    const checked = checkLead({ firstName: input.firstName, email: input.email });
    if (!checked.ok) return answer({ ok: false, problems: checked.problems }, 400);
    const code = welcomeCoupon()?.code;
    if (code === undefined) throw new Error('the store has no welcome code');

    // 3. The trap.
    const trap = input[TRAP_FIELD];
    if (trap !== undefined && trap !== null && String(trap).trim() !== '') return answer({ ok: true, saved: false, code });

    // 4. The rate limit.
    let attempts: number;
    try {
      attempts = await deps.store.increment(visitorKey(clientAddress(request), deps.secret, deps.now()), HOUR_SECONDS);
    } catch (error) {
      return couldNotSave(error);
    }
    if (attempts > LEAD_ATTEMPTS_PER_HOUR) {
      const nextHour = (Math.floor(deps.now() / HOUR_MILLISECONDS) + 1) * HOUR_MILLISECONDS;
      return failed('too many attempts', 429, { 'retry-after': String(Math.ceil((nextHour - deps.now()) / 1000)) });
    }

    // 5. The email's domain. A domain that needs no look-up (a demo one, or a temporary one) is not looked up.
    const domain = emailDomainOf(checked.value.email);
    let mailService: MailService = 'accepts-mail';
    if (!deps.exemptDomains.includes(domain) && !isDisposableDomain(domain, deps.disposableDomains)) {
      mailService = await deps.mailServiceOf(domain).catch((): MailService => 'unknown');
    }
    const domainCheck = checkEmailDomain(checked.value.email, {
      disposableDomains: deps.disposableDomains,
      mailService,
      exemptDomains: deps.exemptDomains,
    });
    if (!domainCheck.ok) return answer({ ok: false, problems: [domainCheck.problem] }, 400);

    // 6. Keep it.
    const record: LeadRecord = {
      firstName: checked.value.firstName,
      email: checked.value.email,
      marketing: input.marketing === true,
      source: input.source === 'auto' ? 'auto' : 'manual',
      createdAt: new Date(deps.now()).toISOString(),
    };
    try {
      await deps.store.saveLead(deps.newId(), record, RECORD_LIFETIME_SECONDS);
    } catch (error) {
      return couldNotSave(error);
    }
    return answer({ ok: true, saved: true, code });
  });
}
