import { checkCoupon } from '../engine/coupons';
import { checkPayment, type KeptCard } from '../demo/test-cards';
import { fill } from '../engine/fill';
import { formatMoney } from '../engine/money';
import { priceOrder, type PricedOrder } from '../engine/pricing';
import { cartToItemsInput } from '../engine/cart';
import { shippingCost } from '../engine/shipping';
import { SHIPPING_METHODS } from '../store/shipping-methods';
import type { CurrencyCode } from '../store/currencies';
import { clearCart, loadCart } from './cart-client';
import { clearIdempotencyKey, currentIdempotencyKey } from './checkout-idempotency';
import { currentCurrency } from './currency-switcher';

/**
 * The order summary: shown only once the three steps above are all complete, priced for real from the same
 * code the cart already uses (src/engine/pricing.ts), so the amount here is always the amount that would be
 * charged. It re-prices whenever anything that affects the total changes: a step is completed or reopened, the
 * shipping method is chosen, a coupon is applied, or the cart itself changes (another tab, say).
 *
 * Whether the three steps are all done is read from the page itself, the same way a shopper sees it (each
 * step closed with its summary showing), rather than asked of checkout-steps.ts directly, so the two files
 * do not need to know about each other beyond the one event that says something changed.
 */

const section = () => document.querySelector<HTMLElement>('[data-checkout-review]')!;
const linesList = () => document.querySelector<HTMLElement>('[data-checkout-review-lines]')!;
const lineTemplate = () => document.querySelector<HTMLTemplateElement>('[data-checkout-review-line]')!;
const couponForm = () => document.querySelector<HTMLFormElement>('[data-checkout-coupon-form]')!;
const couponMessage = () => document.querySelector<HTMLElement>('[data-checkout-coupon-message]')!;
const couponInput = () => document.querySelector<HTMLInputElement>('[data-checkout-coupon-form] [name=coupon]')!;
const placeOrderButton = () => document.querySelector<HTMLButtonElement>('[data-checkout-place-order]')!;
const orderErrorBox = () => document.querySelector<HTMLElement>('[data-checkout-order-error]')!;

/** The coupon last sent for pricing: the empty string once nothing has been applied, or an "Apply" gave nothing usable. */
let appliedCoupon = '';

/** Set once "Place order" succeeds, so nothing still on the page (a stray coupon submit, the cart emptying
 * itself right before the browser navigates away) redraws the review in the moment before the page unloads. */
let placed = false;

function allStepsComplete(): boolean {
  return [...document.querySelectorAll<HTMLDetailsElement>('[data-checkout-step]')].every((step) => {
    const summary = step.querySelector<HTMLElement>('[data-checkout-summary]');
    return !step.open && !!summary && !summary.hidden;
  });
}

function addressDestination(): { country: string; province?: string } {
  const country = document.querySelector<HTMLSelectElement>('[data-checkout-form="address"] [name=country]')!.value;
  const province = document.querySelector<HTMLSelectElement>('[data-checkout-form="address"] [name=province]')!.value;
  return { country, province };
}

function chosenShippingMethod(): string {
  return document.querySelector<HTMLInputElement>('input[name=shippingMethod]:checked')!.value;
}

/** Prices the order as it stands right now: the cart's items, the chosen shipping method and destination, and
 * the last-applied coupon, if any. */
function priceNow() {
  const { cart } = loadCart();
  const currency = currentCurrency();
  return { currency, result: priceOrder({ ...cartToItemsInput(cart, currency, appliedCoupon || undefined), destination: addressDestination(), shippingMethod: chosenShippingMethod() }) };
}

/** Shows each shipping method's own price beside its name, in the current currency, as if it were chosen. */
function showShippingPrices(currency: CurrencyCode, itemsNet: number, words: { free: string }): void {
  for (const method of SHIPPING_METHODS) {
    const cost = shippingCost(method, currency, itemsNet);
    const label = document.querySelector<HTMLElement>(`[data-checkout-shipping-price="${method.id}"]`)!;
    label.textContent = cost === 0 ? words.free : formatMoney(cost, currency);
  }
}

function renderLines(order: PricedOrder): void {
  const list = linesList();
  list.replaceChildren();
  const template = lineTemplate();
  for (const line of order.lines) {
    const node = template.content.cloneNode(true) as DocumentFragment;
    node.querySelector<HTMLElement>('[data-checkout-review-qty]')!.textContent = String(line.quantity);
    node.querySelector<HTMLElement>('[data-checkout-review-name]')!.textContent = line.name;
    node.querySelector<HTMLElement>('[data-checkout-review-variant]')!.textContent = line.variant;
    // Before any coupon, the same basis as the Subtotal row: the coupon's whole effect is the one Discount
    // row below, not a second copy of it quietly baked into each line's own price.
    node.querySelector<HTMLElement>('[data-checkout-review-price]')!.textContent = formatMoney(line.unitPrice * line.quantity, order.currency);
    list.append(node);
  }
}

function renderTotals(order: PricedOrder, words: { free: string }): void {
  const cell = (name: string) => document.querySelector<HTMLElement>(`[data-checkout-total="${name}"]`)!;
  cell('subtotal').textContent = formatMoney(order.itemsSubtotal, order.currency);
  cell('discount').textContent = `−${formatMoney(order.discount, order.currency)}`;
  cell('shipping').textContent = order.shipping === 0 ? words.free : formatMoney(order.shipping, order.currency);
  cell('tax').textContent = formatMoney(order.tax, order.currency);
  cell('total').textContent = formatMoney(order.total, order.currency);
  document.querySelector<HTMLElement>('[data-checkout-discount-row]')!.hidden = order.discount === 0;
}

function showCouponMessage(text: string): void {
  const box = couponMessage();
  box.textContent = text;
  box.hidden = text === '';
}

interface ReviewWords {
  free: string;
  couponValid: string;
  couponInvalid: string;
  couponExpired: string;
  orderFailed: string;
}

const wordsOf = () => JSON.parse(section().dataset.words ?? '{}') as ReviewWords;

/** Re-prices and redraws the whole review, if it is showing. Does nothing otherwise, so nothing is computed for a
 * shopper who has not reached it yet, and does nothing once the order is placed, so the cart emptying itself
 * right before the browser navigates to the thank-you page never re-prices an order that is already done. */
function redraw(): void {
  if (placed) return;
  section().hidden = !allStepsComplete();
  if (section().hidden) return;
  const words = wordsOf();
  const { currency, result } = priceNow();
  if (!result.ok) {
    // Only reachable if the address step's own values were valid moments ago and no longer are, which the
    // address step's own check would already have caught on its next submission; nothing to show here.
    return;
  }
  renderLines(result.order);
  renderTotals(result.order, { free: words.free });
  showShippingPrices(currency, result.order.itemsNet, { free: words.free });
}

/** A changed cart is honestly a new attempt at checking out, whatever caused the change: reusing a stale
 * idempotency key here would be a bug, not a safety net. */
function handleCartChanged(): void {
  clearIdempotencyKey();
  redraw();
}

function applyCoupon(event: SubmitEvent): void {
  event.preventDefault();
  if (placed) return;
  const typed = couponInput().value;
  const checked = checkCoupon(typed);
  const words = wordsOf();
  if (checked.status === 'none') {
    appliedCoupon = '';
    showCouponMessage('');
  } else if (checked.status === 'valid') {
    appliedCoupon = typed;
    showCouponMessage(fill(words.couponValid, { code: checked.coupon.code, percent: checked.coupon.percentOff }));
  } else {
    appliedCoupon = '';
    showCouponMessage(checked.status === 'expired' ? words.couponExpired : words.couponInvalid);
  }
  redraw();
}

/** Told the moment "Place order" sends its request, so checkout-steps.ts stops the three steps above being
 * reopened while it is in flight. A real request has real latency, unlike the stand-in this replaces, so
 * there is now a genuine window where a step could be reopened and edited while a request already carrying
 * its old values is on its way to the server. The two files know nothing else about each other, the same way
 * checkout-steps.ts's own event works the other way round. */
function announceOrderSubmitting(): void {
  document.dispatchEvent(new CustomEvent('checkout:order-submitting'));
}

/** Told if that request fails, so the steps unlock again: a shopper who needs to fix something, or simply
 * retry, would otherwise have no way to. */
function announceOrderSubmitFailed(): void {
  document.dispatchEvent(new CustomEvent('checkout:order-submit-failed'));
}

function showOrderError(text: string): void {
  const box = orderErrorBox();
  box.textContent = text;
  box.hidden = false;
}

function hideOrderError(): void {
  orderErrorBox().hidden = true;
}

/** Reads a step's own raw field values, exactly as typed, for the server to check again: nothing here is
 * validated in the browser a second time, since /api/order's whole job is checking it for itself. */
function fieldValue(formSelector: string, name: string): string {
  return document.querySelector<HTMLInputElement | HTMLSelectElement>(`${formSelector} [name=${name}]`)!.value;
}

function contactFields(): { email: string; phone: string } {
  return { email: fieldValue('[data-checkout-form="contact"]', 'email'), phone: fieldValue('[data-checkout-form="contact"]', 'phone') };
}

function addressFields(): Record<string, string> {
  const form = '[data-checkout-form="address"]';
  return {
    country: fieldValue(form, 'country'),
    firstName: fieldValue(form, 'firstName'),
    lastName: fieldValue(form, 'lastName'),
    address1: fieldValue(form, 'address1'),
    address2: fieldValue(form, 'address2'),
    city: fieldValue(form, 'city'),
    province: fieldValue(form, 'province'),
    postalCode: fieldValue(form, 'postalCode'),
  };
}

/** The one thing about the card the server is ever told: the brand and last four digits checkPayment already
 * kept, run again on the payment step's current fields. The card number itself never leaves this function. */
function paymentSummary(): KeptCard | undefined {
  const form = '[data-checkout-form="payment"]';
  const checked = checkPayment({ number: fieldValue(form, 'number'), expiry: fieldValue(form, 'expiry'), securityCode: fieldValue(form, 'securityCode') }, Date.now());
  return checked.status === 'accepted' ? checked.card : undefined;
}

async function handlePlaceOrder(): Promise<void> {
  if (placed) return;
  const words = wordsOf();
  const { cart } = loadCart();
  const currency = currentCurrency();
  const { result } = priceNow();
  if (!result.ok) return; // Same unreachable-in-practice guard as redraw(): the steps already checked this.
  const payment = paymentSummary();
  if (!payment) return; // Unreachable in practice: the payment step only completes once a card is accepted.

  const button = placeOrderButton();
  button.disabled = true;
  hideOrderError();
  announceOrderSubmitting();

  const body = {
    lines: cart.lines.map(({ sku, colour, size, quantity }) => ({ sku, colour, size, quantity })),
    currency,
    shippingMethod: chosenShippingMethod(),
    coupon: appliedCoupon || undefined,
    contact: contactFields(),
    address: addressFields(),
    payment,
    idempotencyKey: currentIdempotencyKey(),
  };

  let token: string | undefined;
  try {
    const response = await fetch('/api/order', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const answer = (await response.json()) as { ok: boolean; token?: string };
    if (answer.ok) token = answer.token;
  } catch {
    // Falls through to the same failure handling below: a network fault answers no differently than the
    // server turning the order down.
  }

  if (token === undefined) {
    button.disabled = false;
    announceOrderSubmitFailed();
    showOrderError(words.orderFailed);
    return;
  }

  placed = true;
  clearIdempotencyKey();
  clearCart();
  location.href = `/thank-you?token=${encodeURIComponent(token)}`;
}

export function initCheckoutReview(): void {
  if (!section()) return;
  // There is nothing to check out with an empty cart: back to the cart page, rather than a page that can
  // never be completed. A cart that becomes empty while this page is already open is left alone; a shopper
  // partway through checkout is not swept away for closing a tab that emptied it in another one.
  if (loadCart().cart.lines.length === 0) {
    location.href = '/cart';
    return;
  }
  document.addEventListener('checkout:step-changed', redraw);
  document.addEventListener('cart:changed', handleCartChanged);
  document.addEventListener('currency:changed', redraw);
  for (const radio of document.querySelectorAll<HTMLInputElement>('[data-checkout-shipping-method]')) {
    radio.addEventListener('change', redraw);
  }
  couponForm().addEventListener('submit', applyCoupon);
  placeOrderButton().addEventListener('click', handlePlaceOrder);
  redraw();
}
