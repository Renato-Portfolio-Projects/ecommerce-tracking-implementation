# Tracking plan

Version 0.1. Approved by Renato on 2026-09-19.

This is the list of everything the store announces to the dataLayer, which platforms each event goes to, and what each event carries. The events and platforms themselves live in `src/tracking/events.ts`. This page describes them in words, and `npm test` fails if the two disagree.

## Rules

- The site only announces facts to `window.dataLayer`. It never calls `fbq()` or `gtag()` directly. Google Tag Manager reads the dataLayer and decides what each platform receives. `pushEvent`, in `src/tracking/push-event.ts`, is the one door to the dataLayer, and a test fails if any other file in the site touches it or calls `fbq()` or `gtag()`.
- Every ecommerce push (an event whose parameters below include `items`) is preceded by `{ ecommerce: null }`, so one event's data can never leak into the next, and its shopping details sit inside an `ecommerce` object, as in [Google's ecommerce guide for Tag Manager](https://developers.google.com/tag-manager/ecommerce-ga4) (read 2026-10-20). `event_id` and `user_data` sit beside `event`, outside that object, so they are not part of the ecommerce data a GA4 tag sends. The other events are flat.
- Every event gets an `event_id` from `crypto.randomUUID()`, made by `pushEvent` itself: nothing passes one in. The exception is `purchase`, whose ID is `purchase_` followed by the order number, so a retry or a page refresh cannot create a second purchase.
- `page_type` is pushed before the GTM snippet on every page.
- Nothing personal ever goes in a URL. Every pixel sends the page URL with each event.
- Email and phone are hashed in the browser (SHA-256) before they reach the dataLayer, so no tag on the page can read clear text. An email is first trimmed and lowercased. A phone number is first turned into digits with its country code. The checkout always supplies the code, because the shopper picks it from a list (see "The phone number" in the data contract below), and the hashing still sends no fingerprint for a number that does not start with a plus sign, since a number without its country code cannot be matched and a guessed code could be wrong. The checkout never produces such a number. The forms keep the email exactly as typed and the phone as the shopper typed it, with the country code put in front and any digit dialled only at home taken off, and only the copy that is hashed is reduced to digits. Hashed values are attached only to `generate_lead` and `purchase`, and only travel to the server container. The lead popup has no phone box, so `generate_lead` carries an email fingerprint only, and `purchase` carries an email fingerprint and, when the shopper gave a number, a phone fingerprint.
- A real action is never lost to a bad field. When an announcement has a problem (a field is missing, a field the event does not list is there, an `event_id` is passed in, or something in `user_data` is not a fingerprint), `pushEvent` sends it without what is wrong and reports the problem in the browser's console. Only an event that is not in this plan is refused, since there is nothing to send it as. Personal details are the strictest case: `user_data` keeps only real fingerprints (64 lower-case hexadecimal characters) under its two labels, and anything else is dropped, with only its label ever reported and never its value, so a clear-text email cannot reach the dataLayer. `pushEvent` also never throws: if the page does not let it send, it reports that nothing was sent and returns, so tracking cannot break shopping.

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
| `view_promotion` | The lead popup is shown, or the hero banner scrolls into view. | `view_promotion` | - | - | `event_id`, `promotion_id`, `promotion_name`, `creative_name`, `source` |
| `select_promotion` | The banner's button is clicked, or the popup's main button is pressed for the first time since the popup was shown. | `select_promotion` | - | - | `event_id`, `promotion_id`, `promotion_name`, `creative_name` |
| `generate_lead` | The lead form is saved by the server and returns OK. | `generate_lead` | `Lead` | `Lead` | `event_id`, `coupon`, `user_data` |
| `view_item_list` | A collection is seen, once per list per page: half of it is visible, or it fills half the screen, whichever is smaller. | `view_item_list` | - | - | `event_id`, `item_list_id`, `item_list_name`, `items` |
| `select_item` | A product card is clicked. | `select_item` | - | - | `event_id`, `item_list_id`, `item_list_name`, `items` |
| `view_item` | A product page loads. | `view_item` | `ViewContent` | - | `event_id`, `currency`, `value`, `items` |
| `add_to_cart` | Units are added to the cart, counting only the units that went in. | `add_to_cart` | `AddToCart` | `AddToCart` | `event_id`, `currency`, `value`, `items` |
| `remove_from_cart` | Units are taken out of the cart, by the minus button or Remove. | `remove_from_cart` | - | - | `event_id`, `currency`, `value`, `items` |
| `view_cart` | The shopper opens the cart drawer, or the cart page loads with something in the cart. | `view_cart` | - | - | `event_id`, `currency`, `value`, `items` |
| `begin_checkout` | The checkout page loads with items in the cart. | `begin_checkout` | `InitiateCheckout` | `InitiateCheckout` | `event_id`, `currency`, `value`, `coupon`, `items` |
| `add_shipping_info` | The shipping step is completed. | `add_shipping_info` | - | - | `event_id`, `currency`, `value`, `coupon`, `shipping_tier`, `items` |
| `add_payment_info` | The payment step is completed. | `add_payment_info` | `AddPaymentInfo` | - | `event_id`, `currency`, `value`, `coupon`, `payment_type`, `items` |
| `purchase` | The thank-you page renders the order the server confirmed. | `purchase` | `Purchase` | `Purchase` | `event_id`, `transaction_id`, `currency`, `value`, `tax`, `shipping`, `coupon`, `items`, `user_data` |
| `apply_coupon` | A discount code is submitted (status: success, invalid or expired). | `apply_coupon` | - | - | `event_id`, `coupon`, `status` |
| `select_currency` | The visitor picks a currency. The starting currency arriving is not a pick. | `select_currency` | - | - | `event_id`, `currency_from`, `currency_to` |
| `cta_click` | A tagged call to action with no ecommerce event of its own is clicked. | `cta_click` | - | - | `event_id`, `cta_location` |
| `refund` | A simulated back-office refund is sent straight to GA4 (stretch goal). | `refund` | - | - | `transaction_id`, `currency`, `value`, `items` |

## Call-to-action labels

A `cta_click` carries one of these labels as its `cta_location`, taken from the `data-cta` attribute of the link or button that was clicked. They are written as "Area - Item". The list is in `src/tracking/cta-labels.ts`, and tests check that this table, that list and the labels on the built pages all agree.

| Label | Where it is |
|---|---|
| `Lead Popup - Footer link` | The footer button that opens the lead popup by hand, on every store page except checkout and thank-you. |
| `Lead Popup - Corner tab` | The small tab in the corner that offers the popup again after it was closed without taking the code. |
| `Demo Data - Lead popup` | The "Use demo data" button inside the lead popup. |
| `Header - Logo` | The store's name in the header, on every store page. |
| `Nav - Tees` | The Tees link in the header. |
| `Nav - Pants` | The Pants link in the header. |
| `Nav - About` | The About link in the header. |
| `Footer - GitHub` | The footer link to the project on GitHub. |
| `Footer - Production guide` | The footer link to the production guide, "Taking this to production". |
| `Footer - Shipping` | The footer link to the shipping policy. |
| `Footer - Returns` | The footer link to the returns policy. |
| `Footer - Terms` | The footer link to the terms. |
| `Footer - Contact` | The footer link to the contact page. |
| `Demo bar - Project link` | The "How it's tracked" link at the end of the demo bar above the header. |
| `Cart drawer - Keep shopping` | The Keep shopping button in the cart drawer, shown when the cart is empty. |
| `Cart page - Keep shopping` | The Keep shopping button and link on the cart page, with the cart empty or not. |
| `Thank you - Keep shopping` | The Keep shopping button on the thank-you page. |
| `Demo Data - Checkout contact` | The "Use demo data" button on the checkout's contact step. |
| `Demo Data - Checkout address` | The "Use demo data" button on the checkout's address step. |
| `Test Card - Checkout payment` | The "Use test card" button on the checkout's payment step. |

## Data contract

- **Items** follow the GA4 item schema. `item_id` is the product's SKU. It stays the same from the first list view to the purchase, because a shopper has not chosen a colour and size until add to cart. `item_category` is the product's collection. `item_name` is the product name, and `item_variant` is the colour and size, for example `Ink / M`. `price` is the price of one unit in the charged currency, which is the sale price on a sale item, and `discount` is the coupon's discount on one unit. `item_list_id`, `item_list_name` and `index` are set when a product card is clicked and remembered on the cart line, so they carry through `add_to_cart`, `begin_checkout` and `purchase`. The `index` is the item's place in the list, counting from 1. The colour-and-size SKU (for example `SI-TEE-002-INK-M`) names the exact item on cart lines and orders, and is not sent as `item_id`. The prices and rules behind these values are in [the shop rules](shop-rules.md).
- **Meta events** carry `content_ids`, `contents`, `content_type`, `value` and `currency`, built from the same items. The Meta Pixel and the Conversions API use the same event name and the same `event_id`, which is how Meta deduplicates them.
- **`user_data`** is an object on `generate_lead` and `purchase`. It holds `sha256_email_address` and `sha256_phone_number`, which are Google's names for values that are already hashed ([Google, enhanced conversions](https://support.google.com/sa360/answer/14218731), read 2026-10-20), and a key is left out when there is nothing usable to hash: the phone key is always left out of `generate_lead`, since the lead popup has no phone box, and out of a `purchase` whose shopper gave no number. The names say "already hashed", so a clear-text key such as `email` never belongs in it. The server container maps them to Meta's `em` and `ph` (v0.4). Meta says to normalise and hash a value only once ([Meta, customer information parameters](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters), read 2026-10-20), so the server container must not hash them a second time.
- **The phone number** is two controls at checkout, a list of country codes and a box for the number, and one string in the order: `+<code> <number>`, with the number as the shopper typed it, spacing included, minus the digit that is dialled only at home. A shopper who picks the United Kingdom and types `07700 900123` has `+44 7700 900123` kept in the order and shown on the thank-you page, and `447700900123` is what is fingerprinted. The list holds the nine countries the store ships to and starts on Canada, so no other country code can be entered, and an empty number sends no phone, whatever the list says. The rules for each country (its calling code, its home digit and how many digits it takes) are in [the shop rules](shop-rules.md).
- **`value`** is the net item total after discount. It excludes tax and shipping, following Google's ecommerce guide. Tax and shipping are separate fields. Meta receives the same `value`, so revenue matches across platforms.
- **`currency`** is the currency actually charged: the one the visitor is shown when the event fires, and the amounts are the same numbers the page shows as text, worked out by the same code. A shopper can change the currency at any point of checkout, except while an order is being sent (decided in v0.2d-3a, 2026-11-17; the checkout used to lock it), so the events of one checkout can carry different currencies. Each carries the currency showing when it fired, `select_currency` records the change between them, and `purchase` carries the currency the order was placed in. A first-time visitor's starting currency arrives a fraction of a second after the page loads, so an announcement with a price waits up to 1.5 seconds for it, and is recorded in the currency the visitor ends up seeing.
- **Seen.** The hero banner and each collection on the home page are announced once per page, when they are seen: half of the block is visible, or it fills half the screen, whichever is smaller. A plain "half of it" rule cannot fire for a block more than twice as tall as the screen. Measured on the real home page, the Tees list is 1,410 px tall on a 375 x 667 phone, so at most 47% of it can ever be on screen, and the same holds on a 320 x 568 screen (46%), a 360 x 640 screen (47%) and a phone held sideways (48%).
- **The hero banner** is the promotion `home-hero`, named "New in", with the creative "Home hero". Seeing it is a `view_promotion` (with no `source`, since only the popup has one), and a click on its button, "Shop the tees", is a `select_promotion`.
- **The product page** announces `view_item` when it loads, once the starting currency has arrived (see `currency`). It carries the one product, with `price` and `value` both the price of one unit (the sale price on a sale item). Colour and size are not chosen yet, so the item has no `item_variant` and no `quantity`. The list the shopper picked the product from is remembered from the card click and joins the item at `add_to_cart`.
- **The cart events count units that really moved.** Each line that changed is one item, with its `item_variant`, its `quantity` and the list it was picked from, and `value` is the net total of those items. `add_to_cart` is sent when units go into the cart, from the product page's Add to cart button or the plus button in the cart. A quantity is stopped at 10 per line, so asking for 5 more of a line that already has 8 adds, and announces, 2, and a line already at 10 announces nothing. `remove_from_cart` is sent for units that leave the cart: the minus button counts the one unit it took, and Remove counts the whole line. Emptying the cart because an order was placed is not the shopper removing anything, so it announces nothing, and a change made in another tab is announced by that tab, not this one.
- **`view_cart`** is the shopper looking at the whole cart: they open the drawer with the Cart link in the header, or the cart page loads, including by way of the drawer's View cart link, so opening the drawer and then following View cart is two looks and two events. The drawer opening by itself after Add to cart is not a look, since `add_to_cart` already says what happened. An empty cart announces nothing, so the event always has items.
- **Discounts.** `coupon` is on `begin_checkout` and `purchase`, `discount` is set per item, and `value` is net of discount. The server validates the code, so `purchase.coupon` is confirmed. The chain to watch is `generate_lead` (code issued), then `apply_coupon`, then `purchase`. A `coupon` is only sent when a code was applied, so `begin_checkout`, `add_shipping_info`, `add_payment_info` and `purchase` may leave it out without that counting as a problem.
- **`shipping_tier`** is the name of the shipping method the shopper picked: `Standard` or `Express`.
- **The lead popup (built in v0.2b-4) announces three things on the page, and two of them are now events.** It announces `lead-popup:shown` (with `source`: `auto` or `manual`), `lead-popup:closed` (with `reason`: `close-button`, `no-thanks`, `escape`, `backdrop` or `other`) and `lead-popup:submitted` (with the checked first name and email, whether the marketing box was ticked, and the code). `lead-popup:shown` is a `view_promotion` for the promotion `welcome-offer`, named "Welcome offer", with the creative "Lead popup", and with the `source`. Its main button, "Show my code", is a `select_promotion` for the same promotion, counted only for the first press each time the popup is shown: a visitor who presses it again after a mistake in the form is not counted twice, and one who is shown the popup again is counted again. The hero banner's `view_promotion` has no `source`, so it leaves it out without that counting as a problem, and a `select_promotion` never carries one. `source` is sent to GA4 as a custom dimension on the popup's `view_promotion` and on `generate_lead` (decided 2026-09-30). Nothing hangs on `lead-popup:closed`. `lead-popup:submitted` is the moment for `generate_lead` (v0.2d-3), and the popup only announces it for a lead the server has really saved (built, v0.2c-2): a filled hidden trap field is shown the welcome code too, so a robot cannot tell it was caught, but nothing is kept and nothing is announced for it. Because the announcement carries the address as typed, the email must be hashed before anything reaches the dataLayer. Three of its elements carry a `cta_click` label, in the table of call-to-action labels above, and "Try another person" has none, because it is a convenience and not something the business wants to count.
- **The checkout page (built in v0.2c-3) and the thank-you page (built in v0.2c-4) have every moment this table names for them, and send nothing yet.** Loading with items, completing a step, applying a coupon and placing an order all happen for real against a real order endpoint, and the thank-you page renders a real, server-saved order under its own token, but wiring `begin_checkout`, `add_shipping_info`, `add_payment_info`, `apply_coupon` and `purchase` to real events is v0.2d's job. The checkout page dispatches events of its own, `checkout:step-changed`, `checkout:order-submitting` and `checkout:order-submit-failed`, but only so its own scripts can tell each other a step changed or an order is being placed; none carries the fields these ecommerce events need, and none is meant for tracking to hang on directly.
- **`cta_click`** uses one listener and a `data-cta` attribute, and its `cta_location` is the label (see the table of call-to-action labels above). It fires only where no ecommerce event exists, so a product card, the Checkout button, the currency selector and the popup's main button carry no label. The labelled elements are the header's logo and links, the footer's links, the demo bar's link, the popup's footer button, corner tab and demo button, the Keep shopping buttons and links (the cart drawer's and the cart page's for an empty cart, the cart page's with items, and the thank-you page's), and the demo data and test card buttons on the checkout. Links in the body of a page are not labelled.
- **`select_currency`** is the visitor picking a currency in the header, with `currency_from` the currency that was shown and `currency_to` the one picked. A first-time visitor's starting currency arriving a moment after the page loads changes what is shown but is not a pick, so it is not announced, and picking the currency already shown is not a change, so it is not announced either. The selector works on the checkout page too, and a pick there is announced like any other, except that the selector holds still while an order is being sent. GA4 reports `cta_location`, `currency_from` and `currency_to` only once they are registered as custom dimensions, which belongs to v0.2d-4's checklist.

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
