import { askForStartingCurrency, currentCurrency } from '../components/currency-switcher.js';
import type { CurrencyCode } from '../store/currencies.js';
import { parseListContext } from '../engine/list-handoff.js';
import {
  selectItemParams,
  selectPromotionParams,
  viewItemListParams,
  viewPromotionParams,
  type ListedProduct,
} from './announcements.js';
import { parseTrackable } from './items.js';
import { parsePromotion } from './promotions.js';
import { pushEvent } from './push-event.js';
import { isSeen, seenAtRatio } from './seen.js';
import { settledAfter } from './settled.js';

/**
 * Turns what a store page does into announcements to the dataLayer. The pages already announce most of what
 * happens (the cart, the popup, the currency), and what is left is read from the page itself, from `data-track-*`
 * attributes that the build wrote in, so this file knows no product, price or word. Every announcement goes
 * through pushEvent, which checks it against the tracking plan. What each one carries is built in
 * announcements.ts and items.ts, and tested there; this file is only the wiring to the page, which cannot be
 * tested without a page and is checked in a real browser.
 */

/** How long an announcement with a price waits for a first-time visitor's starting currency to arrive. */
const SETTLE_LIMIT_MS = 1500;

/** The currency to record a price in: the one the visitor ends up seeing, once the starting currency has arrived. */
function whenCurrencySettled(): Promise<CurrencyCode> {
  return settledAfter(askForStartingCurrency(), SETTLE_LIMIT_MS).then(() => currentCurrency());
}

/** Steps for the browser to watch a block at, a fixed distance apart, as a safety net for a page whose size changes after it starts. */
const COARSE_STEPS = Array.from({ length: 41 }, (_, index) => index / 40);

interface SeenTarget {
  element: Element;
  /** Runs once, the first time the element is seen (src/tracking/seen.ts). */
  then: () => void;
}

/**
 * Watches elements, each until it is seen once, with one observer so that two elements seen at the same moment
 * are announced in the order they are on the page. Each is watched at the exact share where it becomes seen
 * (seenAtRatio), because the browser reports a crossing of a step and nothing in between.
 */
function whenSeen(targets: SeenTarget[]): void {
  if (typeof IntersectionObserver === 'undefined' || targets.length === 0) return;
  const waiting = new Map(targets.map(({ element, then }) => [element, then]));
  const screen = window.innerHeight;
  const exact = targets.map(({ element }) => seenAtRatio(element.getBoundingClientRect().height, screen));
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const then = waiting.get(entry.target);
        if (!then) continue;
        const height = entry.rootBounds?.height ?? window.innerHeight;
        if (isSeen(entry.intersectionRect.height, entry.boundingClientRect.height, height)) {
          waiting.delete(entry.target);
          observer.unobserve(entry.target);
          then();
        }
      }
    },
    { threshold: [...new Set([...COARSE_STEPS, ...exact])].sort((a, b) => a - b) },
  );
  for (const { element } of targets) observer.observe(element);
}

/** The products a block of cards holds, each with what the page carries about it and the list it is in. */
function listedProducts(block: Element): ListedProduct[] {
  const products: ListedProduct[] = [];
  for (const card of block.querySelectorAll<HTMLElement>('a[data-track-item]')) {
    const trackable = parseTrackable(card.dataset.trackItem);
    const list = parseListContext(card.dataset.listHandoffContext);
    if (trackable && list) products.push({ trackable, list });
  }
  return products;
}

/**
 * What to do when a block of the page is seen. The home page's hero banner is a promotion; each of its collections is
 * a list of products, announced in the currency the visitor ends up seeing. Each is announced once per page.
 */
function targetFor(element: HTMLElement): SeenTarget | undefined {
  if (element.dataset.trackSeen === 'promotion') {
    const promotion = parsePromotion(element.dataset.trackPromotion);
    if (!promotion) return undefined;
    return { element, then: () => pushEvent('view_promotion', viewPromotionParams(promotion)) };
  }
  if (element.dataset.trackSeen === 'list') {
    return {
      element,
      then: () => {
        void whenCurrencySettled().then((currency) => {
          const params = viewItemListParams(listedProducts(element), currency);
          if (params) pushEvent('view_item_list', params);
        });
      },
    };
  }
  return undefined;
}

/** One listener for the whole page, so a click on anything that was added later is heard too. */
function handleClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const card = target.closest<HTMLElement>('a[data-track-item]');
  if (card) {
    const trackable = parseTrackable(card.dataset.trackItem);
    const list = parseListContext(card.dataset.listHandoffContext);
    if (trackable && list) pushEvent('select_item', selectItemParams({ trackable, list }, currentCurrency()));
  }

  const callToAction = target.closest('[data-track-promotion-cta]');
  if (callToAction) {
    const holder = callToAction.closest<HTMLElement>('[data-track-promotion]');
    const promotion = parsePromotion(holder?.dataset.trackPromotion);
    if (promotion) pushEvent('select_promotion', selectPromotionParams(promotion));
  }
}

let started = false;

/** Starts listening. Safe to call more than once. */
export function initTracking(): void {
  if (started) return;
  started = true;
  const targets: SeenTarget[] = [];
  for (const element of document.querySelectorAll<HTMLElement>('[data-track-seen]')) {
    const target = targetFor(element);
    if (target) targets.push(target);
  }
  whenSeen(targets);
  document.addEventListener('click', handleClick);
}
