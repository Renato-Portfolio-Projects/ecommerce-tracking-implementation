import { MAX_QUANTITY_PER_LINE, variantSku, type ListContext } from './catalog';
import { checkLine, type ItemsInput, type LineInput, type PricingProblemCode } from './pricing';

/**
 * The cart is a plain value with plain functions that each return a new cart and never change
 * the one they are given. It holds what and how many, and where in the store each item was
 * picked from. It never holds a price: prices are worked out from the catalog every time.
 */

/**
 * The most different lines one cart may hold. This is a safety guard, not a business rule, so it
 * can be raised freely. The most units of one line is MAX_QUANTITY_PER_LINE.
 */
export const MAX_CART_LINES = 20;

// Guards on the list a line was picked from, because it can arrive from stored or edited data.
const MAX_LIST_ID_LENGTH = 40;
const MAX_LIST_NAME_LENGTH = 60;
const MAX_LIST_INDEX = 100;

/** One line of the cart: a product in a colour and size, how many, and the list it was picked from. */
export interface CartLine extends LineInput {
  list?: ListContext;
}

export interface Cart {
  lines: CartLine[];
}

/** Enough to say which line: the product SKU, the colour and the size. */
export interface VariantKey {
  sku: string;
  colour: string;
  size: string;
}

export interface CartProblem {
  code: PricingProblemCode | 'cart_full' | 'bad_list';
  /** Plain words a shopper could read. */
  message: string;
}

export type CartResult =
  | {
      ok: true;
      cart: Cart;
      /** True when a quantity stopped at the limit instead of growing. */
      limitReached: boolean;
    }
  | { ok: false; problem: CartProblem };

export function emptyCart(): Cart {
  return { lines: [] };
}

export function clearCart(): Cart {
  return emptyCart();
}

/** The variant SKU of a line. It identifies the line, so the same variant is never on two lines. */
export function cartLineKey(line: VariantKey): string {
  return variantSku(line.sku, line.colour, line.size);
}

export function isValidListContext(value: unknown): value is ListContext {
  if (typeof value !== 'object' || value === null) return false;
  const { listId, listName, index } = value as Record<string, unknown>;
  return (
    typeof listId === 'string' &&
    listId.trim() !== '' &&
    listId.length <= MAX_LIST_ID_LENGTH &&
    typeof listName === 'string' &&
    listName.trim() !== '' &&
    listName.length <= MAX_LIST_NAME_LENGTH &&
    typeof index === 'number' &&
    Number.isInteger(index) &&
    index >= 1 &&
    index <= MAX_LIST_INDEX
  );
}

/** A copy that holds only the list fields, so nothing extra is carried along. */
function cleanList(list: ListContext): ListContext {
  return { listId: list.listId, listName: list.listName, index: list.index };
}

/**
 * Adds an item. The same product, colour and size merges into its existing line and the
 * quantities add up, stopping at the limit. The line keeps the list it first had, or takes this
 * one if it had none. An item that cannot be sold, or a cart that is full, is refused.
 */
export function addToCart(cart: Cart, item: LineInput, list?: ListContext): CartResult {
  const checked = checkLine(item);
  if ('problem' in checked) return { ok: false, problem: checked.problem };
  if (list !== undefined && !isValidListContext(list)) {
    return {
      ok: false,
      problem: { code: 'bad_list', message: 'The list the item was picked from is not valid.' },
    };
  }

  const key = cartLineKey(item);
  const existing = cart.lines.find((line) => cartLineKey(line) === key);

  if (existing) {
    const wanted = existing.quantity + item.quantity;
    const merged: CartLine = {
      ...existing,
      quantity: Math.min(wanted, MAX_QUANTITY_PER_LINE),
      ...(existing.list === undefined && list !== undefined ? { list: cleanList(list) } : {}),
    };
    return {
      ok: true,
      cart: { lines: cart.lines.map((line) => (line === existing ? merged : line)) },
      limitReached: wanted > MAX_QUANTITY_PER_LINE,
    };
  }

  if (cart.lines.length >= MAX_CART_LINES) {
    return {
      ok: false,
      problem: {
        code: 'cart_full',
        message: `Your cart is full: it holds up to ${MAX_CART_LINES} different items.`,
      },
    };
  }

  const line: CartLine = {
    sku: item.sku,
    colour: item.colour,
    size: item.size,
    quantity: item.quantity,
    ...(list === undefined ? {} : { list: cleanList(list) }),
  };
  return { ok: true, cart: { lines: [...cart.lines, line] }, limitReached: false };
}

/** Removes a line. A line that is not in the cart is ignored. */
export function removeFromCart(cart: Cart, target: VariantKey): Cart {
  const key = cartLineKey(target);
  return { lines: cart.lines.filter((line) => cartLineKey(line) !== key) };
}

/**
 * Sets the quantity of a line. Zero or less removes it, and more than the limit stops at the
 * limit. A line that is not in the cart is left alone. A quantity that is not a whole number is
 * refused.
 */
export function setQuantity(cart: Cart, target: VariantKey, quantity: number): CartResult {
  if (!Number.isInteger(quantity)) {
    return {
      ok: false,
      problem: { code: 'bad_quantity', message: 'The quantity must be a whole number.' },
    };
  }
  const key = cartLineKey(target);
  if (!cart.lines.some((line) => cartLineKey(line) === key)) {
    return { ok: true, cart, limitReached: false };
  }
  if (quantity <= 0) return { ok: true, cart: removeFromCart(cart, target), limitReached: false };

  return {
    ok: true,
    cart: {
      lines: cart.lines.map((line) =>
        cartLineKey(line) === key
          ? { ...line, quantity: Math.min(quantity, MAX_QUANTITY_PER_LINE) }
          : line,
      ),
    },
    limitReached: quantity > MAX_QUANTITY_PER_LINE,
  };
}

/** How many units are in the cart in all, for the count beside the cart icon. */
export function cartQuantity(cart: Cart): number {
  return cart.lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** What the pricing code needs from a cart. The list stays behind, because pricing ignores it. */
export function cartToItemsInput(cart: Cart, currency: string, coupon?: string): ItemsInput {
  return {
    lines: cart.lines.map(({ sku, colour, size, quantity }) => ({ sku, colour, size, quantity })),
    currency,
    ...(coupon === undefined ? {} : { coupon }),
  };
}
