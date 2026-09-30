/**
 * The one key the browser sends for a whole attempt at placing an order, so a repeat of the same attempt (a
 * dropped response, a resubmit after a failure) is answered with the order already placed, never a second
 * one. It is made once, the first time it is needed, and kept in sessionStorage rather than a plain variable,
 * so an accidental reload mid-attempt still reuses it. It is cleared once an order actually succeeds, or the
 * cart changes underneath it (checkout-review.ts's job): a changed cart is honestly a new attempt, and
 * reusing a stale key there would be a bug, not a safety net.
 */

export const IDEMPOTENCY_STORAGE_KEY = 'second-impression:checkout-idempotency';

/** The key for the attempt in progress, when the browser will not keep one (storage blocked): it lasts for as
 * long as this page stays open, which is enough for one attempt. */
let remembered: string | undefined;

function savedKey(): string | undefined {
  try {
    return sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY) ?? remembered;
  } catch {
    return remembered;
  }
}

/** The key for the attempt in progress: the same one every call gives, until it is cleared. */
export function currentIdempotencyKey(): string {
  const existing = savedKey();
  if (existing) return existing;
  const key = crypto.randomUUID();
  remembered = key;
  try {
    sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, key);
  } catch {
    // Nothing can be kept. The key in memory covers this page, which is enough for one attempt.
  }
  return key;
}

/** Told once an order is actually placed, or the cart changes underneath an attempt in progress, so the next
 * "Place order" starts a genuinely new attempt rather than reusing a stale key. */
export function clearIdempotencyKey(): void {
  remembered = undefined;
  try {
    sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY);
  } catch {
    // Nothing was kept to remove.
  }
}
