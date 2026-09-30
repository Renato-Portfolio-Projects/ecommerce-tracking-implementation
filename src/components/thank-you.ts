import type { Address, Contact } from '../engine/checkout-form';
import { fill } from '../engine/fill';
import { formatMoney } from '../engine/money';
import type { PricedOrder } from '../engine/pricing';
import type { KeptCard } from '../demo/test-cards';
import { COUNTRIES, PROVINCES } from '../store/destinations';

/**
 * The thank-you page: reached with a token in the URL once an order is placed, and standing entirely on its
 * own, since it is a separate page load and cannot rely on the checkout page's steps still being visible
 * above it. It asks /api/order for the order the token names and shows it, or one of two different messages
 * if it cannot: a missing, wrong or expired token is answered the same way by the server, so that is shown as
 * "not found"; the store being unreachable is a different, real fault, and is shown as its own message,
 * since telling a shopper whose order really exists that it does not would be wrong.
 */

interface OrderAnswer {
  ok: true;
  orderNumber: string;
  order: PricedOrder;
  contact: Contact;
  address: Address;
  payment: KeptCard;
}

interface ThankYouWords {
  body: string;
  free: string;
  cardEnding: string;
}

const loading = () => document.querySelector<HTMLElement>('[data-thank-you-loading]')!;
const orderSection = () => document.querySelector<HTMLElement>('[data-thank-you-order]')!;
const notFoundSection = () => document.querySelector<HTMLElement>('[data-thank-you-not-found]')!;
const loadErrorSection = () => document.querySelector<HTMLElement>('[data-thank-you-load-error]')!;

const wordsOf = () => JSON.parse(orderSection().dataset.words ?? '{}') as ThankYouWords;

function countryName(code: string): string {
  return COUNTRIES.find((country) => country.code === code)?.name ?? code;
}

function provinceName(code: string): string {
  return PROVINCES.find((province) => province.code === code)?.name ?? code;
}

/** The same joined form the address step's own summary already used, so an order's address never reads
 * differently here than it did the moment the shopper confirmed it. */
function addressLine(address: Address): string {
  const lines = [
    `${address.firstName} ${address.lastName}`,
    [address.address1, address.address2].filter(Boolean).join(', '),
    [address.city, address.province ? provinceName(address.province) : undefined, address.postalCode].filter(Boolean).join(', '),
    countryName(address.country),
  ];
  return lines.join(', ');
}

function contactLine(contact: Contact): string {
  return contact.phone ? `${contact.email} · ${contact.phone}` : contact.email;
}

function renderLines(order: PricedOrder): void {
  const list = document.querySelector<HTMLElement>('[data-thank-you-lines]')!;
  const template = document.querySelector<HTMLTemplateElement>('[data-thank-you-line]')!;
  for (const line of order.lines) {
    const node = template.content.cloneNode(true) as DocumentFragment;
    node.querySelector<HTMLElement>('[data-thank-you-line-qty]')!.textContent = String(line.quantity);
    node.querySelector<HTMLElement>('[data-thank-you-line-name]')!.textContent = line.name;
    node.querySelector<HTMLElement>('[data-thank-you-line-variant]')!.textContent = line.variant;
    node.querySelector<HTMLElement>('[data-thank-you-line-price]')!.textContent = formatMoney(line.unitPrice * line.quantity, order.currency);
    list.append(node);
  }
}

function renderTotals(order: PricedOrder, words: { free: string }): void {
  const cell = (name: string) => document.querySelector<HTMLElement>(`[data-thank-you-total="${name}"]`)!;
  cell('subtotal').textContent = formatMoney(order.itemsSubtotal, order.currency);
  cell('discount').textContent = `−${formatMoney(order.discount, order.currency)}`;
  cell('shipping').textContent = order.shipping === 0 ? words.free : formatMoney(order.shipping, order.currency);
  cell('tax').textContent = formatMoney(order.tax, order.currency);
  cell('total').textContent = formatMoney(order.total, order.currency);
  document.querySelector<HTMLElement>('[data-thank-you-discount-row]')!.hidden = order.discount === 0;
}

function showOrder(answer: OrderAnswer): void {
  const words = wordsOf();
  loading().hidden = true;
  const section = orderSection();
  section.hidden = false;
  section.querySelector<HTMLElement>('[data-thank-you-body]')!.textContent = fill(words.body, {
    firstName: answer.address.firstName,
    orderNumber: answer.orderNumber,
  });
  renderLines(answer.order);
  renderTotals(answer.order, { free: words.free });
  section.querySelector<HTMLElement>('[data-thank-you-contact]')!.textContent = contactLine(answer.contact);
  section.querySelector<HTMLElement>('[data-thank-you-address]')!.textContent = addressLine(answer.address);
  section.querySelector<HTMLElement>('[data-thank-you-payment]')!.textContent = fill(words.cardEnding, {
    brand: answer.payment.brand,
    last4: answer.payment.last4,
  });
}

function showNotFound(): void {
  loading().hidden = true;
  notFoundSection().hidden = false;
}

function showLoadError(): void {
  loading().hidden = true;
  loadErrorSection().hidden = false;
}

export async function initThankYou(): Promise<void> {
  if (!orderSection()) return;
  const token = new URLSearchParams(location.search).get('token');
  if (!token) {
    showNotFound();
    return;
  }

  let response: Response;
  try {
    response = await fetch(`/api/order?token=${encodeURIComponent(token)}`);
  } catch {
    showLoadError();
    return;
  }
  if (response.status === 404) {
    showNotFound();
    return;
  }
  if (!response.ok) {
    showLoadError();
    return;
  }

  const answer = (await response.json().catch(() => undefined)) as OrderAnswer | undefined;
  if (!answer?.ok) {
    showLoadError();
    return;
  }
  showOrder(answer);
}
