import { EVENTS } from './events.js';

// The site's one door to the dataLayer. In a browser globalThis is window, so this is window.dataLayer.
declare global {
  var dataLayer: unknown[] | undefined;
}

export interface PushResult {
  pushed: boolean;
  problems: string[];
}

// A coupon exists only when a code was applied, so these announcements may leave it out.
export const OPTIONAL_PARAMS: Record<string, string[]> = {
  begin_checkout: ['coupon'],
  add_shipping_info: ['coupon'],
  add_payment_info: ['coupon'],
  purchase: ['coupon'],
};

const FINGERPRINT = /^[0-9a-f]{64}$/;
const FINGERPRINT_LABELS = ['sha256_email_address', 'sha256_phone_number'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function eventIdFor(name: string, params: Record<string, unknown>): string {
  const orderNumber = params.transaction_id;
  const hasOrderNumber =
    typeof orderNumber === 'string' ? orderNumber !== '' : typeof orderNumber === 'number';
  if (name === 'purchase' && hasOrderNumber) return `purchase_${orderNumber}`;
  return crypto.randomUUID();
}

// Only real fingerprints under the two fingerprint labels get through. A value that is dropped is
// never repeated, not even in the problem report: only its label is, so a clear-text email cannot
// reach the dataLayer, the result or the console by way of a mistake.
function fingerprintsOnly(
  userData: unknown,
  problems: string[],
): Record<string, string> | undefined {
  if (!isObject(userData)) {
    problems.push('user_data was not an object, so it was left out.');
    return undefined;
  }
  const kept: Record<string, string> = {};
  const dropped: string[] = [];
  for (const [label, value] of Object.entries(userData)) {
    const isFingerprint = typeof value === 'string' && FINGERPRINT.test(value);
    if (FINGERPRINT_LABELS.includes(label) && isFingerprint) kept[label] = value;
    else dropped.push(label);
  }
  if (dropped.length > 0) {
    problems.push(`user_data left out what is not a fingerprint: ${dropped.join(', ')}.`);
  }
  return Object.keys(kept).length > 0 ? kept : undefined;
}

function announce(name: string, params: Record<string, unknown>): PushResult {
  const spec = EVENTS.find((event) => event.name === name);
  if (!spec) {
    const problems = [`${name} is not an event in the tracking plan, so nothing was sent.`];
    console.error(`pushEvent: ${problems[0]}`);
    return { pushed: false, problems };
  }

  const problems: string[] = [];
  if (!isObject(params)) problems.push('The parameters were not an object, so none were used.');
  const given = isObject(params) ? params : {};
  const has = (param: string) =>
    given[param] !== undefined && given[param] !== null && given[param] !== '';

  const listed = spec.params.filter((param) => param !== 'event_id');
  const mayBeLeftOut = OPTIONAL_PARAMS[name] ?? [];
  const unlisted = Object.keys(given).filter(
    (param) => param !== 'event_id' && !listed.includes(param),
  );
  const missing = listed.filter((param) => !mayBeLeftOut.includes(param) && !has(param));

  if ('event_id' in given) {
    problems.push('event_id is made by pushEvent, so the one passed in was ignored.');
  }
  if (unlisted.length > 0) {
    problems.push(`Not in the plan for ${name}, so left out: ${unlisted.join(', ')}.`);
  }
  if (missing.length > 0) problems.push(`Missing from ${name}: ${missing.join(', ')}.`);

  const details: Record<string, unknown> = {};
  for (const param of listed) {
    if (param !== 'user_data' && has(param)) details[param] = given[param];
  }
  const userData =
    listed.includes('user_data') && has('user_data')
      ? fingerprintsOnly(given.user_data, problems)
      : undefined;

  const announcement: Record<string, unknown> = { event: name, event_id: eventIdFor(name, given) };
  if (userData) announcement.user_data = userData;
  const shopping = spec.params.includes('items');
  if (shopping) announcement.ecommerce = details;
  else Object.assign(announcement, details);

  globalThis.dataLayer ??= [];
  if (shopping) globalThis.dataLayer.push({ ecommerce: null });
  globalThis.dataLayer.push(announcement);

  if (problems.length > 0) console.error(`pushEvent(${name}): ${problems.join(' ')}`);
  return { pushed: true, problems };
}

// A real action is never lost to a bad field: the announcement is sent without what is wrong, and
// what was wrong is reported. Only an event that is not in the tracking plan is refused, since
// there is nothing to send it as. Tracking must also never break shopping, so whatever the page
// does (a dataLayer that cannot be written to, or no crypto.randomUUID on a page that is not
// secure), this reports it and returns, and never throws into the shopper's click.
export function pushEvent(name: string, params: Record<string, unknown>): PushResult {
  try {
    return announce(name, params);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'something failed';
    const problem = `The announcement was not sent, because ${reason}.`;
    console.error(`pushEvent(${name}): ${problem}`);
    return { pushed: false, problems: [problem] };
  }
}
