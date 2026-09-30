import type { Address, Contact } from '../engine/checkout-form.js';
import type { PricedOrder } from '../engine/pricing.js';
import type { KeptCard } from '../demo/test-cards.js';

/**
 * What the server keeps, and the three things it asks of a store to keep it. The real one is a Redis database
 * (Upstash), and the tests and the local server use the in-memory one in memory-store.ts. Everything in the store
 * expires by itself, so nothing needs cleaning up and no record outlives the promise made about it.
 */

/**
 * The names things are kept under. Each kind starts with its own tag, so that a key says what it is, and these are the
 * only places that tags are written. `docs/server-data.md` lists every one, and a test fails if the code uses a tag the
 * page does not list.
 */
export const LEAD_KEY_PREFIX = 'lead:';
export const RATE_LIMIT_KEY_PREFIX = 'rl:';
export const ORDER_KEY_PREFIX = 'order:';
export const IDEMPOTENCY_KEY_PREFIX = 'idem:';

/** The name a lead is kept under: the tag and its random id. */
export const leadKey = (id: string): string => `${LEAD_KEY_PREFIX}${id}`;
/** The name an order is kept under: the tag and its own random token, the same one that gates `/thank-you`. */
export const orderKey = (token: string): string => `${ORDER_KEY_PREFIX}${token}`;
/** The name an idempotency attempt is kept under: the tag and the key the browser made for that attempt. */
export const idempotencyKey = (key: string): string => `${IDEMPOTENCY_KEY_PREFIX}${key}`;

/**
 * What is kept about one lead: what the visitor typed into the popup, the time, and where the popup was opened from.
 * Nothing else about them is kept, ever: no address on the network, no browser details, no country, no cookie.
 */
export interface LeadRecord {
  firstName: string;
  email: string;
  marketing: boolean;
  /** How the popup was opened: by itself (`auto`) or by the visitor, from the footer link or the tab (`manual`). */
  source: 'auto' | 'manual';
  /** When it was saved, as an ISO 8601 date and time in UTC, so it reads plainly in the database's own viewer. */
  createdAt: string;
}

/**
 * What is kept about one order: the same order the browser already priced, checked once more and re-priced on the
 * server, the shopper's own contact and shipping details, and a summary of the card that never keeps the card
 * itself. Nothing about the network address that placed it, and no cookie.
 */
export interface OrderRecord {
  /** The short reference shown to the shopper, and the GA4/Meta `transaction_id` once tracking exists. */
  orderNumber: string;
  /** The order as `priceOrder` computed it on the server: the items, the totals, the shipping method, the coupon. */
  order: PricedOrder;
  contact: Contact;
  address: Address;
  /** Brand and last four digits only. The card number, its expiry and its security code never reach the server. */
  payment: KeptCard;
  /** When it was saved, as an ISO 8601 date and time in UTC, so it reads plainly in the database's own viewer. */
  createdAt: string;
}

export interface Store {
  /**
   * Adds one to the counter with this name and gives back the new count. The counter starts at 1, and it is deleted
   * by the store `lifetimeSeconds` after the last time it was added to.
   */
  increment(key: string, lifetimeSeconds: number): Promise<number>;
  /** Keeps a lead under this id, and the store deletes it `lifetimeSeconds` later. */
  saveLead(id: string, record: LeadRecord, lifetimeSeconds: number): Promise<void>;
  /** The lead kept under this id, or nothing if there is none, or it has expired. */
  readLead(id: string): Promise<LeadRecord | undefined>;
  /** Keeps an order under this token, and the store deletes it `lifetimeSeconds` later. */
  saveOrder(token: string, record: OrderRecord, lifetimeSeconds: number): Promise<void>;
  /** The order kept under this token, or nothing if there is none, or it has expired. */
  readOrder(token: string): Promise<OrderRecord | undefined>;
  /**
   * Remembers that this idempotency key already produced this order token, so a repeat of the same attempt is
   * answered without placing a second order. Deleted `lifetimeSeconds` later, the same as the order it names.
   */
  saveIdempotencyKey(key: string, orderToken: string, lifetimeSeconds: number): Promise<void>;
  /** The order token already produced for this idempotency key, or nothing if this attempt has not been seen before. */
  readIdempotencyKey(key: string): Promise<string | undefined>;
}
