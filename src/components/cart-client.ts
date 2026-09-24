import { addToCart, removeFromCart, setQuantity, type Cart, type CartResult, type VariantKey } from '../engine/cart';
import { parseStoredCart, serializeCart, type StoredCartResult } from '../engine/cart-storage';
import type { ListContext } from '../engine/catalog';
import type { LineInput } from '../engine/pricing';

/**
 * The one place in the browser that reads or writes the saved cart. Everything else, the Add to cart
 * button and the cart's own buttons alike, changes the cart through the functions here, and each
 * change tells the page with a `cart:changed` event. Whatever shows the cart, the drawer, the cart
 * page or the count in the header, listens for that event and draws itself again, so none of them
 * needs to know who made the change. The rules for a cart (merging, limits, the seven days) are in
 * src/engine/cart.ts and cart-storage.ts, and are tested there.
 */

export const CART_STORAGE_KEY = 'second-impression:cart';

/** What a change tells the page, beyond the fact that the cart is different. */
export interface CartChange {
  /** A quantity stopped at the limit instead of growing. */
  limitReached?: boolean;
  /** The item that was just added, for the words that say so. */
  added?: VariantKey;
}

/**
 * The cart, when the browser will not keep one (storage blocked or full): it lasts for as long as this
 * page stays open, so adding an item still visibly works for that visit. It is empty again on the
 * next page, and it is cleared as soon as a save succeeds.
 */
let unsaved: Cart | undefined;

/**
 * The saved cart, checked line by line against the catalog. A line that is no longer valid is left
 * out and listed in `dropped`. Nothing is saved back here, so opening a page never restarts the
 * seven days; only a change to the cart does.
 */
export function loadCart(): StoredCartResult {
  if (unsaved) return { cart: unsaved, dropped: [] };
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    raw = null;
  }
  return parseStoredCart(raw, Date.now());
}

/** Writes the cart in its saved form (no prices, and the time it was saved, which starts the seven days). */
function saveCart(cart: Cart): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, serializeCart(cart, Date.now()));
    unsaved = undefined;
  } catch {
    unsaved = cart;
  }
}

/**
 * Tells the page the cart is different, with `cart:changed` on the document. Anything that shows the
 * cart listens for it. The same page hears it at once; other open tabs hear about the saved cart from
 * the browser's own `storage` event, which cart-ui.ts also listens for.
 */
function announce(change: CartChange = {}): void {
  document.dispatchEvent(new CustomEvent<CartChange>('cart:changed', { detail: change }));
}

/** Adds an item, and the list it was picked from if there was one. A refused item is reported and changes nothing. */
export function addItem(item: LineInput, list?: ListContext): CartResult {
  const result = addToCart(loadCart().cart, item, list);
  if (result.ok) {
    saveCart(result.cart);
    announce({ limitReached: result.limitReached, added: { sku: item.sku, colour: item.colour, size: item.size } });
  }
  return result;
}

/** Sets how many of a line the cart holds. Zero removes it, and more than the limit stops at the limit. */
export function changeQuantity(target: VariantKey, quantity: number): void {
  const result = setQuantity(loadCart().cart, target, quantity);
  if (result.ok) {
    saveCart(result.cart);
    announce({ limitReached: result.limitReached });
  }
}

/** Takes a line out of the cart altogether. */
export function removeItem(target: VariantKey): void {
  saveCart(removeFromCart(loadCart().cart, target));
  announce();
}
