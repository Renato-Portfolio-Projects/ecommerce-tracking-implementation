import { convertFromCad, type CurrencyCode } from './money';

export type ShippingMethodId = 'standard' | 'express';

export interface ShippingMethod {
  id: ShippingMethodId;
  /** Also the GA4 `shipping_tier`. */
  name: string;
  /** In CAD cents. The same for every destination. */
  priceCad: number;
  /** The order size, in CAD cents of items after discount, from which this method is free. */
  freeFromCad?: number;
}

export const FREE_SHIPPING_FROM_CAD = 10000;

export const SHIPPING_METHODS: ShippingMethod[] = [
  { id: 'standard', name: 'Standard', priceCad: 900, freeFromCad: FREE_SHIPPING_FROM_CAD },
  { id: 'express', name: 'Express', priceCad: 1900 },
];

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
