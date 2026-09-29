import type { PricedOrder } from '../engine/pricing';

/**
 * What checkout-review.ts hands over once every check has passed for real and the order has been priced for
 * real: the order itself, and the shopper's own contact and shipping details, exactly as the review already
 * showed them.
 */
export interface PlaceOrderInput {
  order: PricedOrder;
  email: string;
  firstName: string;
  address: string;
}

/** What comes back once an order is placed: the reference to show. */
export interface OrderPlaced {
  orderNumber: string;
}

// No 0, O, 1 or I: a shopper reading this aloud, or typing it into a support form, is never unsure which
// letter or digit was meant.
const ORDER_NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeOrderNumber(): string {
  let suffix = '';
  for (let i = 0; i < 8; i++) suffix += ORDER_NUMBER_ALPHABET[Math.floor(Math.random() * ORDER_NUMBER_ALPHABET.length)];
  return `SI-${suffix}`;
}

/**
 * The one place that decides an order is placed, and it is deliberately a stand-in, the same relationship
 * submitLead had to the server before v0.2c-2. Every check has already run for real, in the browser, and the
 * price shown is the real price; this only makes up a reference to show, and saves and sends nothing, because
 * there is no order endpoint yet. In v0.2c-4 this is the only function that changes: it will call /api/order,
 * which checks and prices everything again on the server, saves the order for 7 days, and returns the real
 * order number and a token this stands in for.
 */
export async function placeOrder(_input: PlaceOrderInput): Promise<OrderPlaced> {
  return { orderNumber: makeOrderNumber() };
}
