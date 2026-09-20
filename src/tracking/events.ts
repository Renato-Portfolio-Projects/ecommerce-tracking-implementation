export type Vendor = 'Google' | 'Meta' | 'TikTok' | 'LinkedIn';

/** Every platform an event can be sent to. */
export type Destination =
  | 'ga4'
  | 'meta-pixel'
  | 'meta-capi'
  | 'tiktok-pixel'
  | 'tiktok-events-api'
  | 'linkedin-insight-tag'
  | 'linkedin-conversions-api';

export interface Platform {
  id: Destination;
  name: string;
  vendor: Vendor;
  /** Where the call to the platform is made from. */
  runsIn: 'browser' | 'server';
  /** "v1.0" platforms are built in the first release. "later" ones are planned, not built. */
  status: 'v1.0' | 'later';
}

export const PLATFORMS: Platform[] = [
  { id: 'ga4', name: 'Google Analytics 4', vendor: 'Google', runsIn: 'browser', status: 'v1.0' },
  { id: 'meta-pixel', name: 'Meta Pixel', vendor: 'Meta', runsIn: 'browser', status: 'v1.0' },
  {
    id: 'meta-capi',
    name: 'Meta Conversions API',
    vendor: 'Meta',
    runsIn: 'server',
    status: 'v1.0',
  },
  { id: 'tiktok-pixel', name: 'TikTok Pixel', vendor: 'TikTok', runsIn: 'browser', status: 'later' },
  {
    id: 'tiktok-events-api',
    name: 'TikTok Events API',
    vendor: 'TikTok',
    runsIn: 'server',
    status: 'later',
  },
  {
    id: 'linkedin-insight-tag',
    name: 'LinkedIn Insight Tag',
    vendor: 'LinkedIn',
    runsIn: 'browser',
    status: 'later',
  },
  {
    id: 'linkedin-conversions-api',
    name: 'LinkedIn Conversions API',
    vendor: 'LinkedIn',
    runsIn: 'server',
    status: 'later',
  },
];

export interface EventSpec {
  /** The dataLayer event name. snake_case, GA4 names where GA4 has one. */
  name: string;
  /** When the site pushes this event. */
  firesWhen: string;
  /** The platforms that receive this event. */
  destinations: Destination[];
  /** The Meta standard event this maps to. Meta Pixel and Conversions API both use it. */
  metaEvent?: string;
  /** True only for the four key events that go through the Stape server container. */
  viaServer: boolean;
  /** Not part of v1.0. Built later if time allows. */
  stretch?: boolean;
  /** Top-level dataLayer parameters this event must carry. */
  params: string[];
}

export const EVENTS: EventSpec[] = [
  {
    name: 'view_promotion',
    firesWhen: 'The lead popup is shown, or the hero banner scrolls into view.',
    destinations: ['ga4'],
    viaServer: false,
    params: ['event_id', 'promotion_id', 'promotion_name', 'creative_name'],
  },
  {
    name: 'select_promotion',
    firesWhen: 'The popup or banner call to action is clicked.',
    destinations: ['ga4'],
    viaServer: false,
    params: ['event_id', 'promotion_id', 'promotion_name', 'creative_name'],
  },
  {
    name: 'generate_lead',
    firesWhen: 'The lead form is saved by the server and returns OK.',
    destinations: ['ga4', 'meta-pixel', 'meta-capi'],
    metaEvent: 'Lead',
    viaServer: true,
    params: ['event_id', 'coupon', 'user_data'],
  },
  {
    name: 'view_item_list',
    firesWhen: 'A collection is at least 50% in view, once per list per page.',
    destinations: ['ga4'],
    viaServer: false,
    params: ['event_id', 'item_list_id', 'item_list_name', 'items'],
  },
  {
    name: 'select_item',
    firesWhen: 'A product card is clicked.',
    destinations: ['ga4'],
    viaServer: false,
    params: ['event_id', 'item_list_id', 'item_list_name', 'items'],
  },
  {
    name: 'view_item',
    firesWhen: 'A product page loads.',
    destinations: ['ga4', 'meta-pixel'],
    metaEvent: 'ViewContent',
    viaServer: false,
    params: ['event_id', 'currency', 'value', 'items'],
  },
  {
    name: 'add_to_cart',
    firesWhen: 'An item is added to the cart.',
    destinations: ['ga4', 'meta-pixel', 'meta-capi'],
    metaEvent: 'AddToCart',
    viaServer: true,
    params: ['event_id', 'currency', 'value', 'items'],
  },
  {
    name: 'remove_from_cart',
    firesWhen: 'An item is removed from the cart.',
    destinations: ['ga4'],
    viaServer: false,
    params: ['event_id', 'currency', 'value', 'items'],
  },
  {
    name: 'view_cart',
    firesWhen: 'The cart drawer opens, or the cart page loads.',
    destinations: ['ga4'],
    viaServer: false,
    params: ['event_id', 'currency', 'value', 'items'],
  },
  {
    name: 'begin_checkout',
    firesWhen: 'The checkout page loads with items in the cart.',
    destinations: ['ga4', 'meta-pixel', 'meta-capi'],
    metaEvent: 'InitiateCheckout',
    viaServer: true,
    params: ['event_id', 'currency', 'value', 'coupon', 'items'],
  },
  {
    name: 'add_shipping_info',
    firesWhen: 'The shipping step is completed.',
    destinations: ['ga4'],
    viaServer: false,
    params: ['event_id', 'currency', 'value', 'coupon', 'shipping_tier', 'items'],
  },
  {
    name: 'add_payment_info',
    firesWhen: 'The payment step is completed.',
    destinations: ['ga4', 'meta-pixel'],
    metaEvent: 'AddPaymentInfo',
    viaServer: false,
    params: ['event_id', 'currency', 'value', 'coupon', 'payment_type', 'items'],
  },
  {
    name: 'purchase',
    firesWhen: 'The thank-you page renders the order the server confirmed.',
    destinations: ['ga4', 'meta-pixel', 'meta-capi'],
    metaEvent: 'Purchase',
    viaServer: true,
    params: [
      'event_id',
      'transaction_id',
      'currency',
      'value',
      'tax',
      'shipping',
      'coupon',
      'items',
      'user_data',
    ],
  },
  {
    name: 'apply_coupon',
    firesWhen: 'A discount code is submitted (status: success, invalid or expired).',
    destinations: ['ga4'],
    viaServer: false,
    params: ['event_id', 'coupon', 'status'],
  },
  {
    name: 'select_currency',
    firesWhen: 'The visitor changes the currency.',
    destinations: ['ga4'],
    viaServer: false,
    params: ['event_id', 'currency_from', 'currency_to'],
  },
  {
    name: 'cta_click',
    firesWhen: 'A tagged call to action with no ecommerce event of its own is clicked.',
    destinations: ['ga4'],
    viaServer: false,
    params: ['event_id', 'cta_location'],
  },
  {
    name: 'refund',
    firesWhen: 'A simulated back-office refund is sent straight to GA4 (stretch goal).',
    destinations: ['ga4'],
    viaServer: false,
    stretch: true,
    params: ['transaction_id', 'currency', 'value', 'items'],
  },
];

/**
 * The event name a platform receives, or undefined when the event is not sent
 * to that platform. GA4 uses the dataLayer name. Meta uses its own standard
 * event name. TikTok and LinkedIn names are added when they are built.
 */
export function platformEventName(event: EventSpec, platform: Destination): string | undefined {
  if (!event.destinations.includes(platform)) return undefined;
  if (platform === 'ga4') return event.name;
  if (platform === 'meta-pixel' || platform === 'meta-capi') return event.metaEvent;
  return undefined;
}
