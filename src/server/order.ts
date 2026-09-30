import { createHmac } from 'node:crypto';
import { checkAddress, checkContact } from '../engine/checkout-form.js';
import { priceOrder, type LineInput, type OrderInput } from '../engine/pricing.js';
import type { CardBrand, KeptCard } from '../demo/test-cards.js';
import { ORDER_ATTEMPTS_PER_HOUR, ORDER_RECORD_LIFETIME_DAYS } from '../store/policy.js';
import type { Environment } from './gate.js';
import { answer, guarded, notFound } from './http.js';
import { clientAddress } from './lead.js';
import { RATE_LIMIT_KEY_PREFIX, type OrderRecord, type Store } from './store.js';

/**
 * `/api/order`: takes the order the checkout page's review already priced, checks and prices it again for real, and
 * keeps it for seven days under a token that gates `/thank-you`. Everything it needs from the outside world comes
 * in as an input, so a test can use a store in memory, a clock it moves, and ids it chooses, and touch no network
 * and no database. `POST` places an order; `GET` with a token reads one back, for the thank-you page to render.
 */
export interface OrderDependencies {
  store: Store;
  /** The time in milliseconds, as `Date.now` gives it. */
  now: () => number;
  /** A new, unpredictable token that gates the order's own page. */
  newOrderToken: () => string;
  /** A new order number to show the shopper: the store's own `SI-XXXXXXXX` format. */
  newOrderNumber: () => string;
  /** The secret that keys the hash of a visitor's address, so the address is never kept and cannot be recovered. */
  secret: string;
}

/** What the browser sends to place an order: the raw cart, the destination and shipping choice, the coupon typed if
 * any, the shopper's own contact and address, a summary of the accepted card, and the one key that makes retrying
 * this same attempt safe. Every field arrives as `unknown`, the same as a lead's, since anything from a browser can
 * be forged or malformed. */
export interface PlaceOrderInput {
  lines?: unknown;
  currency?: unknown;
  coupon?: unknown;
  shippingMethod?: unknown;
  contact?: { email?: unknown; phone?: unknown };
  address?: {
    country?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    address1?: unknown;
    address2?: unknown;
    city?: unknown;
    province?: unknown;
    postalCode?: unknown;
  };
  payment?: { brand?: unknown; last4?: unknown };
  idempotencyKey?: unknown;
}

/** The most a request to place an order may carry: a cart, a full address and a coupon, so more generous than a lead. */
const MAX_BODY_CHARACTERS = 16 * 1024;
const HOUR_SECONDS = 60 * 60;
const HOUR_MILLISECONDS = HOUR_SECONDS * 1000;
const RECORD_LIFETIME_SECONDS = ORDER_RECORD_LIFETIME_DAYS * 24 * HOUR_SECONDS;
const MAX_IDEMPOTENCY_KEY_CHARACTERS = 200;

/**
 * The name of the counter for one visitor in one hour, kept apart from the lead form's own counter (the hashed
 * input carries "order" as well as the address and the hour) so that placing several orders in a demo session never
 * uses up a visitor's budget for the lead form, or the other way round. The same `rl:` tag is reused, since both
 * are still, at heart, a visitor's rate limit; only the name under that tag differs.
 */
function orderVisitorKey(address: string, secret: string, now: number): string {
  const hour = Math.floor(now / HOUR_MILLISECONDS);
  return `${RATE_LIMIT_KEY_PREFIX}${createHmac('sha256', secret).update(`order|${address}|${hour}`).digest('hex')}`;
}

const failed = (error: string, status: number, extra: Record<string, string> = {}) => answer({ ok: false, error }, status, extra);

/** The store could not be reached or refused. Logs only what kind of fault it was, never anything about the order. */
function couldNotSave(error: unknown): Response {
  console.error('The order store failed:', error instanceof Error ? error.name : typeof error);
  return failed('could not save', 503);
}

/** Every cart line arrives as `unknown` too, the same as the rest of the body; only its shape is checked here, the
 * catalog and the quantity limit are `priceOrder`'s own job. */
function checkLines(input: unknown): LineInput[] | undefined {
  if (!Array.isArray(input) || input.length === 0) return undefined;
  const lines: LineInput[] = [];
  for (const line of input) {
    if (typeof line !== 'object' || line === null) return undefined;
    const { sku, colour, size, quantity } = line as Record<string, unknown>;
    if (typeof sku !== 'string' || typeof colour !== 'string' || typeof size !== 'string' || typeof quantity !== 'number') {
      return undefined;
    }
    lines.push({ sku, colour, size, quantity });
  }
  return lines;
}

/** A payment summary is never the raw card: only the brand and last four digits `checkPayment` already kept in the
 * browser, which `checkout-review.ts` sends on as the browser's own claim that the card was accepted. */
function checkPaymentSummary(input: unknown): KeptCard | undefined {
  if (typeof input !== 'object' || input === null) return undefined;
  const { brand, last4 } = input as Record<string, unknown>;
  if (brand !== 'Visa' && brand !== 'Mastercard') return undefined;
  if (typeof last4 !== 'string' || !/^\d{4}$/.test(last4)) return undefined;
  return { brand: brand as CardBrand, last4 };
}

function checkIdempotencyKey(input: unknown): string | undefined {
  return typeof input === 'string' && input.length > 0 && input.length <= MAX_IDEMPOTENCY_KEY_CHARACTERS ? input : undefined;
}

/** The answer for an order already placed, whether this is the first time or a repeat of the same attempt. */
function placed(orderNumber: string, token: string): Response {
  return answer({ ok: true, orderNumber, token });
}

/**
 * Places an order. In this order, and each step only for a request that got through the one before:
 * 1. the body is read, and must be a small JSON object, with an idempotency key of a sensible length;
 * 2. if that key has already placed an order, the same answer is given again, and nothing further runs, including
 *    the rate limit (this is what makes a retry of the same attempt safe, and free);
 * 3. `checkContact` and `checkAddress` check the shopper's own details again, since anything from a browser can be
 *    forged (400);
 * 4. the payment summary is checked for shape only: the card number itself never reaches this function, the way it
 *    never reaches any server for a real hosted payment integration either;
 * 5. `priceOrder` prices the whole order again, from the raw cart, the coupon typed, the destination the checked
 *    address gives, and the shipping method: never the total the browser showed (400 if the cart itself does not
 *    check out, which is only reachable from a forged request, since the review already prices from the same code);
 * 6. the rate limit: at most ORDER_ATTEMPTS_PER_HOUR tries per visitor per hour, its own counter, apart from the
 *    lead form's (429). It comes after the checks above, the same order the lead form's own checks and rate limit
 *    come in, so a request that was never going to check out costs nothing from a visitor's real budget;
 * 7. the order is kept for seven days, under a new token, and that token is what the idempotency key now points to,
 *    so a retry finds it on the next try even if this one's answer never reaches the browser (200, or 503 if it
 *    could not be kept).
 */
export function orderHandler(env: Environment, dependencies: () => OrderDependencies): (request: Request) => Promise<Response> {
  return guarded(env, ['POST', 'GET'], async (request) => {
    const deps = dependencies();
    if (request.method === 'GET') return readOrder(request, deps);

    // 1. The body.
    let input: PlaceOrderInput;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY_CHARACTERS) return failed('bad request', 400);
      const body: unknown = JSON.parse(text);
      if (typeof body !== 'object' || body === null || Array.isArray(body)) return failed('bad request', 400);
      input = body as PlaceOrderInput;
    } catch {
      return failed('bad request', 400);
    }
    const idempotencyKey = checkIdempotencyKey(input.idempotencyKey);
    if (idempotencyKey === undefined) return failed('bad request', 400);

    // 2. A repeat of an attempt already placed.
    let existingToken: string | undefined;
    try {
      existingToken = await deps.store.readIdempotencyKey(idempotencyKey);
    } catch (error) {
      return couldNotSave(error);
    }
    if (existingToken !== undefined) {
      const existing = await deps.store.readOrder(existingToken).catch(() => undefined);
      if (existing !== undefined) return placed(existing.orderNumber, existingToken);
    }

    // 3. The checks again.
    const checkedContact = checkContact({ email: input.contact?.email, phone: input.contact?.phone });
    if (!checkedContact.ok) return answer({ ok: false, problems: checkedContact.problems }, 400);
    const checkedAddress = checkAddress({
      country: input.address?.country,
      firstName: input.address?.firstName,
      lastName: input.address?.lastName,
      address1: input.address?.address1,
      address2: input.address?.address2,
      city: input.address?.city,
      province: input.address?.province,
      postalCode: input.address?.postalCode,
    });
    if (!checkedAddress.ok) return answer({ ok: false, problems: checkedAddress.problems }, 400);

    // 4. The payment summary's shape.
    const payment = checkPaymentSummary(input.payment);
    if (payment === undefined) return failed('bad request', 400);

    // 5. The price, for real.
    const lines = checkLines(input.lines);
    if (lines === undefined || typeof input.currency !== 'string' || typeof input.shippingMethod !== 'string') {
      return failed('bad request', 400);
    }
    const orderInput: OrderInput = {
      lines,
      currency: input.currency,
      shippingMethod: input.shippingMethod,
      destination: { country: checkedAddress.value.country, province: checkedAddress.value.province },
      ...(typeof input.coupon === 'string' ? { coupon: input.coupon } : {}),
    };
    const priced = priceOrder(orderInput);
    if (!priced.ok) return answer({ ok: false, problems: priced.problems }, 400);

    // 6. The rate limit.
    let attempts: number;
    try {
      attempts = await deps.store.increment(orderVisitorKey(clientAddress(request), deps.secret, deps.now()), HOUR_SECONDS);
    } catch (error) {
      return couldNotSave(error);
    }
    if (attempts > ORDER_ATTEMPTS_PER_HOUR) {
      const nextHour = (Math.floor(deps.now() / HOUR_MILLISECONDS) + 1) * HOUR_MILLISECONDS;
      return failed('too many attempts', 429, { 'retry-after': String(Math.ceil((nextHour - deps.now()) / 1000)) });
    }

    // 7. Keep it.
    const token = deps.newOrderToken();
    const orderNumber = deps.newOrderNumber();
    const record: OrderRecord = {
      orderNumber,
      order: priced.order,
      contact: checkedContact.value,
      address: checkedAddress.value,
      payment,
      createdAt: new Date(deps.now()).toISOString(),
    };
    try {
      await deps.store.saveOrder(token, record, RECORD_LIFETIME_SECONDS);
      await deps.store.saveIdempotencyKey(idempotencyKey, token, RECORD_LIFETIME_SECONDS);
    } catch (error) {
      return couldNotSave(error);
    }
    return placed(orderNumber, token);
  });
}

/** Reads an order back by its token, for the thank-you page. A missing or unknown token answers the same way as one
 * that has expired: there is nothing a stranger could learn from telling the two apart. */
async function readOrder(request: Request, deps: OrderDependencies): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return notFound();
  let record: OrderRecord | undefined;
  try {
    record = await deps.store.readOrder(token);
  } catch (error) {
    return couldNotSave(error);
  }
  if (record === undefined) return notFound();
  const { orderNumber, order, contact, address, payment } = record;
  return answer({ ok: true, orderNumber, order, contact, address, payment });
}
