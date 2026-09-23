# Shop rules

Second Impression is a fictional store, so every price, rate and code on this page is a made-up demo value. Nothing here is tax advice, and no real money moves.

This page is the store's price list and rulebook in words. The tables are checked against the code by tests, so this page cannot disagree with what the store actually charges. All the arithmetic lives in one place, `src/engine/pricing.ts`, and both the pages and the server use it, so a price can never differ between what a shopper sees and what is charged.

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

## Checkout forms

The checkout asks for a few details, and the lead popup asks for two of them. Each is checked for its shape only, so an address is not confirmed to exist and a postal code is not compared with a city. The one exception is the email, which the server looks into further (see "Email addresses" below). The same code runs in the shopper's browser, for quick and friendly messages, and on the server, so a request made by hand cannot skip a check. What a shopper types is tidied first: spaces at the ends are removed, and any run of spaces becomes one space.

| Field | Rule | If left empty | If it is wrong |
|---|---|---|---|
| First name | Letters and numbers from any language, spaces, apostrophes, hyphens and periods, up to 50 characters | Enter your first name. | Your first name can only use letters, numbers, spaces, apostrophes, hyphens and periods, up to 50 characters. |
| Last name | The same as the first name | Enter your last name. | Your last name can only use letters, numbers, spaces, apostrophes, hyphens and periods, up to 50 characters. |
| Email | The shape of a real address, see "Email addresses" below | Enter your email address. | That email address doesn't look right. It should look like name@example.com. |
| Phone | Optional. 7 to 15 digits, with spaces, dashes, dots, brackets and a leading + allowed | Nothing, it is optional | That phone number doesn't look right. Use 7 to 15 digits, or leave it empty. |
| Country | One of the nine countries the store ships to | Choose a country we ship to. | Choose a country we ship to. |
| Street address | Letters, numbers and basic punctuation, up to 80 characters. May start with a # | Enter your street address. | Check your street address. It can use letters, numbers and basic punctuation, up to 80 characters. |
| Second address line | Optional. The same as the street address | Nothing, it is optional | Check your second address line. It can use letters, numbers and basic punctuation, up to 80 characters. |
| City | Letters and numbers, spaces, apostrophes, hyphens and periods, up to 60 characters | Enter your city. | Check your city. It can only use letters, numbers, spaces, apostrophes, hyphens and periods, up to 60 characters. |
| Province | Canada only: one of the 13 provinces and territories, because the tax depends on it. Ignored in other countries | Choose your province or territory. | Choose your province or territory. |
| Postal code | The format of the country, see below | Enter a valid postal code, like K1A 0B1. | Enter a valid postal code, like K1A 0B1. |

The postal code message uses the country's own word for it, and an example. For the United States it reads "Enter a valid ZIP code, like 95014." The table shows Canada's.

## Email addresses

An email is checked twice. Its shape is checked in the browser and again on the server, like every other field. The server then goes further, so that trash and mistyped addresses never become leads. Only the domain (the part after the @) is ever looked up, and no email address is sent to any other service.

**The shape** (in the browser and on the server). Up to 254 characters, with exactly one @. Before it, up to 64 characters: letters and digits from any language, and the marks email allows (`. _ - + '` and a few rarer ones), with a dot only between characters. After it, a domain of at least two parts separated by dots, each part up to 63 characters of letters, digits and hyphens that neither starts nor ends with a hyphen. The last part has at least two characters, is not all digits, and is not one of the endings set aside for tests and examples (`.test`, `.example`, `.invalid` and `.localhost`). Quoted names, addresses in square brackets and single-word domains such as `localhost` are refused, because nobody at a shop has one and a typo is far more likely. The message for a mistake is in the "Checkout forms" table.

**The domain checks** (on the server only, after the shape is accepted):

| Check | Refused when | What the shopper reads |
|---|---|---|
| Temporary address | The domain, or a domain it sits under, is on the list of temporary email services | That looks like a temporary email address. Please use one you check regularly. |
| Domain cannot receive email | The server looks at the domain's mail service and finds none | It looks like that address can't receive email. Please check the part after the @ for typos. |

- **The list of temporary domains** is a copy of a public-domain list (CC0) kept in the repo at `src/engine/disposable-email-domains.txt`. It was copied on 2026-09-21 and holds 8915 domains, including Mailinator, 10 Minute Mail, YOPmail and Guerrilla Mail. It does not list the big mail providers or the privacy relays real customers use (Apple Hide My Email, DuckDuckGo and Firefox Relay). No list is complete, so it catches the well-known services and never the newest ones. It is refreshed by hand, and its header says how. It is used on the server only, so it never slows a page.
- **The look at the mail service** is done by the server and passed to this code as one of three answers: it takes mail, it does not, or the look failed. A failed look lets the address through, so a hiccup never blocks a real customer.
- **The demo domains.** `example.com`, `example.org` and `example.net` are reserved for examples and can never receive mail. They are accepted without any mail check, so the demo people work. Every other domain has to pass the real checks.
- **What is deliberately not done.** The store does not prove that an address belongs to the shopper, because that means emailing whatever a stranger types. It needs a sending service, and it lets someone email a victim through the site. It does not use an email verification service, which would receive every visitor's full address and be one more company to disclose. It does not probe mail servers to test whether a mailbox exists, which is unreliable and can get the server blocked. These limits are written up in the case study.

## Postal codes

Only the shape of a postal code is checked. Capitals and spaces do not matter: a code is kept in capitals with its usual space, so `k1a0b1` becomes `K1A 0B1`. The shapes follow the address data Google publishes for its own address forms.

| Country | Called | Format | Example |
|---|---|---|---|
| Canada | postal code | Letter, digit, letter, a space, then digit, letter, digit | K1A 0B1 |
| United States | ZIP code | 5 digits, and optionally a dash and 4 more digits | 95014 |
| United Kingdom | postcode | A code such as EC1A or M2, a space, then a digit and two letters | EC1A 1HQ |
| France | postal code | 5 digits | 33380 |
| Germany | postal code | 5 digits | 26133 |
| Ireland | Eircode | A letter and two digits, a space, then 4 letters or digits | A65 F4E2 |
| Italy | postal code | 5 digits | 00144 |
| Netherlands | postal code | 4 digits, a space, then 2 letters | 1234 AB |
| Spain | postal code | 5 digits | 28039 |

## Test cards

This is a demo store, so the payment form takes only well-known test card numbers. Any other number is turned down with a friendly message, however real it looks. The card number is checked in the shopper's browser and goes no further. Only the brand and the last four digits are kept, so a card number never reaches the server.

| Number | Brand | What happens |
|---|---|---|
| 4242 4242 4242 4242 | Visa | Accepted. The "Use test card" button fills this one |
| 5555 5555 5555 4444 | Mastercard | Accepted |
| 4000 0000 0000 0002 | Visa | Declined, and no purchase is recorded |

The numbers are the ones Stripe publishes for testing. Other rules:

- The expiry date is any month from this one on, written MM/YY. A card is good to the end of its month. The "Use test card" button fills December three years from today, so it never goes out of date.
- The security code is any 3 digits.
- No name on the card is asked for.
- The decline card is only declined once the other fields are good. With a bad expiry date, the store asks for a good one first.

### What the payment form checks

| Field | Rule | If left empty | If it is wrong |
|---|---|---|---|
| Card number | One of the test cards above, with or without spaces or dashes | Enter the card number. | This is a demo store, so only test cards work. Please don't enter a real card number. Use the "Use test card" button. |
| Expiry date | MM/YY | Enter the expiry date as MM/YY. | Enter the expiry date as MM/YY. |
| Security code | Any 3 digits | Enter the 3-digit security code. | Enter the 3-digit security code. |
| Expiry date, month already over | A month before this one | - | That card has expired. Enter a date in the future. |
| The decline card | The decline card, when everything else is good | - | Your card was declined. This is the test card that always declines. Use the "Use test card" button to try one that works. |

## Demo people

Every "Use demo data" button fills in one of eight fictional people, so no visitor has to type personal details. One is picked at random the first time a visitor uses a button, and the same person is used everywhere after that, so a visitor's lead and order share one identity. A "new persona" link picks a different one.

- Emails are on `example.com`, which is reserved for examples and never delivers mail.
- Phone numbers are in each country's own reserved fiction range, so a demo number can never ring a real person. Canada and the United States use 555-0100 to 555-0199. The United Kingdom, France and Germany use the ranges their regulators (Ofcom, ARCEP and the Bundesnetzagentur) set aside for films and television.
- Streets are invented, and each postal code is in the right format for its country.
- The buttons never tick a consent box and never touch the cookie banner. A person in the code has no consent setting at all.

| Name | City | Country |
|---|---|---|
| Maya Tremblay | Montréal | Canada |
| Liam Okafor | Toronto | Canada |
| Priya Sandhu | Vancouver | Canada |
| Jordan Ellis | Portland | United States |
| Sam Rivera | Austin | United States |
| Eleanor Hughes | London | United Kingdom |
| Camille Laurent | Lyon | France |
| Jonas Weber | Berlin | Germany |

## Where the code lives

The code is kept in three folders, so that the reusable part can be told apart from one store's own data and from what exists only for the demo.

| Folder | What it holds | Files |
|---|---|---|
| `src/engine` | The reusable code: pricing, the cart, the checks on what a shopper types, the email domain checks, and the helper that fills the blanks in a piece of text. It knows nothing about one particular store | `cart-storage.ts`, `cart.ts`, `catalog.ts`, `checkout-form.ts`, `coupons.ts`, `disposable-email-domains.txt`, `email-domain.ts`, `fill.ts`, `money.ts`, `postal-codes.ts`, `pricing.ts`, `shipping.ts`, `tax.ts` |
| `src/store` | Second Impression's own data: its products, currencies and rates, countries and tax rates, shipping methods, coupon codes, cart limits, the words a shopper reads and the places its pages link to outside the site | `coupon-codes.ts`, `currencies.ts`, `destinations.ts`, `policy.ts`, `products.ts`, `shipping-methods.ts`, `site.ts`, `words.ts` |
| `src/demo` | What exists only for the demo: the test cards, the eight demo people and the demo email domains. A real store deletes this folder | `email-domains.ts`, `personas.ts`, `test-cards.ts` |

Two rules keep the folders apart, and a test checks them on every run:

- The store folder imports nothing from the other two, so a store's folder can be swapped whole.
- The engine never imports from the demo folder, so deleting the demo folder leaves the engine working.

To reuse the engine for another store, write a new `src/store` folder with the same file names and the same exports, and delete `src/demo`. The engine reads everything it needs about a store from what those files export. A few things in the engine still carry this store's choices, and would need attention first: the field names that end in `Cad` (such as `priceCad`), the Canadian English formatting of money, the example SKU in one error message, and the postal code formats, which cover only the nine countries this store ships to.

## Changing a rule

Every number and list above is defined in one place in the code. To change one, edit the value named here. The tests will then show which other places need to follow, including the tables on this page.

| Rule | Why it is this way | Where to change it |
|---|---|---|
| Products, prices, colours and sizes | The catalog is the one place products are defined | `CATALOG` in `src/store/products.ts` |
| The shape of a variant SKU | The product SKU, the colour in capitals and the size | `variantSku` in `src/engine/catalog.ts` |
| Most units of one item on a line | A sensible cap for a demo store | `MAX_QUANTITY_PER_LINE` in `src/store/policy.ts` |
| Most different lines in a cart | A safety guard, not a business rule | `MAX_CART_LINES` in `src/store/policy.ts` |
| How long a saved cart is kept | Counted from the last change, so an active cart does not expire | `CART_LIFETIME_DAYS` in `src/store/policy.ts` |
| Exchange rates | Fixed demo rates, not live ones | `CURRENCIES` in `src/store/currencies.ts` |
| The starting currency by country | CAD, USD, GBP and EUR by country, and USD for everywhere else | `defaultCurrencyFor` in `src/store/currencies.ts` |
| The euro-area countries | The 21 members of the euro area | `EURO_AREA_COUNTRIES` in `src/store/currencies.ts` |
| Shipping prices and the free-shipping line | Two flat methods, and only Standard is ever free | `SHIPPING_METHODS` in `src/store/shipping-methods.ts` |
| Tax rates by country | Simplified demo rates. The United States is 0% on purpose | `COUNTRIES` in `src/store/destinations.ts` |
| Tax rates by province | Simplified demo rates | `PROVINCES` in `src/store/destinations.ts` |
| Coupon codes and discounts | Codes are stored in capitals, and a typed code matches in any case | `COUPONS` in `src/store/coupon-codes.ts` |
| The characters a name, a city or a street line may use | Letters from any language and the marks names use, so real names are not turned away | `NAME_PATTERN` in `src/engine/checkout-form.ts` and `STREET_PATTERN` in `src/engine/checkout-form.ts` |
| The length limits on names, cities, street lines and emails | Long enough for real names, short enough to keep records tidy. The email limits are the email standard's | `NAME_LENGTH`, `CITY_LENGTH` and `ADDRESS_LENGTH` in `src/engine/checkout-form.ts`, and `EMAIL_LENGTH`, `LOCAL_PART_LENGTH` and `DOMAIN_PART_LENGTH` in `src/engine/checkout-form.ts` |
| How many digits a phone number has | Seven keeps out obvious typos, and 15 is the most an international number can have | `PHONE_DIGITS` in `src/engine/checkout-form.ts` |
| What an email may look like | The email standard's rules for the part before the @, letters from any language, a domain of two or more parts, and no endings set aside for tests | `LOCAL_PART_PATTERN` in `src/engine/checkout-form.ts`, `DOMAIN_PART_PATTERN` in `src/engine/checkout-form.ts` and `RESERVED_EMAIL_ENDINGS` in `src/engine/checkout-form.ts` |
| The postal code formats | Shape only, one for each country the store ships to | `POSTAL_CODE_FORMATS` in `src/engine/postal-codes.ts` |
| Which card numbers are accepted, and which one declines | Well-known test numbers only, so a real card can never work | `TEST_CARDS` in `src/demo/test-cards.ts` |
| The people the demo buttons fill in | Fictional, on example.com, with phone numbers in each country's reserved fiction range | `PERSONAS` in `src/demo/personas.ts` |
| Which email domains are turned down as temporary | A public-domain list, copied on a date and refreshed by hand. Sub-domains of a listed domain count too | `isDisposableDomain` in `src/engine/email-domain.ts` and `Copied on` in `src/engine/disposable-email-domains.txt` |
| Which email domains are accepted without a mail check | Reserved for examples, so the demo people work | `DEMO_EMAIL_DOMAINS` in `src/demo/email-domains.ts` |
| What the server does with the look at a domain's mail service | Refuse when there is none, and let the address through when the look failed | `checkEmailDomain` in `src/engine/email-domain.ts` |
| The words on the store's pages, and the messages it shows | Written once, in the store's voice, and listed with where each appears in `docs/site-words.md` | `WORDS` in `src/store/words.ts` |
| Which code is reusable, which is one store's, and which is only the demo | The store's folder can be swapped whole, and the demo folder deleted, without breaking the engine | `offenders` in `tests/unit/architecture.test.ts` |
