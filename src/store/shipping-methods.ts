// The ways Second Impression ships an order, and what each costs. This is the store's own data. The
// calculation that uses it is in src/engine/shipping.ts.

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
