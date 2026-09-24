import type { CurrencyCode } from '../store/currencies';
import { cartQuantity, cartToItemsInput, type Cart } from './cart';
import { findProduct } from './catalog';
import { formatMoney } from './money';
import { priceItems } from './pricing';
import { freeShippingProgress } from './shipping';

/**
 * What a cart panel needs to show, worked out from a cart and a currency: every price already
 * written the way it will be read. It shows things and decides nothing, so the drawer and the cart
 * page can never disagree with each other, or with the pricing code, about what a line costs.
 * Prices come from `priceItems`, the same function the server will use, and the cart itself never
 * holds one. Every word a shopper reads is added by the page, not here.
 */

export interface CartViewLine {
  /** The variant SKU, which identifies the line: the same one is never on two lines. */
  key: string;
  sku: string;
  /** For the link back to the product page. */
  slug: string;
  name: string;
  colour: string;
  size: string;
  /** For example "Ink / M". */
  variant: string;
  quantity: number;
  unitPrice: string;
  /** The price before the sale. Only on a sale item. */
  compareAtUnitPrice: string | undefined;
  lineTotal: string;
}

export interface CartView {
  currency: CurrencyCode;
  empty: boolean;
  /** Every unit in the cart, for the count beside the cart icon. */
  quantity: number;
  lines: CartViewLine[];
  subtotal: string;
  freeShipping: {
    reached: boolean;
    /** How much more the cart needs for free Standard shipping, or the zero amount once it has it. */
    remaining: string;
    /** How far the cart is towards the free-shipping line, from 0 to 100, and 100 only once it is there. */
    percent: number;
  };
}

export function cartView(cart: Cart, currency: CurrencyCode): CartView {
  const priced = priceItems(cartToItemsInput(cart, currency));
  // A cart is checked line by line when it is built or opened, so this cannot happen for a real one.
  if (!priced.ok) throw new Error(priced.problems.map((problem) => problem.message).join(' '));

  const { items } = priced;
  const money = (cents: number) => formatMoney(cents, currency);

  return {
    currency,
    empty: items.lines.length === 0,
    quantity: cartQuantity(cart),
    lines: items.lines.map((line) => ({
      key: line.variantSku,
      sku: line.sku,
      slug: findProduct(line.sku)!.slug,
      name: line.name,
      colour: line.colour,
      size: line.size,
      variant: line.variant,
      quantity: line.quantity,
      unitPrice: money(line.unitPrice),
      compareAtUnitPrice: line.compareAtUnitPrice === undefined ? undefined : money(line.compareAtUnitPrice),
      lineTotal: money(line.lineNet),
    })),
    subtotal: money(items.itemsSubtotal),
    freeShipping: {
      reached: items.freeShippingRemaining === 0,
      remaining: money(items.freeShippingRemaining),
      percent: freeShippingProgress(currency, items.itemsNet),
    },
  };
}
