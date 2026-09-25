/**
 * The settings a server function reads, which are the environment variables Vercel gives it. It is a plain
 * object so that a test can pass its own instead of the real environment.
 */
export type Environment = Record<string, string | undefined>;

/**
 * Whether the server functions may answer. They answer only while the store is open, which is the same
 * switch, and the same rule, as the pages have (scripts/store-pages.mjs): `PUBLIC_STORE_OPEN` must be exactly
 * "true", so a stray "1" or "TRUE" cannot open anything by accident. Production leaves the variable unset, so
 * there it answers nothing, whatever is deployed, and a preview build sets it. It is read on every request.
 */
export function storeIsOpen(env: Environment): boolean {
  return env.PUBLIC_STORE_OPEN === 'true';
}
