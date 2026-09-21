import {
  MAX_QUANTITY_PER_LINE,
  findCollection,
  findProduct,
  isSoldOut,
  variantLabel,
  type Product,
} from './catalog';
import { checkCoupon, type CouponCheck } from './coupons';
import { taxPercentFor } from './destinations';
import {
  convertFromCad,
  divideRounded,
  isCurrencyCode,
  scaleToInteger,
  type CurrencyCode,
} from './money';
import {
  findShippingMethod,
  freeShippingRemaining,
  shippingCost,
  type ShippingMethodId,
} from './shipping';

/**
 * Everything the store charges is worked out here, by one function, so the pages and the
 * server can never disagree about a price. The rules:
 *
 * - Each unit's price is converted into the shopper's currency and rounded to the cent first.
 *   Lines are then whole-number sums of those units, so nothing can drift by a cent.
 * - A coupon takes its percentage off each unit, rounded to the cent. It applies to the price
 *   the shopper would otherwise pay, which is the sale price on a sale item.
 * - `itemsNet` is the items after discount, without shipping or tax. It is the `value` that
 *   the analytics events send.
 * - Tax is worked out once, on the items after discount plus shipping, and rounded once.
 *
 * How the file is laid out, top to bottom:
 *   1. The shapes of what goes in: LineInput, ItemsInput, OrderInput.
 *   2. The shapes of what comes out: PricedLine, PricedItems, PricedOrder, and the problems.
 *   3. checkLine: checks one cart line.
 *   4. priceItems: prices the cart's items. It uses checkLine.
 *   5. priceOrder: prices a whole order. It uses priceItems.
 * The shapes only describe data and run nothing. The functions run when something calls them,
 * and the order they appear in here is not the order they run in.
 */

/** Lines come from the browser, so every field is checked before it is trusted. */
export interface LineInput {
  sku: string;
  colour: string;
  size: string;
  quantity: number;
}

export interface ItemsInput {
  lines: LineInput[];
  currency: string;
  /** The code as typed. Any capitalisation, with or without spaces around it. */
  coupon?: string;
}

export interface OrderInput extends ItemsInput {
  destination: { country: string; province?: string };
  shippingMethod: string;
}

export interface PricedLine {
  /** GA4 `item_id`. */
  sku: string;
  /** GA4 `item_name`. */
  name: string;
  /** GA4 `item_category`: the collection's name. */
  category: string;
  colour: string;
  size: string;
  /** GA4 `item_variant`, for example "Ink / M". */
  variant: string;
  quantity: number;
  /** One unit, before any coupon. The sale price on a sale item. */
  unitPrice: number;
  /** One unit, before the sale. Only on a sale item. */
  compareAtUnitPrice?: number;
  /** The coupon's discount on one unit. GA4 `discount`. */
  unitDiscount: number;
  /** (unitPrice - unitDiscount) x quantity. */
  lineNet: number;
}

export interface PricedItems {
  currency: CurrencyCode;
  lines: PricedLine[];
  /** Before any coupon. */
  itemsSubtotal: number;
  discount: number;
  /** After the coupon, without shipping or tax. This is the `value` that the analytics events send. */
  itemsNet: number;
  couponStatus: CouponCheck['status'];
  /** Only set when the code was valid. */
  appliedCoupon?: { code: string; percentOff: number };
  /** How much more the items need for free Standard shipping. Zero once reached. */
  freeShippingRemaining: number;
}

export interface PricedOrder extends PricedItems {
  shippingMethod: ShippingMethodId;
  shipping: number;
  taxPercent: number;
  tax: number;
  total: number;
}

export type PricingProblemCode =
  | 'unknown_currency'
  | 'unknown_product'
  | 'unknown_variant'
  | 'bad_quantity'
  | 'sold_out'
  | 'unknown_destination'
  | 'unknown_shipping_method';

export interface PricingProblem {
  code: PricingProblemCode;
  /** The position of the line in the cart, counting from zero. Not set for whole-order problems. */
  line?: number;
  /** Plain words a shopper could read. */
  message: string;
}

export type ItemsResult =
  | { ok: true; items: PricedItems }
  | { ok: false; problems: PricingProblem[] };

export type PricingResult =
  | { ok: true; order: PricedOrder }
  | { ok: false; problems: PricingProblem[] };

function checkLine(
  line: LineInput,
  index: number,
): { product: Product } | { problem: PricingProblem } {
  const where = `Line ${index + 1}`;
  const fail = (code: PricingProblemCode, message: string) => ({
    problem: { code, line: index, message: `${where}: ${message}` },
  });

  const product = findProduct(line.sku);
  if (!product) return fail('unknown_product', `${line.sku} is not a product we sell.`);

  const variant = variantLabel(line.colour, line.size);
  if (!(product.colours as string[]).includes(line.colour) || !product.sizes.includes(line.size)) {
    return fail('unknown_variant', `${product.name} does not come in ${variant}.`);
  }
  if (
    !Number.isInteger(line.quantity) ||
    line.quantity < 1 ||
    line.quantity > MAX_QUANTITY_PER_LINE
  ) {
    return fail(
      'bad_quantity',
      `quantity must be a whole number from 1 to ${MAX_QUANTITY_PER_LINE}.`,
    );
  }
  if (isSoldOut(product, line.colour, line.size)) {
    return fail('sold_out', `${product.name} in ${variant} is sold out.`);
  }
  return { product };
}

/** Prices the items in a cart. It needs no destination or shipping method, so a cart can use it. */
export function priceItems(input: ItemsInput): ItemsResult {
  const problems: PricingProblem[] = [];
  const checked = input.lines.map((line, index) => checkLine(line, index));
  for (const result of checked) {
    if ('problem' in result) problems.push(result.problem);
  }
  if (!isCurrencyCode(input.currency)) {
    problems.push({
      code: 'unknown_currency',
      message: `${input.currency} is not a currency we offer.`,
    });
  }
  if (problems.length > 0 || !isCurrencyCode(input.currency)) return { ok: false, problems };

  const currency = input.currency;
  const coupon = checkCoupon(input.coupon);
  const percentOff = coupon.status === 'valid' ? coupon.coupon.percentOff : 0;

  const lines: PricedLine[] = checked.map((result, index) => {
    const { product } = result as { product: Product };
    const line = input.lines[index];
    const unitPrice = convertFromCad(product.priceCad, currency);
    const unitDiscount = divideRounded(unitPrice * percentOff, 100);
    return {
      sku: product.sku,
      name: product.name,
      category: findCollection(product.collection)!.name,
      colour: line.colour,
      size: line.size,
      variant: variantLabel(line.colour, line.size),
      quantity: line.quantity,
      unitPrice,
      ...(product.compareAtCad === undefined
        ? {}
        : { compareAtUnitPrice: convertFromCad(product.compareAtCad, currency) }),
      unitDiscount,
      lineNet: (unitPrice - unitDiscount) * line.quantity,
    };
  });

  const itemsSubtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discount = lines.reduce((sum, line) => sum + line.unitDiscount * line.quantity, 0);
  const itemsNet = itemsSubtotal - discount;

  return {
    ok: true,
    items: {
      currency,
      lines,
      itemsSubtotal,
      discount,
      itemsNet,
      couponStatus: coupon.status,
      ...(coupon.status === 'valid'
        ? { appliedCoupon: { code: coupon.coupon.code, percentOff: coupon.coupon.percentOff } }
        : {}),
      freeShippingRemaining: freeShippingRemaining(currency, itemsNet),
    },
  };
}

/** Prices a whole order: the items, then shipping, tax and the total. */
export function priceOrder(input: OrderInput): PricingResult {
  const items = priceItems(input);
  const problems: PricingProblem[] = items.ok ? [] : [...items.problems];

  const taxPercent = taxPercentFor(input.destination.country, input.destination.province);
  if (taxPercent === undefined) {
    problems.push({
      code: 'unknown_destination',
      message: 'We cannot ship to that destination.',
    });
  }
  const method = findShippingMethod(input.shippingMethod);
  if (!method) {
    problems.push({
      code: 'unknown_shipping_method',
      message: `${input.shippingMethod} is not a shipping method we offer.`,
    });
  }
  if (!items.ok || taxPercent === undefined || !method || problems.length > 0) {
    return { ok: false, problems };
  }

  const { itemsNet, currency, lines } = items.items;
  // An empty cart has nothing to ship, so it owes no shipping and no tax.
  const shipping = lines.length === 0 ? 0 : shippingCost(method, currency, itemsNet);
  const tax =
    lines.length === 0
      ? 0
      : divideRounded((itemsNet + shipping) * scaleToInteger(taxPercent, 3), 100_000);

  return {
    ok: true,
    order: {
      ...items.items,
      shippingMethod: method.id,
      shipping,
      taxPercent,
      tax,
      total: itemsNet + shipping + tax,
    },
  };
}
