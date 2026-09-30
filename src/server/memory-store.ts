import { idempotencyKey, leadKey, orderKey, type LeadRecord, type OrderRecord, type Store } from './store.js';

/** The store that lives in memory: used by the tests, and by the local server when it has no database to use. */
export interface MemoryStore extends Store {
  /** The names of everything kept and not yet expired, so a test can say exactly what was written. */
  keys(): string[];
  /** How many seconds the named thing has left, or nothing if it is not kept. */
  secondsLeft(key: string): number | undefined;
}

/**
 * A store that behaves the way the real one does where it matters: a counter starts at 1, adding to it moves its
 * expiry, and anything past its expiry is gone. `now` is a clock in milliseconds, which a test can move.
 */
export function createMemoryStore(now: () => number = Date.now): MemoryStore {
  const counters = new Map<string, { count: number; expiresAt: number }>();
  const leads = new Map<string, { record: LeadRecord; expiresAt: number }>();
  const orders = new Map<string, { record: OrderRecord; expiresAt: number }>();
  const idempotency = new Map<string, { orderToken: string; expiresAt: number }>();
  const alive = (expiresAt: number) => expiresAt > now();
  const kept = <T extends { expiresAt: number }>(map: Map<string, T>, key: string): T | undefined => {
    const found = map.get(key);
    if (found === undefined) return undefined;
    if (alive(found.expiresAt)) return found;
    map.delete(key);
    return undefined;
  };
  const anyKept = (key: string) => kept(counters, key) ?? kept(leads, key) ?? kept(orders, key) ?? kept(idempotency, key);

  return {
    async increment(key, lifetimeSeconds) {
      const count = (kept(counters, key)?.count ?? 0) + 1;
      counters.set(key, { count, expiresAt: now() + lifetimeSeconds * 1000 });
      return count;
    },
    async saveLead(id, record, lifetimeSeconds) {
      leads.set(leadKey(id), { record: { ...record }, expiresAt: now() + lifetimeSeconds * 1000 });
    },
    async readLead(id) {
      const found = kept(leads, leadKey(id));
      return found === undefined ? undefined : { ...found.record };
    },
    async saveOrder(token, record, lifetimeSeconds) {
      orders.set(orderKey(token), { record: { ...record }, expiresAt: now() + lifetimeSeconds * 1000 });
    },
    async readOrder(token) {
      const found = kept(orders, orderKey(token));
      return found === undefined ? undefined : { ...found.record };
    },
    async saveIdempotencyKey(key, orderToken, lifetimeSeconds) {
      idempotency.set(idempotencyKey(key), { orderToken, expiresAt: now() + lifetimeSeconds * 1000 });
    },
    async readIdempotencyKey(key) {
      return kept(idempotency, idempotencyKey(key))?.orderToken;
    },
    keys() {
      return [...counters.keys(), ...leads.keys(), ...orders.keys(), ...idempotency.keys()].filter(anyKept);
    },
    secondsLeft(key) {
      const found = kept(counters, key) ?? kept(leads, key) ?? kept(orders, key) ?? kept(idempotency, key);
      return found === undefined ? undefined : Math.round((found.expiresAt - now()) / 1000);
    },
  };
}
