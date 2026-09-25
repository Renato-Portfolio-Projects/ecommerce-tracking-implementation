import type { LeadRecord, Store } from './store.js';

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
  const alive = (expiresAt: number) => expiresAt > now();
  const kept = <T extends { expiresAt: number }>(map: Map<string, T>, key: string): T | undefined => {
    const found = map.get(key);
    if (found === undefined) return undefined;
    if (alive(found.expiresAt)) return found;
    map.delete(key);
    return undefined;
  };

  return {
    async increment(key, lifetimeSeconds) {
      const count = (kept(counters, key)?.count ?? 0) + 1;
      counters.set(key, { count, expiresAt: now() + lifetimeSeconds * 1000 });
      return count;
    },
    async saveLead(id, record, lifetimeSeconds) {
      leads.set(`lead:${id}`, { record: { ...record }, expiresAt: now() + lifetimeSeconds * 1000 });
    },
    async readLead(id) {
      const found = kept(leads, `lead:${id}`);
      return found === undefined ? undefined : { ...found.record };
    },
    keys() {
      return [...counters.keys(), ...leads.keys()].filter((key) => kept(counters, key) ?? kept(leads, key));
    },
    secondsLeft(key) {
      const found = kept(counters, key) ?? kept(leads, key);
      return found === undefined ? undefined : Math.round((found.expiresAt - now()) / 1000);
    },
  };
}
