import type { CurrencyCode } from '../store/currencies';
import {
  FREE_SHIPPING_FROM_CAD,
  SHIPPING_METHODS,
  type ShippingMethod,
} from '../store/shipping-methods';
import { convertFromCad } from './money';

export function findShippingMethod(id: string): ShippingMethod | undefined {
  return SHIPPING_METHODS.find((method) => method.id === id);
}

/**
 * The shipping charge in the shopper's currency. `itemsNet` is the items after discount,
 * in that same currency. The free-shipping line is converted the same way prices are.
 */
export function shippingCost(
  method: ShippingMethod,
  currency: CurrencyCode,
  itemsNet: number,
): number {
  if (method.freeFromCad !== undefined && itemsNet >= convertFromCad(method.freeFromCad, currency)) {
    return 0;
  }
  return convertFromCad(method.priceCad, currency);
}

/** How much more the shopper needs in their cart for free Standard shipping. Zero once reached. */
export function freeShippingRemaining(currency: CurrencyCode, itemsNet: number): number {
  return Math.max(0, convertFromCad(FREE_SHIPPING_FROM_CAD, currency) - itemsNet);
}

/**
 * How far along the way to free Standard shipping the items are, from 0 to 100. It is exact and not
 * rounded, so that it reads 100 only once there is nothing more to add: items 30 cents short of the
 * line are at 99.7, where a rounded number would say 100 beside the words "You are $0.30 away".
 */
export function freeShippingProgress(currency: CurrencyCode, itemsNet: number): number {
  return Math.min(100, (itemsNet * 100) / convertFromCad(FREE_SHIPPING_FROM_CAD, currency));
}
