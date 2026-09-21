# E-commerce Tracking Implementation

A fictional online store, Second Impression, built to demonstrate production-style tracking: Google Tag Manager, GA4, Meta Pixel and Conversions API through a server container, consent handling, and a live page where you can check every event yourself.

> **Status:** version 0.1, foundations, is released, and version 0.2 (the storefront and web tracking) is under way. The site is live at [secondimpression.ca](https://secondimpression.ca) as a placeholder page (a temporary page that shows the store name and a demo notice until the real store is ready). The store's pages are not built yet. Today the repo holds the design, the tracking plan, the shop rules, the tested code that prices an order, and that page.

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
- The domain is the only cost. Everything else runs on free plans. The full tool list, with plans and costs, is in `src/data/stack.ts`.
- **How this was built.** I designed the project and I review every commit. Claude Code, an AI assistant, helped draft the plans and write the code, and every commit carries a co-author line saying so. The reasoning behind each decision is in the design spec.

## Documents

- [Design spec](docs/design/2026-09-19-dummy-store-design.md)
- [Tracking plan](docs/tracking-plan.md)
- [Shop rules](docs/shop-rules.md)
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
