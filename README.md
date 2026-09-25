# E-commerce Tracking Implementation

A fictional online store, Second Impression, built to demonstrate production-style tracking: Google Tag Manager, GA4, Meta Pixel and Conversions API through a server container, consent handling, and a live page where you can check every event yourself.

> **Status:** version 0.1, foundations, is released, and version 0.2 (the storefront and web tracking) is under way. The site is live at [secondimpression.ca](https://secondimpression.ca) as a placeholder page (a temporary page that shows the store name and a demo notice until the real store is ready), because a switch keeps the storefront off in production until it is ready. Behind that switch, the home page, the six product pages, a working cart (an Add to cart button, a cart drawer and a cart page) and the lead popup (an offer that opens by itself on the home page, or by hand from the footer, checks a name and an email and shows a welcome code) are built and can be seen in a preview build. Each visitor starts in the currency for their country, worked out by the store's first server function; checkout, the orders and the rest of the back end are still to come. Today the repo holds the design, the tracking plan, the shop rules, the tested code that prices an order, keeps a cart and checks what a shopper types at checkout, and those pages. The code is organised in three folders: a reusable engine, this store's own data, and the parts that exist only for the demo.

## What this will show

- A tracking plan that the code is tested against, so the documentation cannot drift from what the site does.
- Events sent to Google Analytics 4 and to Meta (the browser pixel and the server-side Conversions API), with TikTok and LinkedIn as possible later steps after the first release.
- Consent handling where nothing loads until the visitor opts in.
- Server-side tracking for four key events, deduplicated against the browser pixel.
- A proof page where any visitor can see their own events, the server's receipts and their own records.

## Roadmap

| Version | What ships | Status |
|---|---|---|
| 0.1 | Foundations: design, tracking plan, placeholder page, CI | Released |
| 0.2 | Storefront and web tracking | In progress |
| 0.3 | Consent and privacy | Planned |
| 0.4 | Server-side tracking | Planned |
| 0.5 | Proof page and case study | Planned |
| 1.0 | Release | Planned |

## Read this first

- It is a demo. There are no real products, no real payments, no real customers and no ad spend. All data is test data.
- What in it is demo-grade, and what a real launch of a store like it would need, is in [Taking this to production](docs/production-guide.md).
- The domain is the only cost. Everything else runs on free plans. The full tool list, with plans and costs, is in `src/data/stack.ts`.
- **How this was built.** I designed the project and I review every commit. Claude Code, an AI assistant, helped draft the plans and write the code, and every commit carries a co-author line saying so. The reasoning behind each decision is in the design spec.

## Documents

- [Design spec](docs/design/2026-09-19-dummy-store-design.md)
- [Tracking plan](docs/tracking-plan.md)
- [Shop rules](docs/shop-rules.md)
- [Browser storage and sessions](docs/browser-storage.md)
- [Taking this to production](docs/production-guide.md)
- [Brand notes](docs/brand.md)
- [Accounts and domain checklist](docs/setup/accounts-and-domain.md)
- [Changelog](CHANGELOG.md)

## Run it locally

Node 22.12 or newer is required.

```bash
npm install
npm run verify
npm run dev
```

`npm run verify` type-checks, runs the unit tests, builds the site and checks the built page.

To look at the whole store as a visitor would, functions included, build it and serve it:

```bash
npm run build:store
npm run serve:store
```

That serves the built store and the functions in `api/` together at `http://localhost:4700`. Add `-- --country FR` to pretend to be visiting from France, or `-- --closed` to run the functions as production does, with the store closed. `npm run dev` and `npm run dev:store` do not run the functions.

## Speed and accessibility

Checked by hand with `npm run lighthouse`, which runs [Lighthouse](https://developer.chrome.com/docs/lighthouse) against the built store on a phone-sized screen, served with its functions running and pretending to be in France, so the page switches to euros while it loads. The budgets are in `docs/brand.md`. Scores from 2026-09-25:

| Page | Performance | Accessibility | Best Practices | JavaScript |
|---|---|---|---|---|
| Home | 99 | 100 | 100 | 23 KB |
| About | 100 | 100 | 100 | 23 KB |
| Shipping | 100 | 100 | 100 | 23 KB |
| Style guide | 100 | 100 | 100 | 0 KB |
| Cart | 99 | 100 | 100 | 23 KB |
| Product page (Logo Tee) | 100 | 100 | 100 | 25 KB |

The JavaScript column adds up the script files a page loads, as the local test server sends them, without compression. Every store page carries the cart, the currency selector, the drawing code and the lead popup's timing and buttons, and a product page adds its colour and size picker. The style guide is not part of the store and loads none. A score can move by a point or so from one run to the next.

The popup's form has its own file, loaded only when the popup is first shown, so this test does not count it. It is 5.7 KB (2.5 KB compressed). With it loaded, a store page carries about 28 KB and a product page about 30 KB (29.6 KB, counted as the files are sent), which is under the 30 KB budget with almost no room. The currency switch adds no measurable layout shift: it is 0.0002 on the home page and the product pages with or without it.

### What was checked in a browser, and what was not

The popup and the pages around it were driven in a real Chrome (version 154) with real clicks, key presses, drags, scrolling and timers: a first visit, every way of opening and closing the popup, every message, the demo buttons, the code, a repeat visit, notes of different ages, another dialog being open, a hidden tab and a second tab, blocked storage, phones upright and on their side, tablets, 200% and 400% zoom, forced-colours mode (Windows high contrast), a slow network and a form file that fails to load. Every store page was checked at 320 pixels wide, except the cart with an item in it, which turned out to run off a narrow screen (found and fixed in v0.2c-1, below).

The starting currency was driven the same way against the local server, in 67 checks: four countries and a visitor with no country, a chosen currency winning, a choice made while the answer is on its way, blocked storage, seven ways for the request to fail, the cart in euros and redrawn when the answer comes late, and a second tab. Every link and every button on all 15 kinds of page were then clicked with a real mouse, about 550 checks. That walk-through found two problems that were already there. A sale price on a product page lost its word "was" as soon as the page's script ran, and on a phone narrower than about 420 pixels the total of a cart line could be pushed off the screen. Both are fixed, and the cart page and its drawer were measured at 13 widths from 320 to 1280 pixels, in all four currencies.

Not checked, and so not claimed: real phones, Safari and Firefox (the whole checking was done in Chrome, using its phone emulation), a real screen reader, and Vercel's own country header on a real deployment, which the local server stands in for. Labels, focus order and announcements were checked by script, which is not the same as hearing them.

Lighthouse runs by hand, not in CI: a real browser and a quiet machine give a fairer score than a CI runner does. Adding it to CI is on the v1.0 checklist.
