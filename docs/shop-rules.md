# Shop rules

Second Impression is a fictional store, so every price, rate and code on this page is a made-up demo value. Nothing here is tax advice, and no real money moves.

This page is the store's price list and rulebook in words. The tables are checked against the code by tests, so this page cannot disagree with what the store actually charges. All the arithmetic lives in one place, `src/shop/pricing.ts`, and both the pages and the server use it, so a price can never differ between what a shopper sees and what is charged.

## How an order is priced

1. **Prices are stored in Canadian dollars, as a whole number of cents.** A price of $38.00 is stored as 3800. Decimals can pick up tiny errors when they are added (0.1 + 0.2 is not exactly 0.3 on a computer), whole numbers never do, so a total can never drift by a cent.
2. **The shopper picks a currency in the header.** It is locked once checkout starts. Each item's price is converted at a fixed demo rate and rounded to the nearest cent (half a cent rounds up) before anything is multiplied. A line is that price times the quantity, so the lines always add up to the total.
3. **A coupon takes its percentage off each item, rounded to the nearest cent.** It comes off the price the shopper would otherwise pay, so on a sale item it comes off the sale price. One code per order. It does not matter whether the shopper types the code in capitals or lowercase, or leaves spaces around it. An expired or unknown code gives no discount, and the store says why.
4. **Items after discount** is the items minus the discount. It leaves out shipping and tax, and it is the `value` that tracking sends.
5. **Shipping** is the method the shopper picks. It costs the same for every destination. Standard is free once the items after discount reach the free-shipping line, which is converted like a price. A coupon can bring an order back under the line.
6. **Tax** is added on top of the price, in every country, to keep the demo simple. It is worked out once, on the items after discount plus shipping, using the destination's rate, and rounded once to the nearest cent.
7. **The total** is the items after discount, plus shipping, plus tax.
8. **An empty cart owes nothing.** With no items there is nothing to ship, so there is no shipping and no tax.

## Currencies

Every price is stored in Canadian dollars, and every conversion starts from there: the last column says how much of each currency 1 CAD is worth. The store never converts between two other currencies. The rates are fixed for the demo. They are not live exchange rates.

| Code | Currency | 1 CAD is worth |
|---|---|---|
| CAD | Canadian dollar | 1 |
| USD | US dollar | 0.73 |
| EUR | Euro | 0.66 |
| GBP | British pound | 0.56 |

## Default currency

Each visitor starts in a currency chosen from the country their connection appears to come from. The site gets that country from Vercel, at country level only, and never stores it. It is only a starting point: the visitor can switch to any of the four currencies until checkout starts, and then it locks. A missing or unrecognisable country starts in USD.

| Visitor's country | Starts in |
|---|---|
| Canada | CAD |
| United States | USD |
| United Kingdom | GBP |
| Euro area (21 countries) | EUR |
| Anywhere else | USD |

USD is the fallback because it is the most widely understood foreign currency. Only six of the euro-area countries are places the store ships to, so a visitor from another euro country sees prices in euros but can only check out with a shipping address in one of the places the store ships to.

## Euro area countries

The countries that use the euro. Bulgaria became the 21st on 1 January 2026.

| Code | Country |
|---|---|
| AT | Austria |
| BE | Belgium |
| BG | Bulgaria |
| HR | Croatia |
| CY | Cyprus |
| EE | Estonia |
| FI | Finland |
| FR | France |
| DE | Germany |
| GR | Greece |
| IE | Ireland |
| IT | Italy |
| LV | Latvia |
| LT | Lithuania |
| LU | Luxembourg |
| MT | Malta |
| NL | Netherlands |
| PT | Portugal |
| SK | Slovakia |
| SI | Slovenia |
| ES | Spain |

## Products

The catalog is organised as two collections holding three products each, listed here in the order they appear on the page. In tracking, each collection is an item list, and a product's position in it is its position on the page. Tees come in letter sizes. Pants are sized by waist, in inches. A "before the sale" price marks a sale item. A sold-out variant is a colour and size that is out of stock on purpose, so the store can show that state.

| SKU | Product | Collection | Price | Before the sale | Colours | Sizes | Sold out |
|---|---|---|---|---|---|---|---|
| SI-TEE-001 | Plain Tee | Tees | $28.00 | - | Paper, Ink, Blue | XS, S, M, L, XL | - |
| SI-TEE-002 | Logo Tee | Tees | $38.00 | - | Paper, Ink | XS, S, M, L, XL | - |
| SI-TEE-003 | Misprint Tee | Tees | $34.00 | $42.00 | Paper, Red | XS, S, M, L, XL | Red / XL |
| SI-PNT-001 | Plain Chino | Pants | $96.00 | - | Sand, Ink | 28, 30, 32, 34, 36 | Sand / 28 |
| SI-PNT-002 | Relaxed Chino | Pants | $89.00 | $108.00 | Sand, Ink | 28, 30, 32, 34, 36 | - |
| SI-PNT-003 | Pleated Chino | Pants | $118.00 | - | Paper, Blue | 28, 30, 32, 34, 36 | - |

## Variant SKUs

Each product has a SKU, like `SI-TEE-002`, and that is what tracking sends as `item_id` at every step, from the first list view to the purchase. Each colour and size also has its own variant SKU, built from the product SKU, the colour in capitals and the size: `SI-TEE-002-INK-M`, or `SI-PNT-001-SAND-32` for pants, where the size is a waist number. Variant SKUs are worked out when they are needed and never typed by hand. They name the exact item on cart lines and orders. There are 65 in all.

| Product SKU | Example variant SKU | Variants |
|---|---|---|
| SI-TEE-001 | SI-TEE-001-PAPER-XS | 15 |
| SI-TEE-002 | SI-TEE-002-PAPER-XS | 10 |
| SI-TEE-003 | SI-TEE-003-PAPER-XS | 10 |
| SI-PNT-001 | SI-PNT-001-SAND-28 | 10 |
| SI-PNT-002 | SI-PNT-002-SAND-28 | 10 |
| SI-PNT-003 | SI-PNT-003-PAPER-28 | 10 |

The example is each product's first colour and first size.

**Why:** a shopper has not chosen a colour and size until add to cart, so tracking keeps the product SKU, which is the same at every step. The colour and size travel separately as `item_variant`, for example `Ink / M`. A stock count or a product feed needs one SKU for each exact item, which is what the variant SKU is for.

## Shipping

Both methods cost the same for every destination. The prices are in Canadian dollars and are converted into the shopper's currency like any price. The method's name is what tracking sends as `shipping_tier`.

| Method | Price | Free when |
|---|---|---|
| Standard | $9.00 | Items after discount reach $100.00 |
| Express | $19.00 | Never |

## Tax by country

Canada is taxed by province, in the next table. The United States is 0% on purpose: there is no national sales tax, and a small foreign seller usually is not required to collect state sales tax until it passes a state's sales thresholds. All the rates are simplified demo values, not tax advice.

| Country | Rate |
|---|---|
| Canada | By province, see below |
| United States | 0% |
| United Kingdom | 20% |
| France | 21% |
| Germany | 21% |
| Ireland | 21% |
| Italy | 21% |
| Netherlands | 21% |
| Spain | 21% |

## Tax by province

| Province | Rate |
|---|---|
| Alberta | 5% |
| British Columbia | 12% |
| Manitoba | 13% |
| New Brunswick | 13% |
| Newfoundland and Labrador | 13% |
| Northwest Territories | 13% |
| Nova Scotia | 13% |
| Nunavut | 13% |
| Ontario | 13% |
| Prince Edward Island | 13% |
| Québec | 14.975% |
| Saskatchewan | 13% |
| Yukon | 13% |

## Coupons

| Code | Discount | Status |
|---|---|---|
| WELCOME10 | 10% off each item | Valid |
| SPRING20 | 20% off each item | Expired |

`SPRING20` is recognised on purpose, so the store can show an "expired" message and tracking can record that outcome. The checkout shows the result of every code in plain words, whether it worked or not: applied (with what it saves), expired, or not recognised.

## The cart

The cart is plain code that holds what and how many, and where in the store each item was picked from. It never holds a price, because prices are worked out from the catalog every time. Each rule below has a short reason, so it can be changed on purpose.

1. **A line is a product in one colour and size, with a quantity.** Adding the same product, colour and size again merges into its line, and the quantities add up.
2. **A line keeps the list it first had.** If it had none, it takes the new one. Why: tracking credits the place the shopper first found the item.
3. **Going past the limit stops at the limit.** Adding more than 10 of one item leaves 10 and says the limit was reached, instead of refusing the whole action. Why: it is kinder to the shopper, and nothing is lost.
4. **Sold-out and unknown items are refused,** with the same plain-word messages as pricing.
5. **A list is one collection's row on the page.** It has an id and a name (`tees` and `Tees`), and each item has a place in it that counts from 1. Why: "first" is how people count, and it matches the position numbers on the page.
6. **The cart is saved in the browser for 7 days from its last change.** What is saved is each line's SKU, colour, size, quantity and list, and the time. There are no prices and no personal data. Why: an active cart should not expire mid-shop, and a stored price could go stale.
7. **A saved cart is checked again when it is opened.** A line that is no longer valid, such as a product that is gone, a sold-out variant or a quantity out of range, is dropped and the shopper can be told. A cart that has expired, or that makes no sense, becomes an empty cart.

## Limits

| Rule | Limit |
|---|---|
| Most units of one product, colour and size on one cart line | 10 |
| Most different lines in one cart | 20 |
| How long a saved cart is kept, from its last change | 7 days |

The limit of 20 lines is a safety guard, not a business rule, so it can be raised freely.

## Changing a rule

Every number and list above is defined in one place in the code. To change one, edit the value named here. The tests will then show which other places need to follow, including the tables on this page.

| Rule | Why it is this way | Where to change it |
|---|---|---|
| Products, prices, colours and sizes | The catalog is the one place products are defined | `CATALOG` in `src/shop/catalog.ts` |
| The shape of a variant SKU | The product SKU, the colour in capitals and the size | `variantSku` in `src/shop/catalog.ts` |
| Most units of one item on a line | A sensible cap for a demo store | `MAX_QUANTITY_PER_LINE` in `src/shop/catalog.ts` |
| Most different lines in a cart | A safety guard, not a business rule | `MAX_CART_LINES` in `src/shop/cart.ts` |
| How long a saved cart is kept | Counted from the last change, so an active cart does not expire | `CART_LIFETIME_DAYS` in `src/shop/cart-storage.ts` |
| Exchange rates | Fixed demo rates, not live ones | `CURRENCIES` in `src/shop/money.ts` |
| The starting currency by country | CAD, USD, GBP and EUR by country, and USD for everywhere else | `defaultCurrencyFor` in `src/shop/money.ts` |
| The euro-area countries | The 21 members of the euro area | `EURO_AREA_COUNTRIES` in `src/shop/money.ts` |
| Shipping prices and the free-shipping line | Two flat methods, and only Standard is ever free | `SHIPPING_METHODS` in `src/shop/shipping.ts` |
| Tax rates by country | Simplified demo rates. The United States is 0% on purpose | `COUNTRIES` in `src/shop/destinations.ts` |
| Tax rates by province | Simplified demo rates | `PROVINCES` in `src/shop/destinations.ts` |
| Coupon codes and discounts | Codes are stored in capitals, and a typed code matches in any case | `COUPONS` in `src/shop/coupons.ts` |
