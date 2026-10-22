import type { ListContext } from '../engine/catalog.js';
import type { CurrencyCode } from '../store/currencies.js';
import { itemFromTrackable, type TrackableProduct, type TrackedItem } from './items.js';
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
