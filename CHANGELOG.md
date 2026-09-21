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

### Changed

- The design spec now describes two shipping methods at flat prices, says `item_id` is the product's SKU, says the checkout coupon field shows the result of every code, says the proof page explains why nothing was sent when a visitor declines tracking, and lists collection pages as a possible later addition.
- The domain and hosting items in the setup checklist are ticked: the renewal price is the same as the first year, auto-renew is on, and the Vercel account is on the Hobby plan.
- The pricing code's problem messages now name the product ("Logo Tee does not come in Red / M.") instead of saying "Line 1:", because a shopper never sees a line.
- The tracking plan says an item's `index` counts from 1 and that the colour-and-size SKU is not the `item_id`. The design spec has a short Cart section.
- The design spec now says each country has its own reserved fiction phone range for the demo data (555-01xx is North American only), that a card number never leaves the browser, what the checkout's validation covers, and that the server checks an email's domain before a lead is saved.
- The shop code is reorganised into three folders, with no change in behaviour: `src/engine` (the reusable code), `src/store` (Second Impression's own data) and `src/demo` (what exists only for the demo). The email domain check no longer has the demo's example.com, example.org and example.net built in: the demo now passes them in as the names to let through without a mail check.

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
