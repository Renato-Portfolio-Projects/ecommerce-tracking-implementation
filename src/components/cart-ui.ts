import { cartView, type CartView, type CartViewLine } from '../engine/cart-view';
import { findProduct, variantLabel } from '../engine/catalog';
import { fill } from '../engine/fill';
import { ART } from '../store/art';
import { MAX_QUANTITY_PER_LINE } from '../store/policy';
import type { Colour } from '../store/products';
import { CART_STORAGE_KEY, changeQuantity, loadCart, removeItem, type CartChange } from './cart-client';
import { currentCurrency } from './currency-switcher';
import { garmentSvg } from './garments';

/**
 * Draws the cart into every cart panel on the page, and does what its buttons ask. The drawer and the
 * cart page are the same panel, so this finds each one, gives it the cart in the shopper's currency
 * (worked out by cartView in src/engine, which does the arithmetic), and redraws it whenever the cart
 * or the currency changes. A line that is already on the page is updated where it stands, not
 * rebuilt, so a button that was just pressed keeps the keyboard focus.
 */

/**
 * The sentences this script fills in. CartPanel.astro writes them into the panel as data (one
 * `data-words` attribute), taken from the words file, so that this script does not have to carry the
 * whole words file, which would add about ten kilobytes to every store page. The blanks, such as
 * {product} and {variant}, are filled by `fill`.
 */
interface PanelWords {
  limitReached: string;
  droppedOne: string;
  droppedMany: string;
  freeAway: string;
  freeReached: string;
  removeLabel: string;
  decrease: string;
  increase: string;
  added: string;
  was: string;
}

function find<T extends Element>(root: ParentNode, selector: string): T {
  return root.querySelector<T>(selector)!;
}

function setText(root: ParentNode, selector: string, value: string): void {
  find(root, selector).textContent = value;
}

/**
 * Makes a new line by copying the panel's `<template>`. Only what never changes for a line is set here:
 * which variant it is (kept on the element, so the buttons know what to change without looking it up)
 * and its garment drawing. The drawing is the one thing put in as markup, not as text. It is made from
 * the store's own data by garmentSvg, and it has no label because the product's name is beside it.
 */
function createLine(template: HTMLTemplateElement, line: CartViewLine): HTMLElement {
  const item = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
  item.dataset.key = line.key;
  item.dataset.sku = line.sku;
  item.dataset.colour = line.colour;
  item.dataset.size = line.size;
  const art = ART[line.sku];
  find(item, '[data-cart-thumb]').innerHTML = garmentSvg(art.kind, line.colour as Colour, art.print);
  return item;
}

/**
 * Fills a line in, or brings it up to date: the name, the variant, the prices, the quantity and the
 * total, all as plain text (`textContent`), so whatever a value contains is shown and never run.
 * This runs on every redraw, for lines that are already on the page as well as new ones.
 *
 * The three button labels set at the end are for screen readers, and they are not the same thing as
 * the description of a product's drawing (`garmentLabel`, on the home and product pages). Those
 * describe a picture. These describe an action, and they need the line's own name and variant, which
 * is known only here, so that each Remove button says which line it removes, not just "Remove".
 */
function updateLine(item: HTMLElement, line: CartViewLine, words: PanelWords): void {
  item.dataset.quantity = String(line.quantity);
  for (const link of item.querySelectorAll<HTMLAnchorElement>('[data-cart-name], [data-cart-thumb]')) {
    link.href = `/products/${line.slug}`;
  }
  setText(item, '[data-cart-name]', line.name);
  setText(item, '[data-cart-variant]', line.variant);
  setText(item, '[data-cart-unit]', line.unitPrice);
  const was = find<HTMLElement>(item, '[data-cart-was]');
  was.hidden = line.compareAtUnitPrice === undefined;
  was.textContent = line.compareAtUnitPrice === undefined ? '' : fill(words.was, { price: line.compareAtUnitPrice });
  setText(item, '[data-cart-qty]', String(line.quantity));
  setText(item, '[data-cart-total]', line.lineTotal);

  const values = { product: line.name, variant: line.variant };
  const decrease = find<HTMLButtonElement>(item, '[data-cart-decrease]');
  decrease.disabled = line.quantity <= 1;
  decrease.setAttribute('aria-label', fill(words.decrease, values));
  find(item, '[data-cart-increase]').setAttribute('aria-label', fill(words.increase, values));
  find(item, '[data-cart-remove]').setAttribute('aria-label', fill(words.removeLabel, values));
}

/**
 * Makes the list of lines on the page match the cart, without rebuilding it. Each line on the page is
 * known by its variant (`data-key`). A line that is no longer in the cart is removed, a line that is
 * new is made from the template, and every line is updated in place and put in the cart's order. Not
 * rebuilding matters for the keyboard: a button that is pressed stays the same button, so the focus
 * stays on it. A rebuilt button would be a new one, the focus would be lost, and a shopper using the
 * keyboard would have to tab back to where they were.
 */
function renderLines(panel: HTMLElement, view: CartView, words: PanelWords): void {
  const list = find<HTMLElement>(panel, '[data-cart-lines]');
  const template = find<HTMLTemplateElement>(panel, 'template[data-cart-line]');
  const onPage = new Map<string, HTMLElement>();
  for (const child of list.children) onPage.set((child as HTMLElement).dataset.key!, child as HTMLElement);

  const wanted = new Set(view.lines.map((line) => line.key));
  for (const [key, item] of onPage) if (!wanted.has(key)) item.remove();

  view.lines.forEach((line, index) => {
    const item = onPage.get(line.key) ?? createLine(template, line);
    updateLine(item, line, words);
    if (list.children[index] !== item) list.insertBefore(item, list.children[index] ?? null);
  });
}

/**
 * Draws one panel: shows the empty message or the lines and summary (the `hidden` attributes), then the
 * lines, the subtotal, the free-shipping sentence and bar, and the two message areas. The notice is
 * the visible one and is empty unless a warning applies; the announcement is for screen readers only.
 * Both stay in the page when empty, because a screen reader only speaks a message that is put into
 * an area that was already there.
 */
function renderPanel(panel: HTMLElement, view: CartView, notice: string, announcement: string, words: PanelWords): void {
  find<HTMLElement>(panel, '[data-cart-empty]').hidden = !view.empty;
  find<HTMLElement>(panel, '[data-cart-lines]').hidden = view.empty;
  find<HTMLElement>(panel, '[data-cart-summary]').hidden = view.empty;
  renderLines(panel, view, words);
  setText(panel, '[data-cart-subtotal]', view.subtotal);
  setText(panel, '[data-cart-free]', view.freeShipping.reached ? words.freeReached : fill(words.freeAway, { amount: view.freeShipping.remaining }));
  find<HTMLElement>(panel, '[data-cart-fill]').style.width = `${view.freeShipping.percent}%`;
  setText(panel, '[data-cart-notice]', notice);
  setText(panel, '[data-cart-announce]', announcement);
}

/**
 * Reads the saved cart and draws it into every panel on the page. The prices are worked out here, in
 * the browser, in the currency the page is showing now (`currentCurrency`, the same value the
 * currency selector uses), which is why a currency change has to trigger a redraw. `change` says
 * what just happened, if anything, and decides the two messages; a redraw with no change (the page
 * opening, another tab, a new currency) shows only the warning about lines that were dropped.
 */
function renderAll(change: CartChange = {}): void {
  const { cart, dropped } = loadCart();
  const view = cartView(cart, currentCurrency());

  for (const panel of document.querySelectorAll<HTMLElement>('[data-cart-panel]')) {
    const words = JSON.parse(panel.dataset.words ?? '{}') as PanelWords;
    let notice = '';
    if (change.limitReached) notice = fill(words.limitReached, { max: MAX_QUANTITY_PER_LINE });
    else if (dropped.length === 1) notice = words.droppedOne;
    else if (dropped.length > 1) notice = fill(words.droppedMany, { count: dropped.length });

    const announcement = change.added
      ? fill(words.added, { product: findProduct(change.added.sku)!.name, variant: variantLabel(change.added.colour, change.added.size) })
      : '';
    renderPanel(panel, view, notice, announcement, words);
  }
}

/**
 * Does what a line's plus, minus and Remove buttons ask. One listener on the whole document handles
 * every button, including those on lines that were added later. The quantity is set from what the
 * line currently shows (`data-quantity`) plus or minus one, and the change comes back as a
 * `cart:changed` event that redraws the panel; this function draws nothing itself.
 */
function handleClick(event: MouseEvent): void {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-cart-increase], [data-cart-decrease], [data-cart-remove]');
  if (!button) return;

  const item = button.closest<HTMLElement>('.cart-line')!;
  const target = { sku: item.dataset.sku!, colour: item.dataset.colour!, size: item.dataset.size! };

  if (button.hasAttribute('data-cart-remove')) {
    // Once the line is gone its button is too, so focus goes to the next line's, or to the heading.
    const panel = item.closest<HTMLElement>('[data-cart-panel]')!;
    const neighbour = (item.nextElementSibling ?? item.previousElementSibling) as HTMLElement | null;
    removeItem(target);
    (neighbour?.querySelector<HTMLElement>('[data-cart-remove]') ?? panel.querySelector<HTMLElement>('.cart-title'))?.focus();
    return;
  }
  changeQuantity(target, Number(item.dataset.quantity) + (button.hasAttribute('data-cart-increase') ? 1 : -1));
}

/**
 * Starts the cart screens: draws the cart once, then redraws it when it changes here (`cart:changed`),
 * when the currency is switched (`currency:changed`, from currency-switcher.ts), and when another tab
 * changes the saved cart. The browser sends that last one as a `storage` event to every other open tab
 * of the site whenever saved data changes, so a cart open in two tabs never shows a stale screen.
 */
export function initCartUi(): void {
  document.addEventListener('click', handleClick);
  document.addEventListener('cart:changed', (event) => renderAll((event as CustomEvent<CartChange>).detail));
  document.addEventListener('currency:changed', () => renderAll());
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === CART_STORAGE_KEY) renderAll();
  });
  renderAll();
}
