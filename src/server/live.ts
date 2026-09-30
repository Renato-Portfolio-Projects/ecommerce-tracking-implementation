import { randomBytes } from 'node:crypto';
import { Resolver } from 'node:dns/promises';
import { DEMO_EMAIL_DOMAINS } from '../demo/email-domains.js';
import { DISPOSABLE_EMAIL_DOMAINS_TEXT } from '../engine/disposable-email-domains.js';
import { parseDomainList } from '../engine/email-domain.js';
import type { Environment } from './gate.js';
import { leadHandler, type LeadDependencies } from './lead.js';
import { mailServiceOf, type DnsResolver } from './mail-service.js';
import { createMemoryStore } from './memory-store.js';
import { orderHandler, type OrderDependencies } from './order.js';
import { makeOrderNumber } from './order-number.js';
import type { Store } from './store.js';
import { createRedis, createUpstashStore, type RedisCommands } from './upstash-store.js';

/**
 * The lead function as it really runs: the handler in lead.ts joined to the things it needs from outside. The two
 * settings that Vercel gives a Preview when the database is connected name the database's address and the key that
 * allows using it. The key also makes the hash of a visitor's address (lead.ts), so no further setting is needed.
 */
export const DATABASE_URL_SETTING = 'KV_REST_API_URL';
export const DATABASE_TOKEN_SETTING = 'KV_REST_API_TOKEN';

/**
 * A setting that asks for the store in memory, which is how the local server runs when it has no database to use. It
 * is refused on Vercel, where a lead that only lived in memory would be lost while the visitor was told it was saved.
 */
export const MEMORY_STORE_SETTING = 'SECOND_IMPRESSION_MEMORY_STORE';

/** What a test may replace: the client for the database, and the name system that the mail look-up asks. */
export interface LiveOptions {
  redis?: (url: string, token: string) => RedisCommands;
  resolver?: DnsResolver;
}

/** A store that has no database behind it, and says so. Every call fails, and the handler answers that it could not save. */
const unavailableStore: Store = {
  increment: () => Promise.reject(new Error('the store is not set up')),
  saveLead: () => Promise.reject(new Error('the store is not set up')),
  readLead: () => Promise.reject(new Error('the store is not set up')),
  saveOrder: () => Promise.reject(new Error('the store is not set up')),
  readOrder: () => Promise.reject(new Error('the store is not set up')),
  saveIdempotencyKey: () => Promise.reject(new Error('the store is not set up')),
  readIdempotencyKey: () => Promise.reject(new Error('the store is not set up')),
};

/** The store to use, and the secret to hash visitors with, from the settings the function was given. */
function storeFor(env: Environment, options: LiveOptions): { store: Store; secret: string } {
  const url = env[DATABASE_URL_SETTING];
  const token = env[DATABASE_TOKEN_SETTING];
  if (url && token) return { store: createUpstashStore((options.redis ?? createRedis)(url, token)), secret: token };
  if (env[MEMORY_STORE_SETTING] === 'true' && !env.VERCEL) return { store: createMemoryStore(), secret: 'a-secret-for-a-store-in-memory' };
  return { store: unavailableStore, secret: 'no-store' };
}

/** The real name system: Node's own resolver, with a short wait of its own inside the two seconds the look-up allows. */
function nodeResolver(): DnsResolver {
  const resolver = new Resolver({ timeout: 1500, tries: 1 });
  return {
    resolveMx: (domain) => resolver.resolveMx(domain),
    resolve4: (domain) => resolver.resolve4(domain),
    resolve6: (domain) => resolver.resolve6(domain),
  };
}

export function liveDependencies(env: Environment, options: LiveOptions = {}): LeadDependencies {
  const { store, secret } = storeFor(env, options);
  const resolver = options.resolver ?? nodeResolver();
  return {
    store,
    mailServiceOf: (domain) => mailServiceOf(domain, resolver),
    disposableDomains: parseDomainList(DISPOSABLE_EMAIL_DOMAINS_TEXT),
    exemptDomains: DEMO_EMAIL_DOMAINS,
    secret,
    now: Date.now,
    newId: () => randomBytes(16).toString('hex'),
  };
}

/**
 * The handler that the function at /api/lead hands its requests to. What it needs is made on the first request that
 * gets past the store's gate, and kept for the ones after it, so a closed store never touches the database.
 */
export function liveLeadHandler(env: Environment, options: LiveOptions = {}): (request: Request) => Promise<Response> {
  let dependencies: LeadDependencies | undefined;
  return leadHandler(env, () => (dependencies ??= liveDependencies(env, options)));
}

export function liveOrderDependencies(env: Environment, options: LiveOptions = {}): OrderDependencies {
  const { store, secret } = storeFor(env, options);
  return {
    store,
    now: Date.now,
    newOrderToken: () => randomBytes(16).toString('hex'),
    newOrderNumber: () => makeOrderNumber(),
    secret,
  };
}

/**
 * The handler that the function at /api/order hands its requests to. What it needs is made on the first request
 * that gets past the store's gate, and kept for the ones after it, so a closed store never touches the database.
 */
export function liveOrderHandler(env: Environment, options: LiveOptions = {}): (request: Request) => Promise<Response> {
  let dependencies: OrderDependencies | undefined;
  return orderHandler(env, () => (dependencies ??= liveOrderDependencies(env, options)));
}
