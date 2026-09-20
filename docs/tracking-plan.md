# Tracking plan

Version 0.1. Draft, waiting on Renato's approval.

This is the list of everything the store announces to the dataLayer, which platforms each event goes to, and what each event carries. The events and platforms themselves live in `src/tracking/events.ts`. This page describes them in words, and `npm test` fails if the two disagree.

## Rules

- The site only announces facts to `window.dataLayer`. It never calls `fbq()` or `gtag()` directly. Google Tag Manager reads the dataLayer and decides what each platform receives.
- Every ecommerce push is preceded by `{ ecommerce: null }`, so one event's data can never leak into the next.
- Every event gets an `event_id` from `crypto.randomUUID()`. The exception is `purchase`, whose ID is derived from the order number, so a retry or a page refresh cannot create a second purchase.
- `page_type` is pushed before the GTM snippet on every page.
- Nothing personal ever goes in a URL. Every pixel sends the page URL with each event.
- Email and phone are hashed in the browser (SHA-256, after trimming and lowercasing) before they reach the dataLayer, so no tag on the page can read clear text. Hashed values are attached only to `generate_lead` and `purchase`, and only travel to the server container.

## Platforms

The event names on this page are platform-neutral dataLayer names. Google Tag Manager turns each one into the call a platform expects, and every platform has its own name for the same moment. These are the platforms.

| Id | Platform | Vendor | Runs in | Status |
|---|---|---|---|---|
| `ga4` | Google Analytics 4 | Google | browser | v1.0 |
| `meta-pixel` | Meta Pixel | Meta | browser | v1.0 |
| `meta-capi` | Meta Conversions API | Meta | server | v1.0 |
| `tiktok-pixel` | TikTok Pixel | TikTok | browser | later |
| `tiktok-events-api` | TikTok Events API | TikTok | server | later |
| `linkedin-insight-tag` | LinkedIn Insight Tag | LinkedIn | browser | later |
| `linkedin-conversions-api` | LinkedIn Conversions API | LinkedIn | server | later |

- Browser platforms are called by tags in the web GTM container. Server platforms are called from the Stape server container.
- TikTok and LinkedIn are possible later steps after v1.0. Their event names get added to the Events table when they are built, and a test fails if any event is sent to a platform that is not live yet.

## Events

The first column is the platform-neutral dataLayer name. The three platform columns show the name each platform receives, or `-` when it does not get the event. An event that has a Meta Conversions API name is also routed through the Stape server container.

| Event | Fires when | GA4 | Meta Pixel | Meta CAPI | Required parameters |
|---|---|---|---|---|---|
| `view_promotion` | The lead popup is shown, or the hero banner scrolls into view. | `view_promotion` | - | - | `event_id`, `promotion_id`, `promotion_name`, `creative_name` |
| `select_promotion` | The popup or banner call to action is clicked. | `select_promotion` | - | - | `event_id`, `promotion_id`, `promotion_name`, `creative_name` |
| `generate_lead` | The lead form is saved by the server and returns OK. | `generate_lead` | `Lead` | `Lead` | `event_id`, `coupon`, `user_data` |
| `view_item_list` | A collection is at least 50% in view, once per list per page. | `view_item_list` | - | - | `event_id`, `item_list_id`, `item_list_name`, `items` |
| `select_item` | A product card is clicked. | `select_item` | - | - | `event_id`, `item_list_id`, `item_list_name`, `items` |
| `view_item` | A product page loads. | `view_item` | `ViewContent` | - | `event_id`, `currency`, `value`, `items` |
| `add_to_cart` | An item is added to the cart. | `add_to_cart` | `AddToCart` | `AddToCart` | `event_id`, `currency`, `value`, `items` |
| `remove_from_cart` | An item is removed from the cart. | `remove_from_cart` | - | - | `event_id`, `currency`, `value`, `items` |
| `view_cart` | The cart drawer opens, or the cart page loads. | `view_cart` | - | - | `event_id`, `currency`, `value`, `items` |
| `begin_checkout` | The checkout page loads with items in the cart. | `begin_checkout` | `InitiateCheckout` | `InitiateCheckout` | `event_id`, `currency`, `value`, `coupon`, `items` |
| `add_shipping_info` | The shipping step is completed. | `add_shipping_info` | - | - | `event_id`, `currency`, `value`, `coupon`, `shipping_tier`, `items` |
| `add_payment_info` | The payment step is completed. | `add_payment_info` | `AddPaymentInfo` | - | `event_id`, `currency`, `value`, `coupon`, `payment_type`, `items` |
| `purchase` | The thank-you page renders the order the server confirmed. | `purchase` | `Purchase` | `Purchase` | `event_id`, `transaction_id`, `currency`, `value`, `tax`, `shipping`, `coupon`, `items`, `user_data` |
| `apply_coupon` | A discount code is submitted (status: success, invalid or expired). | `apply_coupon` | - | - | `event_id`, `coupon`, `status` |
| `select_currency` | The visitor changes the currency. | `select_currency` | - | - | `event_id`, `currency_from`, `currency_to` |
| `cta_click` | A tagged call to action with no ecommerce event of its own is clicked. | `cta_click` | - | - | `event_id`, `cta_location` |
| `refund` | A simulated back-office refund is sent straight to GA4 (stretch goal). | `refund` | - | - | `transaction_id`, `currency`, `value`, `items` |

## Data contract

- **Items** follow the GA4 item schema. `item_id` is the SKU that will later appear in the product feed. `item_category` is the product's collection. `item_list_id`, `item_list_name` and `index` are set when a product card is clicked and remembered on the cart line, so they carry through `add_to_cart`, `begin_checkout` and `purchase`.
- **Meta events** carry `content_ids`, `contents`, `content_type`, `value` and `currency`, built from the same items. The Meta Pixel and the Conversions API use the same event name and the same `event_id`, which is how Meta deduplicates them.
- **`value`** is the net item total after discount. It excludes tax and shipping, following Google's ecommerce guide. Tax and shipping are separate fields. Meta receives the same `value`, so revenue matches across platforms.
- **`currency`** is the currency actually charged. Once checkout starts it cannot change.
- **Discounts.** `coupon` is on `begin_checkout` and `purchase`, `discount` is set per item, and `value` is net of discount. The server validates the code, so `purchase.coupon` is confirmed. The chain to watch is `generate_lead` (code issued), then `apply_coupon`, then `purchase`.
- **`cta_click`** uses one listener and a `data-cta` attribute. It fires only where no ecommerce event exists: navigation and footer links, "Continue shopping", the size guide, the demo data buttons, and the demo bar links to the case study and proof page.

## GTM naming conventions

- **Tags:** `[Platform] - [Type] - [Event]`, for example `GA4 - Event - purchase` or `Meta - Pixel - Purchase`.
- **Triggers:** a prefix for the kind, then the event, for example `CE - purchase` (custom event) or `PV - Checkout` (page view).
- **Variables:** a prefix for the kind, then the value, for example `DLV - ecommerce.value` (dataLayer variable), `CONST - GA4 Measurement ID` (constant) or `LUT - Environment IDs` (lookup table).
- **Folders:** one per platform, and inside each, one per funnel stage.
- **Versions:** every published GTM version gets a descriptive name and notes, and its export is committed to the repo.

## Environments

There are two environments, and they never share a dataset.

- **Live:** the production domain. Its own GA4 property and its own Meta dataset.
- **Test:** localhost and Vercel preview deploys. A separate GA4 property and a separate Meta dataset.

A lookup variable in the GTM container picks the IDs from the page hostname.

## Server routing and quota

Only `generate_lead`, `add_to_cart`, `begin_checkout` and `purchase` go through the Stape server container, which is what the Meta CAPI column shows. Stape Free allows 10K requests a month per container. At the limit the container is disabled and stays disabled until it is upgraded, so automated tests must never send to the live container: they intercept the request and check its contents instead.

## Changing this plan

Change `src/tracking/events.ts` and the tables above in the same commit. `tests/unit/tracking-plan-doc.test.ts` reads this page and fails if a platform, event, platform event name or parameter list differs from the code.
