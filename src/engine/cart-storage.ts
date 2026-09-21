import { CART_LIFETIME_DAYS } from '../store/policy';
import { addToCart, emptyCart, isValidListContext, type Cart, type CartProblem } from './cart';
import type { LineInput } from './pricing';

/**
 * Saving the cart in the browser. What is saved is only what and how many, where each item was
 * picked from, and when the cart was last saved. It holds no prices and no personal data. When a
 * saved cart is opened, every line is checked against the catalog again and priced fresh, so a
 * product that has changed or sold out is dropped instead of being trusted.
 */

const CART_LIFETIME_MS = CART_LIFETIME_DAYS * 24 * 60 * 60 * 1000;
const STORED_CART_VERSION = 1;

/** The text to keep in the browser. Call it after every change, so the seven days restart. */
export function serializeCart(cart: Cart, now: number): string {
  return JSON.stringify({
    version: STORED_CART_VERSION,
    savedAt: now,
    lines: cart.lines.map((line) => ({
      sku: line.sku,
      colour: line.colour,
      size: line.size,
      quantity: line.quantity,
      ...(line.list === undefined
        ? {}
        : {
            list: {
              listId: line.list.listId,
              listName: line.list.listName,
              index: line.list.index,
            },
          }),
    })),
  });
}

/** A line that was saved but could not be put back in the cart, and why. */
export interface DroppedLine {
  line: LineInput;
  problem: CartProblem;
}

export interface StoredCartResult {
  cart: Cart;
  /** Lines that were saved but are no longer valid, so the shopper can be told. */
  dropped: DroppedLine[];
}

function readLine(entry: unknown): LineInput | undefined {
  if (typeof entry !== 'object' || entry === null) return undefined;
  const { sku, colour, size, quantity } = entry as Record<string, unknown>;
  if (typeof sku !== 'string' || typeof colour !== 'string' || typeof size !== 'string') {
    return undefined;
  }
  if (typeof quantity !== 'number') return undefined;
  return { sku, colour, size, quantity };
}

/**
 * Reads a saved cart. Anything missing, expired or damaged gives an empty cart. Each line goes
 * back in through the same rules as adding it, so lines that are no longer valid are dropped and
 * reported, duplicates merge, and the size limits hold.
 */
export function parseStoredCart(raw: string | null | undefined, now: number): StoredCartResult {
  const nothing = (): StoredCartResult => ({ cart: emptyCart(), dropped: [] });

  if (raw === null || raw === undefined || raw === '') return nothing();

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return nothing();
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return nothing();

  const { version, savedAt, lines } = data as Record<string, unknown>;
  if (version !== STORED_CART_VERSION) return nothing();
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return nothing();
  if (!Array.isArray(lines)) return nothing();
  if (now - savedAt > CART_LIFETIME_MS) return nothing();

  let cart = emptyCart();
  const dropped: DroppedLine[] = [];
  for (const entry of lines) {
    const line = readLine(entry);
    if (!line) continue;
    const savedList = (entry as Record<string, unknown>).list;
    const result = addToCart(cart, line, isValidListContext(savedList) ? savedList : undefined);
    if (result.ok) cart = result.cart;
    else dropped.push({ line, problem: result.problem });
  }
  return { cart, dropped };
}
