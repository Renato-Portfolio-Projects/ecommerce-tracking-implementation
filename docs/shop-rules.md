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

## Limits

| Rule | Limit |
|---|---|
| Most units of one product, colour and size on one cart line | 10 |
