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
- The cart in the store: a cart page and a drawer that opens over any store page, both drawn by one panel. Add to cart on a product page puts the chosen colour, size and quantity in the cart, with the list the product was picked from, and opens the drawer. Each line has plus, minus and Remove buttons and a small drawing of the garment. The cart shows a subtotal and a free-shipping bar that is exact, not rounded, and the cart link in the header shows how many units it holds (on the cart page itself the link is marked as the current page and does nothing when clicked, rather than reloading the page). Because that link opens the drawer, the drawer has a View cart link under its Checkout button, which is the way to the cart page, and the cart page has a Keep shopping link in the same place, which is the way back to the store. The cart is kept in the browser for seven days, checked again when it is reopened, and kept in step across tabs and currency changes. Its prices are worked out in the browser, which makes it the one exception to prices being worked out when the site is built. There is no checkout yet, so the Checkout button does nothing, and nothing is sent to any tracker.
- Built-page tests for the cart page, the drawer and the header link, and a check that every product page carries its own SKU and a marked quantity field.
- Two rows in the production guide's "Orders and data" area: where a real store keeps its cart, and live stock in place of sold-out sizes fixed when the site is built.
- The lead popup, behind the switch: a dialog that opens by itself on the home page after 5 seconds or once the visitor has scrolled 40% of the way down, whichever comes first, at most once every 7 days, never over another dialog, and counting the seconds only while the tab is on screen. The 5 seconds is a deliberate demo setting. When another dialog such as the cart drawer closes, the 5 seconds start again. A footer link and a corner tab open it by hand on every store page. It closes with the X, No thanks, Escape or a click on the dimmed page, and that click is ignored once something has been typed. Its form checks a first name and an email when it is sent, shows the welcome code, keeps a half-typed form as a draft, and has a "Use demo data" button, which keeps one fictional person for the visit, and a "Try another person" button. Nothing is saved or sent yet: the popup announces `lead-popup:shown`, `lead-popup:closed` and `lead-popup:submitted` on the page for the tracking phase, and `submitLead` is the one stand-in that the back end replaces. If its form file cannot be loaded, it says so.
- The welcome offer comes from the coupon data: a coupon can be marked as the welcome code, `welcomeCoupon()` returns the live one, and a test requires exactly one. Other codes can be live at the same time.
- The rule for when the popup may open, in `src/engine/lead-popup.ts`, with tests: one saved note of when it was last shown and how it ended (no name and no email), the 7 days, and the scroll rule, which counts along the distance a page can be scrolled.
- `docs/browser-storage.md`: what the store keeps in the browser, for how long, when each thing comes into play, what happens when the browser will not keep anything, and the three meanings of "session", with a test that keeps it in step with the code and fails if the store starts to set a cookie.
- A production guide area, "Lead capture": when a popup may appear, the welcome code and saving the lead. The marketing consent row now says the checkbox is built.
- The tracking plan lists the popup's three announcements and its three `data-cta` labels, for the tracking phase to hang on.
- Built-page tests for the popup on every store page, for the script that opens it and for its form being a separate file that no page loads with it. The README says what was checked in a real browser, and what was not.
- The store's first server code. A `src/server` folder holds what runs on a server, and an `api/` folder holds the functions, written as plain files for Vercel Functions and not through an Astro adapter, so the site stays static. A gate makes every function answer 404, in the store's own words, until the store is open, and every answer tells caches never to keep it. A test keeps the server code apart from the browser code.
- `/api/currency`: the country Vercel adds to a request becomes a starting currency, and only the currency is answered, never the country.
- `npm run serve:store`, which serves the built store and its functions together on this machine, with `--country` to pretend to be visiting from another country and `--closed` to run as production does. `esbuild` is now listed in `package.json`, at the version Astro had already installed.
- A visitor who has chosen no currency now starts in the one for their country. The answer is kept for the tab only, is never taken for the visitor's own choice, is dropped if they choose while it is on its way, and gives way to Canadian dollars if the function cannot be reached. The browser storage page lists the new key.
- Built-page tests for the starting currency, and a helper that reads a page's script together with the files it imports.
- Two rows in the production guide: the starting currency by country, and the server functions.

### Changed

- The design spec now describes two shipping methods at flat prices, says `item_id` is the product's SKU, says the checkout coupon field shows the result of every code, says the proof page explains why nothing was sent when a visitor declines tracking, and lists collection pages as a possible later addition.
- The domain and hosting items in the setup checklist are ticked: the renewal price is the same as the first year, auto-renew is on, and the Vercel account is on the Hobby plan.
- The pricing code's problem messages now name the product ("Logo Tee does not come in Red / M.") instead of saying "Line 1:", because a shopper never sees a line.
- The tracking plan says an item's `index` counts from 1 and that the colour-and-size SKU is not the `item_id`. The design spec has a short Cart section.
- The design spec now says each country has its own reserved fiction phone range for the demo data (555-01xx is North American only), that a card number never leaves the browser, what the checkout's validation covers, and that the server checks an email's domain before a lead is saved.
- The shop code is reorganised into three folders, with no change in behaviour: `src/engine` (the reusable code), `src/store` (Second Impression's own data) and `src/demo` (what exists only for the demo). The email domain check no longer has the demo's example.com, example.org and example.net built in: the demo now passes them in as the names to let through without a mail check.
- The colour tokens gained a darker red for small text, since the bright spot red the garments use does not pass contrast at small sizes. `docs/brand.md` is rewritten to describe the fonts, palette and the speed and accessibility budgets actually measured.
- The design spec's currency section no longer describes the currency choice as a cookie: it is kept in `localStorage`, needs no entry in the cookie declaration, and the country-based starting default waits for v0.2c.
- The design spec's lead popup and demo button sections now describe what was built: opening by itself on the home page only, the ways to open and close it, and a "Try another person" button in place of a "new persona" link.
- The footer has more room at its bottom, so the corner tab never covers its last line, which says the store is fictional. The header wraps at 320 pixels wide, where it had made every store page wider than the screen. The popup, its tab and the shared button style have a border that cannot be seen and that forced-colours mode colours in, so they keep their shape there. Nothing changes size for anyone else.
- The words page lists the popup's words, including the message for a form file that cannot be loaded, and says that "Try another person" and the footer link are buttons.
- The store's script budget note in the brand notes says what the Lighthouse test counts, and that the popup's form, loaded on demand, is on top of it.
- The README's status line, and the production guide, updated to say what is now actually built behind the store-open switch.
- The Lighthouse script also tests the cart page and a product page, and the README's Lighthouse table is replaced with measured figures for six pages. Its "0 KB" JavaScript column, which counts script files only and had been run on four pages that were neither the cart nor a product page, is now 17 KB on a store page and 19 KB on a product page, against a budget of 30.
- The product page's script no longer carries the words file: the page hands it the one sentence it needs. The description of a garment drawing moved into its own file, `garment-label.ts`, so that a script which draws a garment does not pull the words in.
- The design spec's Cart section now describes the cart's screens, the production guide's rows on prices and currency say that the cart is priced in the browser, and the README's status line says that the cart works.
- `npm run lighthouse` now serves the store with its functions running, pretending to be in France. A plain file server made every page log a failed request for the starting currency, which lowered Best Practices to 96 for something a visitor never sees. The README's figures are updated, and the brand notes say that a product page with the popup's form loaded now carries about 30 KB of script, almost the whole 30 KB budget.
- The design spec's currency and back-end lines, and the production guide's currency and security summaries, now describe the starting currency and the functions.

### Fixed

- A sale price on a product page kept its word "was" only until the page's script ran, when the currency selector replaced "was $42.00" with "$42.00". The word now stays in every currency.
- On a phone narrower than about 420 pixels the total of a cart line could be pushed off the screen: cut off in the cart drawer, and making the cart page scroll sideways. The middle column of a line can now shrink, its buttons wrap, and the cart page uses the drawer's smaller picture on a phone. Nothing changes from 420 pixels up.

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
