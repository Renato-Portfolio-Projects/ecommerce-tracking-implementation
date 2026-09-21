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

### Changed

- The design spec now describes two shipping methods at flat prices, says `item_id` is the product's SKU, says the checkout coupon field shows the result of every code, says the proof page explains why nothing was sent when a visitor declines tracking, and lists collection pages as a possible later addition.
- The domain and hosting items in the setup checklist are ticked: the renewal price is the same as the first year, auto-renew is on, and the Vercel account is on the Hobby plan.
- The pricing code's problem messages now name the product ("Logo Tee does not come in Red / M.") instead of saying "Line 1:", because a shopper never sees a line.
- The tracking plan says an item's `index` counts from 1 and that the colour-and-size SKU is not the `item_id`. The design spec has a short Cart section.

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
