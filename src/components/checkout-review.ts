import { checkCoupon } from '../engine/coupons';
import { fill } from '../engine/fill';
import { formatMoney } from '../engine/money';
import { priceOrder, type PricedOrder } from '../engine/pricing';
import { cartToItemsInput } from '../engine/cart';
import { shippingCost } from '../engine/shipping';
import { SHIPPING_METHODS } from '../store/shipping-methods';
import type { CurrencyCode } from '../store/currencies';
import { clearCart, loadCart } from './cart-client';
import { currentCurrency } from './currency-switcher';
import { placeOrder } from './place-order';

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
const shippingMethodsField = () => document.querySelector<HTMLElement>('.checkout-shipping-methods')!;
const placeOrderButton = () => document.querySelector<HTMLButtonElement>('[data-checkout-place-order]')!;
const reviewHeading = () => document.querySelector<HTMLElement>('[data-checkout-review-heading]')!;
const confirmedHeading = () => document.querySelector<HTMLElement>('[data-checkout-confirmed-heading]')!;
const confirmedBody = () => document.querySelector<HTMLElement>('[data-checkout-confirmed-body]')!;
const confirmedAddress = () => document.querySelector<HTMLElement>('[data-checkout-confirmed-address]')!;
const confirmedAddressLine = () => document.querySelector<HTMLElement>('[data-checkout-confirmed-address-line]')!;
const keepShoppingLink = () => document.querySelector<HTMLElement>('[data-checkout-keep-shopping]')!;

/** The coupon last sent for pricing: the empty string once nothing has been applied, or an "Apply" gave nothing usable. */
let appliedCoupon = '';

/** Set once "Place order" succeeds, so nothing still on the page (a stray coupon submit, the cart emptying
 * itself) redraws the review over top of the confirmation it has just become. */
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
  confirmedBody: string;
}

const wordsOf = () => JSON.parse(section().dataset.words ?? '{}') as ReviewWords;

/** Re-prices and redraws the whole review, if it is showing. Does nothing otherwise, so nothing is computed for a
 * shopper who has not reached it yet, and does nothing once the order is placed, so the confirmation is never
 * redrawn back into a review (the cart emptying itself, which placing an order does, would otherwise trigger
 * exactly that). */
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

/** Told once "Place order" succeeds, so checkout-steps.ts can stop the three steps above being reopened:
 * editing a step after the order it belongs to has been placed does not make sense. The two files know
 * nothing else about each other, the same way checkout-steps.ts's own event works the other way round. */
function announceOrderPlaced(): void {
  document.dispatchEvent(new CustomEvent('checkout:order-placed'));
}

/** The address step's own already-formatted summary line ("Liam Okafor, 310 Alder Street, ..."), read rather
 * than built a second time, so the confirmation can never say something different from what the shopper
 * already confirmed by completing that step. */
function addressSummaryText(): string {
  return document.querySelector<HTMLElement>('[data-checkout-step="address"] [data-checkout-summary]')!.textContent ?? '';
}

async function handlePlaceOrder(): Promise<void> {
  if (placed) return;
  const words = wordsOf();
  const { result } = priceNow();
  if (!result.ok) return; // Same unreachable-in-practice guard as redraw(): the steps already checked this.

  const button = placeOrderButton();
  button.disabled = true;
  const email = document.querySelector<HTMLInputElement>('[data-checkout-form="contact"] [name=email]')!.value;
  const firstName = document.querySelector<HTMLInputElement>('[data-checkout-form="address"] [name=firstName]')!.value;
  const address = addressSummaryText();
  const { orderNumber } = await placeOrder({ order: result.order, email, firstName, address });

  placed = true;
  confirmedBody().textContent = fill(words.confirmedBody, { firstName, orderNumber });
  confirmedBody().hidden = false;
  reviewHeading().hidden = true;
  confirmedHeading().hidden = false;
  confirmedAddressLine().textContent = address;
  confirmedAddress().hidden = false;
  shippingMethodsField().hidden = true;
  couponForm().hidden = true;
  couponMessage().hidden = true;
  button.hidden = true;
  keepShoppingLink().hidden = false;

  clearCart();
  announceOrderPlaced();
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
  document.addEventListener('cart:changed', redraw);
  document.addEventListener('currency:changed', redraw);
  for (const radio of document.querySelectorAll<HTMLInputElement>('[data-checkout-shipping-method]')) {
    radio.addEventListener('change', redraw);
  }
  couponForm().addEventListener('submit', applyCoupon);
  placeOrderButton().addEventListener('click', handlePlaceOrder);
  redraw();
}
