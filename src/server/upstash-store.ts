import { Redis } from '@upstash/redis';
import { leadKey, type LeadRecord, type Store } from './store.js';

/**
 * The store that is a real database: Upstash Redis, reached over the web. This file, and nothing else, knows what the
 * commands sent to it look like, and `docs/server-data.md` lists every one. Two things are sent:
 * - for a try at the lead form: `INCR <counter>` and `EXPIRE <counter> <seconds>`, together;
 * - for a lead that is kept: `HSET <lead> <five named fields>` and `EXPIRE <lead> <seconds>`, together.
 * Both pairs go as one transaction (`MULTI`), so a lead can never be kept without its expiry, which would break the
 * promise that every record is deleted by itself. A lead is read with `HGETALL`. Nothing else is ever sent.
 */

/** What the store needs of a Redis client. The real client has these, and a test passes one that records them. */
export interface RedisTransaction {
  incr(key: string): RedisTransaction;
  expire(key: string, seconds: number): RedisTransaction;
  hset(key: string, fields: Record<string, string>): RedisTransaction;
  exec(): Promise<unknown[]>;
}
export interface RedisCommands {
  multi(): RedisTransaction;
  /**
   * The fields of a hash. With nothing converted on the way, which is how the client is made here, Upstash's answer is a
   * flat list of names and values (`['firstName', 'Maya', 'email', ...]`), and a client that does convert gives an
   * object. Either is understood, and none at all is `null`.
   */
  hgetall(key: string): Promise<Record<string, unknown> | unknown[] | null>;
}

/** How long any one call to the database may take before the request gives up and says it could not save. */
export const STORE_TIMEOUT_MS = 3000;

/**
 * The real client for a database's address and token. Values are stored and read back exactly as text, with nothing
 * converted on the way (a name that is only digits must stay a name), and the client's own report of where it runs is
 * turned off, so nothing is sent to the database but the commands above.
 */
export function createRedis(url: string, token: string): RedisCommands {
  return new Redis({ url, token, automaticDeserialization: false, enableTelemetry: false }) as unknown as RedisCommands;
}

/** Gives up on a call that takes longer than `ms`, so a database that does not answer never holds a visitor up. */
async function within<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('the store took too long to answer')), ms);
  });
  try {
    return await Promise.race([work, late]);
  } finally {
    clearTimeout(timer);
  }
}

/** The five fields of a lead, as the text the database keeps. */
const fieldsOf = (record: LeadRecord): Record<string, string> => ({
  firstName: record.firstName,
  email: record.email,
  marketing: record.marketing ? 'true' : 'false',
  source: record.source,
  createdAt: record.createdAt,
});

/** The named fields in what a hash read gave: a flat list of names and values, or an object, or nothing. */
function fieldsFrom(found: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(found)) {
    if (found.length % 2 !== 0) return undefined;
    const fields: Record<string, unknown> = {};
    for (let i = 0; i < found.length; i += 2) fields[String(found[i])] = found[i + 1];
    return fields;
  }
  return typeof found === 'object' && found !== null ? (found as Record<string, unknown>) : undefined;
}

/**
 * A lead from what the database holds, or nothing if what it holds is not a lead the way this code writes one. What is
 * read is checked, as anything read from outside the code should be.
 */
function leadOf(found: Record<string, unknown>): LeadRecord | undefined {
  const { firstName, email, marketing, source, createdAt } = found;
  if (typeof firstName !== 'string' || typeof email !== 'string' || typeof createdAt !== 'string') return undefined;
  if (source !== 'auto' && source !== 'manual') return undefined;
  if (marketing !== 'true' && marketing !== 'false') return undefined;
  return { firstName, email, marketing: marketing === 'true', source, createdAt };
}

export function createUpstashStore(redis: RedisCommands, timeoutMs = STORE_TIMEOUT_MS): Store {
  return {
    async increment(key, lifetimeSeconds) {
      const [count] = await within(redis.multi().incr(key).expire(key, lifetimeSeconds).exec(), timeoutMs);
      if (typeof count !== 'number') throw new Error('the store gave an answer that is not a count');
      return count;
    },
    async saveLead(id, record, lifetimeSeconds) {
      const key = leadKey(id);
      await within(redis.multi().hset(key, fieldsOf(record)).expire(key, lifetimeSeconds).exec(), timeoutMs);
    },
    async readLead(id) {
      const fields = fieldsFrom(await within(redis.hgetall(leadKey(id)), timeoutMs));
      return fields === undefined ? undefined : leadOf(fields);
    },
  };
}
