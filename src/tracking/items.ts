import { cartToItemsInput, type CartLine } from '../engine/cart.js';
import { findCollection, type ListContext } from '../engine/catalog.js';
import { amountsInAllCurrencies } from '../engine/money.js';
import { priceItems } from '../engine/pricing.js';
import { CURRENCIES, type CurrencyCode } from '../store/currencies.js';
import type { Product } from '../store/products.js';

/**
 * Builds the items that go into an announcement, in the GA4 item schema that `docs/tracking-plan.md` describes:
 * `item_id` is the product's SKU, `item_category` the collection's name, `price` the price of one unit in the
 * currency being shown (the sale price on a sale item), and a cart line adds its variant, its quantity and the
 * list it was picked from (`item_list_id`, `item_list_name` and `index`, counting from 1).
 */
export interface TrackedItem {
  item_id: string;
  item_name: string;
  item_category: string;
  item_variant?: string;
  price: number;
  quantity?: number;
  item_list_id?: string;
  item_list_name?: string;
  index?: number;
}

/**
 * What a page carries about one product, written into the page when it is built, so that the script never works
 * out a price itself. The price is a number in every currency, from the same conversion as the price the page
 * shows as text, and the script picks the one for the currency being shown.
 */
export interface TrackableProduct {
  item_id: string;
  item_name: string;
  item_category: string;
  price: Record<CurrencyCode, number>;
}

/** Cart lines as items, with the value of the lot (the items after any discount, without shipping or tax). */
export interface TrackedLines {
  items: TrackedItem[];
  value: number;
}

/** A product as a page carries it, with its price in every currency. Run when the page is built. */
export function trackableProduct(product: Product): TrackableProduct {
  return {
    item_id: product.sku,
    item_name: product.name,
    item_category: findCollection(product.collection)!.name,
    price: amountsInAllCurrencies(product.priceCad),
  };
}

function listFields(list: ListContext | undefined) {
  return list === undefined
    ? {}
    : { item_list_id: list.listId, item_list_name: list.listName, index: list.index };
}

/** A page's product as an item in one currency, with the list it was picked from if there was one. */
export function itemFromTrackable(
  trackable: TrackableProduct,
  currency: CurrencyCode,
  list?: ListContext,
): TrackedItem {
  return {
    item_id: trackable.item_id,
    item_name: trackable.item_name,
    item_category: trackable.item_category,
    price: trackable.price[currency],
    ...listFields(list),
  };
}

/** Reads what a page carries about a product. Anything missing, damaged or incomplete gives nothing instead of throwing. */
export function parseTrackable(raw: string | undefined): TrackableProduct | undefined {
  if (raw === undefined || raw === '') return undefined;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof data !== 'object' || data === null) return undefined;

  const { item_id, item_name, item_category, price } = data as Record<string, unknown>;
  if (typeof item_id !== 'string' || typeof item_name !== 'string' || typeof item_category !== 'string') {
    return undefined;
  }
  if (typeof price !== 'object' || price === null) return undefined;

  const amounts: Partial<Record<CurrencyCode, number>> = {};
  for (const { code } of CURRENCIES) {
    const amount = (price as Record<string, unknown>)[code];
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return undefined;
    amounts[code] = amount;
  }
  return { item_id, item_name, item_category, price: amounts as Record<CurrencyCode, number> };
}

/**
 * Cart lines as items in one currency, with their total value. Prices come from `priceItems`, the cart's own
 * pricing, so an event never disagrees with the cart about what a line costs. A cart is checked line by line
 * when it is built, so lines that cannot be priced do not happen; if one did, nothing is announced for it.
 */
export function trackedLines(lines: CartLine[], currency: CurrencyCode): TrackedLines {
  const priced = priceItems(cartToItemsInput({ lines }, currency));
  if (!priced.ok) return { items: [], value: 0 };
  const { items } = priced;
  return {
    items: items.lines.map((line, index) => ({
      item_id: line.sku,
      item_name: line.name,
      item_category: line.category,
      item_variant: line.variant,
      price: line.unitPrice / 100,
      quantity: line.quantity,
      ...listFields(lines[index].list),
    })),
    value: items.itemsNet / 100,
  };
}
