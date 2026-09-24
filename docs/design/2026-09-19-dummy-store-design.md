# Dummy Store: Design Spec

Date: 2026-09-19 (updated after the cost and decisions round)
Status: approved by Renato on 2026-09-19
Owner: Renato Perocchio

## 1. Purpose and success criteria

A fictional e-commerce store, built to prove tracking-implementation skills to employers. It has to feel like a live store, say plainly that it is a demo, and let a reviewer check the tracking themselves in a few minutes.

Success looks like this:

- A stranger can finish the five-step tour (accept cookies, sign up with demo data, shop, pay with the test card, open `/proof`) in under five minutes and see their own events.
- Every claim in the README links to evidence: a commit, file, screenshot or test.
- The tracking and consent contract tests pass in CI on every push.
- The only running cost is the domain. Everything else stays on free plans, and no payment card is entered anywhere (section 12).
- No other visitor's personal data is ever visible, and every record expires after 7 days.

## 2. Decisions

### Resolved

| Area | Decision |
|---|---|
| Back end | Light back end: Vercel serverless functions plus Upstash Redis on the Free plan (no card). Redis deletes each record itself after 7 days, so the retention promise does not depend on a cleanup script |
| Framework | Astro, multi-page, latest stable at build time. Next.js was considered and rejected: the target roles screen for tracking skills, and client-side navigation would add virtual-pageview work that competes with the tracking story |
| Hosting | Vercel Hobby (a personal portfolio fits its non-commercial terms) |
| Domain | `secondimpression.ca`, bought from Namecheap on 2026-09-19 for USD 11.98 a year (CAD 16.78 charged to Renato's card after conversion). The only planned cost (section 12) |
| Cost target | $0 beyond the domain. Free plans only, no upgrades, no card entered anywhere |
| Server-side tagging | Stape Free plan only. No card, no upgrade. 10K requests a month per container. At the limit the container is disabled and stays disabled (no automatic charge, no monthly reset) until upgraded. Up to 5 free containers per Stape account, each with its own quota, so several projects can share one account, each in its own container. A custom domain is listed as paid-only, so the server container uses Stape's default URL and the case study says so plainly |
| Consent | Custom-built banner with Google Consent Mode v2 in **basic** mode: no Google or Meta tag loads until the visitor opts in. Advanced mode was considered and dropped. It sends cookieless pings before consent (which Quebec's Law 25 reads strictly) and would spend server quota on visitors who said no. Its one real benefit, Google's behavioral modeling, needs roughly 1,000 denied-consent events a day for at least 7 days plus 1,000 daily consenting users, which a portfolio demo will not reach. Decided by Renato's delegation on 2026-09-19 |
| Product category | Clothing (t-shirts and pants). Comics was dropped: inventing titles and cover art is extra work with no tracking value |
| Naming | Working project name: Dummy Store. Storefront brand: **Second Impression**, chosen by Renato on 2026-09-19. It refers to the second pass in screen printing and to the second ad impression in retargeting. Tagline idea: "Worth a second look." Domains `secondimpressionco`, `secondimpressionsupply` and `secondimpressiongoods` were open on `.com` and `.ca` in a registry check, and no existing apparel brand with that name turned up in a web search. Renato searched the Canadian (CIPO) and US (USPTO) trademark databases on 2026-09-19. Neither showed a mark named Second Impression, and the one close variant found, a "2nd Impression" record in the US, is cancelled. That is a due-diligence check, not legal clearance, and it cannot see names that are in use but never registered. The case study gets a short "About the name" note. Rejected for close existing brands: WayBack Wears, Near Mint, Backstock, Thread Count, Yore, Bygone, Rewind |
| Lead popup | Shows after 5 seconds or 40% scroll, whichever comes first. The README states that 5 seconds is a deliberate demo setting |
| Currency | Header selector for CAD, USD, EUR and GBP at fixed, documented demo rates. Base currency CAD. The currency locks once checkout starts. The default comes from the visitor's country (Vercel's country header, country-level only, never stored): Canada CAD, US USD, UK GBP, euro countries EUR, everywhere else USD. Built in v0.2 |
| Repository | New public repo under Renato-Portfolio-Projects, named `ecommerce-tracking-implementation` ("implementation" is the word job postings use for this work). The description and topics were approved by Renato on 2026-09-19 and applied. Protected `main`, a PR per phase |
| AI attribution | Commits keep the Claude co-author trailer, and the README has a "How this was built" section |

### Open

- TypeScript versus plain JavaScript: TypeScript is assumed.

## 3. Architecture

```
Browser (Astro pages) --dataLayer--> Web GTM --> GA4 / Meta Pixel (consent-gated)
   |                                    '--> sGTM (Stape) --> Meta CAPI (+ GA4 server)
   |                                               '--> /api/receipt   (tracking-receipts log)
   |-- lead form / checkout --> /api/lead, /api/order --> Redis (leads, orders; 7-day expiry)
   '-- /proof <-- /api/proof  (your session's records + receipts; masked global feed)
```

Two separate stores keep business data apart from analytics plumbing:

- **Business records** (leads, orders) are saved by the site's own endpoints, whatever the tracking consent is.
- **Tracking receipts** exist only when a tracked event actually reached the server container.

Order flow: `/api/order` validates prices and the coupon on the server, issues the order number and stores the order. The thank-you page renders from that response, and `purchase` fires with `transaction_id` equal to the order number. A refresh cannot double-count.

## 4. Tracking design

### Rules

- The site only announces facts to the dataLayer. It never calls `fbq()` or `gtag()`.
- Every ecommerce push is preceded by `{ ecommerce: null }`.
- Every event gets an `event_id` from `crypto.randomUUID()`, except `purchase`, whose ID derives from the order number.
- `page_type` is pushed before the GTM snippet on every page.
- Nothing personal goes in a URL.

### Events (17)

| Event | Fires when | Sent to |
|---|---|---|
| `view_promotion` / `select_promotion` | Popup shown or hero banner in view, then its CTA clicked | GA4 |
| `generate_lead` | `/api/lead` returns OK | GA4, Meta `Lead`, CAPI |
| `view_item_list` | A collection is at least 50% in view, once per list per page | GA4 |
| `select_item` | Product card clicked | GA4 |
| `view_item` | Product page loads | GA4, Meta `ViewContent` |
| `add_to_cart` | Item added | GA4, Meta `AddToCart`, CAPI |
| `remove_from_cart` | Item removed | GA4 |
| `view_cart` | Drawer opens or `/cart` loads | GA4 |
| `begin_checkout` | Checkout loads with items | GA4, Meta `InitiateCheckout`, CAPI |
| `add_shipping_info` | Shipping step completes | GA4 |
| `add_payment_info` | Payment step completes | GA4, Meta `AddPaymentInfo` |
| `purchase` | Thank-you page renders the confirmed order | GA4, Meta `Purchase`, CAPI |
| `apply_coupon` | A code is submitted (status: success, invalid, expired) | GA4 |
| `select_currency` | Currency changed (from, to) | GA4 |
| `cta_click` | A tagged CTA with no ecommerce event is clicked | GA4 only |
| `refund` | Simulated back-office action, server-only (stretch) | GA4 via Measurement Protocol |

`cta_click` uses a single `data-cta` listener. Rule: it fires only where no ecommerce event exists (nav and footer links, "Continue shopping", size guide, and the demo bar's links to the case study and proof page).

### Data contract

- Items follow the GA4 item schema. `item_id` is the product's SKU. It stays the same from the first list view to the purchase, because a shopper has not chosen a colour and size until add to cart. Each colour and size also has its own variant SKU, used on orders and in the catalog feed. `item_category` is the product's collection. `item_list_id`, `item_list_name` and `index` are set on `select_item` and remembered on the cart line at add time, so they carry through `add_to_cart`, `begin_checkout` and `purchase`.
- Meta events carry `content_ids`, `contents`, `content_type`, `value` and `currency`.
- `value` is the net item total after discount, excluding tax and shipping (per Google's ecommerce guide). Tax and shipping are separate fields. Meta receives the same `value`, so revenue matches across platforms.
- `currency` is the currency actually charged.
- Discounts: `coupon` on `begin_checkout` and `purchase`, `discount` per item, `value` net of discount. The server validates the code, so `purchase.coupon` is confirmed. Chain: `generate_lead` (code issued), `apply_coupon`, `purchase`.
- The browser hashes (SHA-256, normalised) any email or phone before it reaches the dataLayer, so no tag sees clear-text personal data. Hashed values are attached only to `generate_lead` and `purchase`, and only travel to the server. Stape's Facebook tag documentation says it hashes raw values and leaves already-hashed values alone. Confirmed with Test Events in v0.4.

### GTM conventions

- Tags: `GA4 - Event - purchase`. Triggers: `CE - purchase`. Variables: `DLV - ecommerce.value`, `CONST - GA4 Measurement ID`. Folders by platform and funnel stage.
- Environments: localhost and preview deploys use separate test IDs. Live traffic and test traffic never share a dataset.
- Every GTM version gets a descriptive name, and the container export is committed with each release (web and server, secrets stripped).
- This project has its own GTM account, GA4 account and Meta dataset, separate from any other project's. That also allows read-only access to be granted to an interviewer without exposing the business.

### Server-side volume

Stape counts every incoming hit to the server container, including script loads. Only `generate_lead`, `add_to_cart`, `begin_checkout` and `purchase` route to the server. The Stape custom loader stays off. The final split is decided in the server-side phase after measuring real volume.

Because reaching 10K disables the container until it is upgraded, the guardrails are:

- Automated tests never send to the live server container. Playwright intercepts the request and checks its contents instead.
- Usage is checked in the Stape dashboard at each release, and the server forward tag is paused if usage passes 80%.
- Bots and `robots.txt`: see the risks table.

## 5. Consent and privacy

- One opt-in model for everyone. Categories: necessary, analytics, marketing. All non-essential denied by default. The banner offers Accept, Reject and Customize with equal prominence. A footer "Cookie settings" link reopens it. Global Privacy Control counts as a marketing rejection.
- Google tags: Consent Mode v2, basic implementation. Nothing from Google loads until analytics consent, and consent is updated on the visitor's choice.
- Meta: no tag fires until marketing consent.
- Server side: the consent state travels with every event. The CAPI tag requires marketing consent, and hashed `user_data` is only attached when it is granted. Because nothing fires before consent, a visitor who says no costs no server quota.
- Lead and order records are saved regardless of tracking consent (the visitor asked for them). Marketing email is a separate, unticked opt-in checkbox (CASL). `/proof` shows both consents as "consent receipts".
- The currency a visitor chooses is kept in `localStorage`, not a cookie, so it needs no entry in the cookie declaration. The country-based starting default waits for v0.2c, since there is no server yet to read a visitor's country; until then every visitor starts at CAD.
- Privacy policy page lists vendors, what is collected and why, 7-day retention, how to withdraw, and a plain "this is a demo" statement. Drafted for Renato's review. It is not legal advice.
- Data minimisation: every form has a "Use demo data" button (section 6) that fills a fictional persona on an `@example.com` address. Records auto-delete after 7 days. Other visitors' emails are never shown (the global feed is masked). No card numbers are ever captured.
- CI asserts that no request at all reaches a Google or Meta endpoint before consent, that Reject keeps it that way, and that the footer link flips the behaviour both ways.

## 6. Storefront

### Pages

`/` home (hero banner, two collections of three products, brand strip, lead popup) · `/products/<slug>` ×6 · `/cart` (the drawer is the quick version, both share one component) · `/checkout` (one URL, three editable in-page steps, then review) · `/thank-you` (renders only with a valid order token) · `/policies/{shipping,returns,privacy,terms}` · `/about` · `/contact` · 404.

Portfolio pages, noindexed but linked from the README, demo bar and thank-you page: `/case-study`, `/proof`.

### Catalog

One data file (SKU, slug, collection, variants, price, sale price, stock, images, copy) drives the pages, GTM item data, product JSON-LD and later the catalog feed. Prices are integer minor units. Two collections of three products: t-shirts and pants, with size and colour variants.

### Money

CAD base. Tax from a small region table (Canadian provinces, flat US, UK and EU demo rates). Two shipping methods, Standard and Express, at flat prices that are the same for every destination, so `shipping_tier` on `add_shipping_info` carries a real choice. Standard is free when the discounted items reach a threshold, and a cart progress bar shows how close the shopper is. `WELCOME10` works and is recorded on the order. Currency selector in the header, persistent, locked once checkout starts.

### Cart

The cart lives in the browser for 7 days from its last change. It holds only each line's SKU, colour, size, quantity and the list the item was picked from, never a price or personal data, and it is checked and re-priced from the catalog whenever it is opened, so a line that is no longer valid is dropped. It holds up to 20 lines and up to 10 units of one product, colour and size. The same product, colour and size merges into one line, which keeps the list it first had. The rules, with the reasons, are in `docs/shop-rules.md`.

The cart is shown by one panel that is either the drawer or the body of `/cart`, so the two can never disagree, and the cart link in the header shows how many units the cart holds. A plain click on that link opens the drawer, so the drawer has a View cart link under its Checkout button, which is the way to the cart page. Adding an item opens the drawer with the item in it, and that is the confirmation: there is no separate message, and a screen reader is told what was added. A quantity that stops at the limit, and saved items that are no longer available, are the only things the cart says in words. A cart line shows a small drawing of the garment. The cart's prices and totals, and the free-shipping bar, are worked out in the browser by the same pricing code the server will run, and the amount charged is always the server's own.

### Checkout

Guest only, realistic validation: each field is checked for its shape (names, email, phone, address, and a postal code in the format of the country), with the same code in the browser and on the server. Nothing is looked up, except that the server also checks an email's domain (see the lead popup below). The payment panel is clearly labelled test mode with a "Use test card" button. It accepts only well-known test card numbers, rejects real ones with a friendly message, and stores nothing except brand and last four digits. The card number is checked in the browser and never sent, so only the brand, the last four digits and whether it was accepted or declined go any further. A designated test decline card shows an error and fires no `purchase`. The order summary has a coupon field. Submitting a code shows the result in plain words, whether it worked or not: applied (with what it saves), expired, or not recognised. The same result is what `apply_coupon` records.

### Lead popup

Shows after 5 seconds or 40% scroll, never on checkout or thank-you, once per 7 days. Esc closes it and focus is trapped. Fields: first name, email, unticked marketing consent. Success state shows the code. The server checks the email before it saves the lead and before `generate_lead` fires: its shape, that its domain is not a temporary-email service, and that the domain can receive mail. So junk addresses never become conversions. Only the domain is looked up, and no email address is sent to any other service. The demo domains (`example.com`, `example.org` and `example.net`) are accepted without a mail check, so the demo people work. See `docs/shop-rules.md`.

### Demo data button

Every form has a small "Use demo data" button (lead popup, checkout information, shipping address, payment), so no visitor has to type personal details.

- One fictional persona per session, picked at random on first use and reused everywhere. The lead and the order then share an identity, so `/proof` can link the lead to the sale. A "new persona" link re-rolls it, always to a different one. There are eight, and none of them has a consent setting.
- Everything it fills is fictional and safe: emails on the reserved `example.com` domain, phone numbers in each country's own reserved fiction range (555-0100 to 0199 for Canada and the United States, and the ranges the regulators set aside for the United Kingdom, France and Germany), invented street addresses with correctly formatted postal or ZIP codes, and only the accepted test card numbers.
- It never ticks a consent checkbox and never touches the cookie banner. Consent stays a deliberate action by the visitor.
- It fills fields the way a person would (input and change events fire), so validation and form-start tracking behave the same. It is a real, labelled, keyboard-operable button, and it announces "Form filled with demo data" to screen readers.
- Fields stay editable, and a note says real details are optional and deleted after 7 days.
- Clicks are tracked as `cta_click` (GA4 only) with labels like `Demo Data - Checkout`, so the case study can report how many visitors used it once there is real data.
- The Playwright tests fill forms with the same generator, so the button is exercised on every push.

### Disclosure

A slim top bar on every storefront page: "Portfolio demo store: fictional products, no real payments. How it's tracked →". Footer "About this demo" links to the case study, proof page and repo. Noindex header on the site. `robots.txt` asks crawlers to stay away, which also protects the Stape quota.

### Look

Mobile-first, WCAG AA, `prefers-reduced-motion`, and an LCP and layout-shift budget checked in Lighthouse with scores published in the README. Design follows the Impeccable routine (craft, critique, polish, audit). Imagery is flat vector illustration of the garments, drawn in code, so it costs nothing, keeps one consistent style, and avoids licensing questions. The style is documented in the repo. Real photography can replace it later if wanted. Brand direction (a proposal to refine in v0.1): a screen-print look, with flat inks, a slight misregistration on illustrations as if a second impression was printed slightly off, and warm paper-toned backgrounds.

## 7. Proof page, case study, tools

### `/proof` (tracking inspector, your session only, keyed by a random token, no IP)

1. Consent state, timestamp, whether GPC was seen, marketing-email consent. If tracking consent is denied or not yet given, this panel says so in plain words: nothing was sent because of the visitor's choice, that is by design and not a fault, and "Cookie settings" turns tracking on.
2. Live event log: every dataLayer push with `event_id` and expandable payload. With tracking denied it shows the same explanation instead of an empty list.
3. Server receipts paired with their browser twin by `event_id`: "deduplicated" or "recovered by server (browser blocked)". With marketing consent denied it explains that no server event was sent.
4. Your lead, order, and first/last-touch attribution.
5. Simulated outbox: welcome and order-confirmation emails, rendered but never sent.
6. Recent activity: a masked, anonymised feed of the last 20 events.
7. Verify it yourself: GA4 DebugView, Pixel Helper and Meta Test Events steps, plus a "delete my data" button.

### `/case-study`

A 60-second summary and the five-step tour up top for recruiters. Below it, for technical reviewers: the architecture diagram, one section per phase with evidence links, decisions and trade-offs, a running mistakes-and-surprises log, a verified-vs-understood table, and a limitations section stating that there are no real customers or ad spend, all data is test data, Meta's Event Match Quality may not populate at low volume and will read low on fake demo data (a made-up email matches no real Meta user), and the Free Stape plan means the server container is on Stape's own URL, so the first-party cookie and ad-blocker-survival demonstrations are out of reach.

### Stack and tools

One data file lists every tool. The README, a `/case-study` section and the privacy page's vendor table all render from it. Each entry records role and category, plan and cost, data touched, consent category, and status (built and verified, understood, or planned) with an evidence link once verified. A cookie declaration table (name, purpose, duration, category) sits alongside it.

Planned entries for v1.0:

- **Site and infrastructure:** Astro, TypeScript (assumed, to confirm), Vercel (Hobby, functions), Redis (Upstash Free), Namecheap, Node.
- **Tracking:** Google Tag Manager (web), Google Tag Manager (server) hosted on Stape Free, GA4, Meta Pixel, Meta Conversions API, custom consent banner with Consent Mode v2 (basic).
- **Testing and QA:** Playwright, GTM Preview, GA4 DebugView, Meta Events Manager Test Events, Meta Pixel Helper, Lighthouse CI, gitleaks, a link checker.
- **Repo and development:** Git and GitHub (Actions, secret scanning), Claude Code (AI-assisted), VS Code.

Later entries (v1.x): TikTok Pixel and Events API, LinkedIn Insight Tag and Conversions API, Microsoft Clarity, Looker Studio, BigQuery export (sandbox only), catalog feed (Meta Commerce Manager, Google Merchant Center), Klaviyo.

## 8. Repository workflow

- New public repo under Renato-Portfolio-Projects. Name and description are proposed for approval.
- `main` is protected. Each phase gets a branch and a PR with a description, how it was verified, and screenshots. Squash-merge, then a tagged release with notes and a Keep-a-Changelog entry.
- Commits use Conventional Commits with the usual types (feat, fix, docs, chore), subject under 60 characters. The body explains the change in plain language. Commits keep the Claude co-author trailer.
- **Review gate:** Claude drafts every repo name and description, commit message, PR and README section. Renato reads each before anything is committed, and approves the push or repo creation separately, per action.
- Secrets hygiene: `.gitignore` and `.env.example` exist before the first commit. GitHub secret scanning and push protection are on, and a gitleaks pre-commit hook catches slips. Public IDs (GA4, pixel) are fine. Tokens, webhook URLs and the Stape container config string never enter the repo.
- CI (GitHub Actions): build and lint, Playwright tracking and consent tests, Lighthouse, link check, gitleaks. Badges at the top of the README.
- Docs: tracking plan (readable and machine-readable), decision records, a runbook written as the build happens, QA evidence, and the web and server GTM exports.
- README opens with a three-line summary, live links, the 60-second tour, a Mermaid architecture diagram, and a "How this was built" section.
- Licence: MIT for code, with the "fictional content" notice stated separately.

## 9. Phases and releases

| Release | Ships | Exit check |
|---|---|---|
| v0.1 Foundations | Repo scaffold, `.gitignore`, `.env.example`, brand and domain, tracking plan, tools data file | Tracking plan approved; placeholder page deployed on the domain |
| v0.2 Storefront and web tracking | The accounts (GTM web, GA4 property, Meta dataset) first, then pages, cart, checkout, money rules, default currency by country, `/api/lead`, `/api/order`, the events above | All events verified in GTM Preview against the schema on test IDs; not announced publicly |
| v0.3 Consent and privacy | Banner, Consent Mode v2 (basic), Meta gating, privacy and cookie pages | Consent matrix passes in CI |
| v0.4 Server-side | Stape Free server container, GA4 client, Meta CAPI for the four key events, `event_id` deduplication, `/api/receipt` | Test Events shows a deduplicated pair; consent respected server-side; usage well under quota |
| v0.5 Proof and case study | `/proof`, `/case-study`, stack section, outbox | A stranger completes the tour |
| v1.0 Release | CI complete, Lighthouse budgets met, README, walkthrough video, container exports, decision records, security review, link audit, redacted screenshots | Release checklist signed off by Renato |

v1.x backlog: product feed and Meta catalog, Microsoft Clarity, Looker Studio dashboard, TikTok and LinkedIn tags with their server-side APIs (TikTok first as a reference, LinkedIn next on Renato's list), labelled synthetic-traffic script (`traffic_type=synthetic`), server-side `refund` event, related-items list, collection pages reached from cards on the home page (a `select_promotion` click on the card, then a `view_item_list` on the collection page), a Shopify dev-store companion, a real CMP comparison, an Astro single-page-mode experiment.

## 10. Verification strategy

- A Playwright golden path (load, consent, list view, select, add, cart, checkout, purchase) asserts event order and schema.
- Variants: a mid-session CAD-to-EUR switch, a coupon success and failure, the decline card (no `purchase`), a `/thank-you` refresh (no second `purchase`), a direct `/thank-you` visit (no `purchase`), and a visitor from another country getting that country's default currency.
- The consent matrix from section 5, run in CI.
- The tests fill every form with the same demo-data generator the button uses, and check that it never ticks a consent checkbox.
- Manual evidence for each phase: GTM Preview, GA4 DebugView, Meta Test Events screenshots (IDs redacted where useful).
- "Fired" is not "received": each claim needs at least two independent checks.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Stape container disabled at 10K requests a month, with no reset until upgraded | Only four events route server-side, `robots.txt`, the custom loader stays off, tests never hit the live server container, an 80% usage check, and the store works with trackers failing |
| Browser safe-browsing flags a fake checkout | No real card capture, test-card-only validation, a visible demo disclosure |
| Personal data exposure | Masked global feed, per-session records, 7-day expiry, demo-data button, "delete my data" |
| Lead and order endpoints abused | Rate limiting, honeypot field, input limits |
| Meta account policy | Separate dataset, and no ads run to the demo domain from any real ad account |
| Event Match Quality shows nothing at low volume | State it in the limitations section and use Test Events as the evidence |
| A claim in the README that isn't backed by evidence | The verified-vs-understood rule: nothing is marked verified until evidence exists |
| Vercel Hobby or Upstash Free limit reached | Both stop serving rather than bill. Usage checked at each release. Limits recorded in the runbook |

## 12. Cost guardrails

Target: $0 beyond the domain.

| Item | Cost | Catch |
|---|---|---|
| Domain (Namecheap) | The one real cost: `secondimpression.ca` at USD 11.98 a year on 2026-09-19 (CAD 16.78 charged to Renato's card after conversion). Costs are recorded at the vendor's price, so the number can be checked. The renewal price is the same, and auto-renew is on | It must stay registered while the portfolio is in use. Decline registrar upsells |
| Stape Free | $0, no card | Disabled at 10K requests a month per container. Never charged automatically |
| Vercel Hobby | $0 | Hard caps, no overage billing. Non-commercial use only, which fits |
| Redis (Upstash Free) | $0, no card | 500K commands a month, 256 MB (verify at signup). Choose the Free plan when the Vercel Marketplace asks |
| GTM (web and server containers), GA4, Meta Pixel and Conversions API, Clarity, Looker Studio | $0 | Meta costs only if ads are run, which this project never does |
| GitHub | $0 | Actions minutes, secret scanning and push protection are free on public repos |
| Playwright, Lighthouse CI, gitleaks, link checker | $0 | |
| Claude Code | Already part of Renato's plan | |
| Product art | $0 | Vector illustrations drawn in code |
| Walkthrough video | $0 | Screen recording, hosted unlisted on YouTube |
| Emails | $0 | Simulated and viewable on `/proof`, never sent |

Rules:

- No payment card is entered in any service for this project. If a signup asks for one, stop and ask.
- Choose the Free plan explicitly wherever a plan choice appears.
- Never enable Google Cloud billing or attach billing to BigQuery (sandbox only, if used at all).
- Never boost, promote or advertise anything.
- Check Stape, Vercel and Upstash usage at each release and record it.

## 13. Out of scope

Real payments, accounts and login, inventory management, a CMS, real shipping, and running paid ads.

## 14. To verify during the build

- Whether Stape's Free plan allows a custom domain (the price page says no). Renato asks Stape support. It does not change the $0 plan.
- Whether outbound calls from the server container count as requests. Same support message. Low impact.
- Whether the Free plan can be used for a business website (it does not matter for this project). Same support message.
- That the Meta server tag leaves pre-hashed values alone: Stape's documentation says it does, confirm with Test Events in v0.4.
- Upstash, Vercel Hobby and Namecheap limits and prices on the day of signup.
