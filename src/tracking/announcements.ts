import type { CartChanges, CartLine } from '../engine/cart.js';
import type { ListContext } from '../engine/catalog.js';
import type { CurrencyCode } from '../store/currencies.js';
import { itemFromTrackable, trackedLines, type TrackableProduct, type TrackedItem } from './items.js';
import type { Promotion } from './promotions.js';

/**
 * What each announcement from a home page carries, built from what the page carries as data, so that the code
 * that listens to the page and the tests both use one description of it. pushEvent checks the result against
 * the tracking plan.
 */

/** A product in a list: what the page carries about it, and the list it is in with its place there. */
export interface ListedProduct {
  trackable: TrackableProduct;
  list: ListContext;
}

/** A type and not an interface, so that it can be handed to pushEvent as the plain record it is. */
export type ListAnnouncement = {
  item_list_id: string;
  item_list_name: string;
  items: TrackedItem[];
};

/** A list that was seen: its id and name and every product in it, in the currency shown. Nothing for a list with no products. */
export function viewItemListParams(products: ListedProduct[], currency: CurrencyCode): ListAnnouncement | undefined {
  if (products.length === 0) return undefined;
  const { listId, listName } = products[0].list;
  return {
    item_list_id: listId,
    item_list_name: listName,
    items: products.map(({ trackable, list }) => itemFromTrackable(trackable, currency, list)),
  };
}

/** A card that was clicked: the list it is in, and the one product with its place there. */
export function selectItemParams(product: ListedProduct, currency: CurrencyCode): ListAnnouncement {
  return {
    item_list_id: product.list.listId,
    item_list_name: product.list.listName,
    items: [itemFromTrackable(product.trackable, currency, product.list)],
  };
}

/** A promotion that was seen. The popup's carries how it was opened; the hero banner has no source. */
export function viewPromotionParams(promotion: Promotion, source?: string): Record<string, string> {
  return source === undefined ? { ...promotion } : { ...promotion, source };
}

/** A promotion that was clicked. The plan sends the source with a view only. */
export function selectPromotionParams(promotion: Promotion): Record<string, string> {
  return { ...promotion };
}

/** What a shopping announcement carries: the currency, the value of the items in it, and the items. */
export type ShoppingAnnouncement = { currency: CurrencyCode; value: number; items: TrackedItem[] };

/** A product page that loaded: the one product, its price in the currency shown, and that price as the value. No colour or size is chosen yet. */
export function viewItemParams(trackable: TrackableProduct, currency: CurrencyCode): ShoppingAnnouncement {
  const item = itemFromTrackable(trackable, currency);
  return { currency, value: item.price, items: [item] };
}

/**
 * Cart lines that went into the cart, came out of it, or are being looked at: the lines as items with their variant,
 * quantity and the list they were picked from, and the value of them all, priced by the cart's own pricing. Nothing for
 * no lines, so an empty cart announces nothing.
 */
export function cartParams(lines: CartLine[], currency: CurrencyCode): ShoppingAnnouncement | undefined {
  const { items, value } = trackedLines(lines, currency);
  return items.length === 0 ? undefined : { currency, value, items };
}

/** One announcement that a change to the cart makes: the event, and what it carries. */
export interface CartChangeAnnouncement {
  event: 'add_to_cart' | 'remove_from_cart';
  params: ShoppingAnnouncement;
}

/**
 * What a change to the cart announces: an `add_to_cart` for the units that went in and a `remove_from_cart` for the
 * units that came out, in that order, each only when units moved. A change with no `changes` is the cart being
 * emptied because an order was placed (see cart-client.ts), which is not the shopper taking anything out, so it
 * announces nothing.
 */
export function cartChangeAnnouncements(changes: CartChanges | undefined, currency: CurrencyCode): CartChangeAnnouncement[] {
  if (changes === undefined) return [];
  const announcements: CartChangeAnnouncement[] = [];
  const added = cartParams(changes.added, currency);
  if (added) announcements.push({ event: 'add_to_cart', params: added });
  const removed = cartParams(changes.removed, currency);
  if (removed) announcements.push({ event: 'remove_from_cart', params: removed });
  return announcements;
}
