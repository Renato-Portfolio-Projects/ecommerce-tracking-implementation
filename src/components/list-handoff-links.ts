import type { ListContext } from '../engine/catalog';
import { listHandoffKey, serializeListContext } from '../engine/list-handoff';

/**
 * Wires every product card that carries a list context (`data-list-handoff-sku` and
 * `data-list-handoff-context`) so that clicking it remembers, for the product page it leads to,
 * which list it was picked from. See src/engine/list-handoff.ts for why this lives in
 * sessionStorage instead of the link's own URL.
 */
export function initListHandoffLinks(): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-list-handoff-sku]')) {
    link.addEventListener('click', () => {
      const sku = link.dataset.listHandoffSku;
      const raw = link.dataset.listHandoffContext;
      if (!sku || !raw) return;
      const context = JSON.parse(raw) as ListContext;
      try {
        sessionStorage.setItem(listHandoffKey(sku), serializeListContext(context));
      } catch {
        // A visitor blocking storage still gets to the product page; it just has no list context.
      }
    });
  }
}
