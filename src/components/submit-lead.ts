import type { FieldProblem, Lead } from '../engine/checkout-form';
import { LEAD_TRAP_FIELD } from '../store/policy';
import type { LeadPopupSource } from './lead-popup-ui';

/**
 * What the lead popup hands over when its form has passed the checks in the browser: the checked first name and
 * email, whether the visitor ticked the marketing box, how the popup came to open, and what is in the hidden trap
 * field (empty for every person).
 */
export interface LeadSubmission extends Lead {
  marketing: boolean;
  source: LeadPopupSource;
  trap: string;
}

/**
 * What the server said, in the four ways the popup can go on from here.
 * - `accepted`: the server answered 200 with a code. `saved` says whether it kept the lead. It is false only when the
 *   hidden trap field was filled, which no person does, and the answer is then made to look the same as any other so
 *   that a robot cannot tell. The code is shown either way, and only a lead that was saved is announced.
 * - `problems`: the server checked again and found something wrong with a field (400).
 * - `too-many-tries`: this visitor has sent the form too often (429).
 * - `failed`: anything else, and every answer that cannot be trusted: no answer in six seconds, no connection, a
 *   server fault, or an answer of a shape this code does not know. Nothing is said to have been saved.
 */
export type LeadAnswer =
  | { status: 'accepted'; code: string; saved: boolean }
  | { status: 'problems'; problems: FieldProblem[] }
  | { status: 'too-many-tries' }
  | { status: 'failed' };

const ENDPOINT = '/api/lead';
const GIVE_UP_AFTER_MS = 6000;
/** The welcome code is a short word. Anything longer than this is not one, and is not shown. */
const LONGEST_CODE = 40;
/** The longest message a field problem may carry. The store's own are far shorter. */
const LONGEST_MESSAGE = 200;

const FAILED: LeadAnswer = { status: 'failed' };

function acceptedFrom(body: unknown): LeadAnswer {
  if (typeof body !== 'object' || body === null) return FAILED;
  const { ok, saved, code } = body as Record<string, unknown>;
  if (ok !== true || typeof saved !== 'boolean' || typeof code !== 'string') return FAILED;
  const shown = code.trim();
  if (shown === '' || shown.length > LONGEST_CODE) return FAILED;
  return { status: 'accepted', code: shown, saved };
}

/** Keeps the problems that name a field of this form and carry a message a person could read, and drops the rest. */
function problemsFrom(body: unknown): LeadAnswer {
  const list = typeof body === 'object' && body !== null ? (body as { problems?: unknown }).problems : undefined;
  if (!Array.isArray(list)) return FAILED;
  const problems: FieldProblem[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const { field, message } = item as Record<string, unknown>;
    if ((field !== 'firstName' && field !== 'email') || typeof message !== 'string') continue;
    if (message.trim() === '' || message.length > LONGEST_MESSAGE) continue;
    problems.push({ field, message });
  }
  return problems.length > 0 ? { status: 'problems', problems } : FAILED;
}

/**
 * The one place that decides a lead has been accepted: it sends the lead to /api/lead (src/server/lead.ts), which
 * checks it again and keeps it, and it gives back the code to show only when the server says it did. So the popup
 * shows the code, and `generate_lead` will be sent (v0.2d), only for a lead that was really taken. It never throws,
 * and it never says a lead was kept unless the server answered that it was.
 *
 * The request waits six seconds at most, and sends the browser's usual cookies for this site, as for any request to the
 * same address: the store sets none itself, but a Preview behind Vercel's login needs its login cookie to get through.
 */
export async function submitLead(lead: LeadSubmission): Promise<LeadAnswer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GIVE_UP_AFTER_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: lead.firstName,
        email: lead.email,
        marketing: lead.marketing,
        source: lead.source,
        [LEAD_TRAP_FIELD]: lead.trap,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (response.status === 429) return { status: 'too-many-tries' };
    if (response.status !== 200 && response.status !== 400) return FAILED;
    const body: unknown = await response.json().catch(() => undefined);
    return response.status === 200 ? acceptedFrom(body) : problemsFrom(body);
  } catch {
    return FAILED;
  } finally {
    clearTimeout(timer);
  }
}
