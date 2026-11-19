import { loadCart } from '../components/cart-client.js';
import { currentCurrency } from '../components/currency-switcher.js';
import { applyCouponParams, beginCheckoutParams, stepCompletedAnnouncement } from './announcements.js';
import { whenCurrencySettled } from './currency-wait.js';
import { pushEvent } from './push-event.js';

/**
 * Turns what the checkout page does into announcements to the dataLayer: `begin_checkout` when the page loads with items in the
 * cart, `add_shipping_info` and `add_payment_info` when the address and payment steps are completed, and `apply_coupon` when a
 * discount code is submitted. The page already announces what happens in it (`checkout:step-completed`, from checkout-steps.ts,
 * and `checkout:coupon-submitted`, from checkout-review.ts), and what is left is read from the page itself: `data-track-view`
 * on the heading, `data-track-tier` on each shipping method, and `data-applied-coupon` on the review, so this file keeps no copy
 * of the page's state and knows no price, method or word. What each announcement carries is built in announcements.ts and tested
 * there, and pushEvent checks it against the tracking plan; this file is only the wiring to the page, which cannot be tested
 * without a page and is checked in a real browser.
 *
 * It is loaded by the checkout page only (checkout.astro), so that no other page carries it.
 */

/** The page loaded as a checkout: announced once the visitor's starting currency has arrived, in the currency they end up seeing. */
function announceCheckoutBegun(): void {
  if (!document.querySelector('[data-track-view="checkout"]')) return;
  void whenCurrencySettled().then((currency) => {
    const params = beginCheckoutParams(loadCart().cart.lines, currency);
    if (params) pushEvent('begin_checkout', params);
  });
}

/** The name of the shipping method that is chosen, as the page writes it beside the method. Empty when there is none. */
function chosenTier(): string {
  return document.querySelector<HTMLInputElement>('input[name="shippingMethod"]:checked')?.dataset.trackTier ?? '';
}

/** The code the order review has applied, as the store spells it, which the review writes on itself. Nothing when none is applied. */
function appliedCoupon(): string | undefined {
  return document.querySelector<HTMLElement>('[data-checkout-review]')?.dataset.appliedCoupon || undefined;
}

/** A step was completed, which a shopper does again whenever they edit it and continue: each time counts. */
function handleStepCompleted(event: Event): void {
  const step = (event as CustomEvent<{ step?: unknown } | null>).detail?.step;
  if (typeof step !== 'string') return;
  const made = stepCompletedAnnouncement(step, loadCart().cart.lines, currentCurrency(), {
    shippingTier: chosenTier(),
    coupon: appliedCoupon(),
  });
  if (made) pushEvent(made.event, made.params);
}

/** A code was submitted, and the review says how it went. The text that was typed is never in what the review says. */
function handleCouponSubmitted(event: Event): void {
  const detail = (event as CustomEvent<{ status?: unknown; code?: unknown } | null>).detail;
  if (!detail || typeof detail.status !== 'string') return;
  const params = applyCouponParams(detail.status, typeof detail.code === 'string' ? detail.code : undefined);
  if (params) pushEvent('apply_coupon', params);
}

let started = false;

/** Starts listening. Safe to call more than once. */
export function initCheckoutTracking(): void {
  if (started) return;
  started = true;
  announceCheckoutBegun();
  document.addEventListener('checkout:step-completed', handleStepCompleted);
  document.addEventListener('checkout:coupon-submitted', handleCouponSubmitted);
}
