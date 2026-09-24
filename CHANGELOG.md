# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [semantic versioning](https://semver.org/).

## [Unreleased]

### Added

- The shop rules: the six products, four currencies, shipping, tax and coupons, in words, with tables that tests check against the code.
- The code that prices an order: money in whole cents, currency conversion, the catalog, shipping, tax by country and province, and the `WELCOME10` coupon. Its tests also price 700 randomly generated carts, made in memory while the tests run and never saved, and each must add up to the cent.
- The tracking plan now says how item names, variants, prices and discounts are written, that `item_id` is the product's SKU, and that `shipping_tier` is `Standard` or `Express`.
- The cart: lines that hold what was picked, how many and the list each item was picked from, with merging, limits, and a saved form that lasts seven days and holds no prices.
- A SKU for every colour and size, and the starting currency for each visitor's country.
- The rules page now covers the cart, the variant SKUs and the default currency, with a reason for each rule and a "Changing a rule" table that says where each one lives in the code.
- The checkout form checks: names, email, phone, address and the postal codes of the nine countries the store ships to. Each is checked for its shape, with the message a shopper would read. An email follows the email standard, so accented and non-English addresses work and typos such as doubled dots are refused.
- Email domain checks for the server: a dated copy of a public-domain list of temporary email domains, and the decision about a domain that cannot receive mail. Only the domain is looked up. The demo domains (example.com, example.org and example.net) are accepted so the demo people work.
- The test cards: three well-known test numbers, one of which always declines, and a check that keeps only the brand and last four digits of a card.
- Eight fictional people for the "Use demo data" buttons, with emails on example.com and phone numbers in each country's own reserved fiction range.
- The rules page now covers the checkout forms, postal codes, test cards and demo people, with the message for each mistake.
- A test that keeps the code's three folders apart: the engine, one store's data, and the demo-only parts. It fails if the store folder imports from the other two, or if the engine imports from the demo folder.
- The rules page now says where the code lives, and what would need attention before the engine could be reused for another store.
- A production guide: what in the demo is demo-grade and what a real launch would need, in nine areas, with a source for each statement about a vendor, a law or a standard, and the day the sources were checked. A test keeps its file names, links and source columns honest.
- Every word a shopper can read, in one file (`src/store/words.ts`), reviewed on its own page (`docs/site-words.md`) before any page used it. Two self-hosted, open-licence fonts (Fraunces and Public Sans), and six flat-vector garment drawings, one per outline, recoloured per product colour rather than redrawn.
- A build-time switch, `PUBLIC_STORE_OPEN`, that keeps the storefront off in production and on in preview builds. The header, footer, demo bar, and the About, Contact and policy pages, plus a matching 404. A local Lighthouse script and the speed and accessibility budgets it checks against.
- The home page (hero banner, both collections, brand strip) and all six product pages, generated from one dynamic template, with colour and size pickers, sold-out handling, sale pricing and a schema.org Product script for each. A currency selector that shows a price already computed in every offered currency, so switching currency needs no arithmetic in the browser. The engine module that remembers which list a product was picked from, for the cart to carry forward later.
- A new "Product content" area in the production guide, on what real product photography a launch would need and why a product's structured data needs it to be eligible for Google's shopping search results at all.
- The cart in the store: a cart page and a drawer that opens over any store page, both drawn by one panel. Add to cart on a product page puts the chosen colour, size and quantity in the cart, with the list the product was picked from, and opens the drawer. Each line has plus, minus and Remove buttons and a small drawing of the garment. The cart shows a subtotal and a free-shipping bar that is exact, not rounded, and the cart link in the header shows how many units it holds. Because that link opens the drawer, the drawer has a View cart link under its Checkout button, which is the way to the cart page. The cart is kept in the browser for seven days, checked again when it is reopened, and kept in step across tabs and currency changes. Its prices are worked out in the browser, which makes it the one exception to prices being worked out when the site is built. There is no checkout yet, so the Checkout button does nothing, and nothing is sent to any tracker.
- Built-page tests for the cart page, the drawer and the header link, and a check that every product page carries its own SKU and a marked quantity field.
- Two rows in the production guide's "Orders and data" area: where a real store keeps its cart, and live stock in place of sold-out sizes fixed when the site is built.

### Changed

- The design spec now describes two shipping methods at flat prices, says `item_id` is the product's SKU, says the checkout coupon field shows the result of every code, says the proof page explains why nothing was sent when a visitor declines tracking, and lists collection pages as a possible later addition.
- The domain and hosting items in the setup checklist are ticked: the renewal price is the same as the first year, auto-renew is on, and the Vercel account is on the Hobby plan.
- The pricing code's problem messages now name the product ("Logo Tee does not come in Red / M.") instead of saying "Line 1:", because a shopper never sees a line.
- The tracking plan says an item's `index` counts from 1 and that the colour-and-size SKU is not the `item_id`. The design spec has a short Cart section.
- The design spec now says each country has its own reserved fiction phone range for the demo data (555-01xx is North American only), that a card number never leaves the browser, what the checkout's validation covers, and that the server checks an email's domain before a lead is saved.
- The shop code is reorganised into three folders, with no change in behaviour: `src/engine` (the reusable code), `src/store` (Second Impression's own data) and `src/demo` (what exists only for the demo). The email domain check no longer has the demo's example.com, example.org and example.net built in: the demo now passes them in as the names to let through without a mail check.
- The colour tokens gained a darker red for small text, since the bright spot red the garments use does not pass contrast at small sizes. `docs/brand.md` is rewritten to describe the fonts, palette and the speed and accessibility budgets actually measured.
- The design spec's currency section no longer describes the currency choice as a cookie: it is kept in `localStorage`, needs no entry in the cookie declaration, and the country-based starting default waits for v0.2c.
- The README's status line, and the production guide, updated to say what is now actually built behind the store-open switch.
- The Lighthouse script also tests the cart page and a product page, and the README's Lighthouse table is replaced with measured figures for six pages. Its "0 KB" JavaScript column, which counts script files only and had been run on four pages that were neither the cart nor a product page, is now 17 KB on a store page and 19 KB on a product page, against a budget of 30.
- The product page's script no longer carries the words file: the page hands it the one sentence it needs. The description of a garment drawing moved into its own file, `garment-label.ts`, so that a script which draws a garment does not pull the words in.
- The design spec's Cart section now describes the cart's screens, the production guide's rows on prices and currency say that the cart is priced in the browser, and the README's status line says that the cart works.

## [0.1.0] - 2026-09-19

### Added

- The design spec for the store and its tracking.
- A tracking plan covering each platform and event, checked against the code.
- A list of every tool and its cost, checked so that only the domain can cost money.
- A placeholder page with the demo notice, kept out of search engines. It stays until the real store is built.
- Security headers and a `robots.txt`.
- CI that type-checks, tests, builds and scans for secrets on every push.
- Brand notes, and a checklist of the accounts and domain steps that need Renato.
- The domain, secondimpression.ca, bought from Namecheap. It is the project's only cost.
- The placeholder page is live at https://secondimpression.ca, hosted on Vercel, and `www.secondimpression.ca` redirects to it.
