import type { ListContext } from './catalog';

/**
 * Where a product page learns which list it was picked from. A product card writes its list
 * context to sessionStorage right before navigating to the product page; the product page reads
 * it once, on its own load, and then removes it. A visitor who lands on a product page any other
 * way (a shared link, a bookmark, a refresh) reads nothing, because they never picked the product
 * from a list.
 *
 * This lives in sessionStorage, not the URL, so a shared or bookmarked product link never carries
 * a list context it did not earn. It is keyed by SKU, so choosing two different products, in two
 * tabs or one after another, never mixes up which list each one came from. The key and the parsing
 * live here; the sessionStorage calls themselves are made by the small inline scripts that use them.
 */

export function listHandoffKey(sku: string): string {
  return `second-impression:list-handoff:${sku}`;
}

export function serializeListContext(context: ListContext): string {
  return JSON.stringify(context);
}

/** Reads a saved list context. Anything missing or damaged gives nothing instead of throwing. */
export function parseListContext(raw: string | null | undefined): ListContext | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof data !== 'object' || data === null) return undefined;

  const { listId, listName, index } = data as Record<string, unknown>;
  if (typeof listId !== 'string' || typeof listName !== 'string' || typeof index !== 'number') {
    return undefined;
  }
  return { listId, listName, index };
}
