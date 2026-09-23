# Taking this to production

Second Impression is a demo. This page says, area by area, what in it is demo-grade and what a real launch of a store like it would need, so that a portfolio piece is not mistaken for a finished shop. It also says what carries over unchanged.

It is a checklist, not legal, tax or financial advice. Laws, prices and vendor limits change, and many of them depend on where a store is based and where it sells. Ask a professional before relying on any row.

Sources checked on 2026-09-21.

## How to read this page

- Every area has one table with four columns: what the demo does, what a real launch needs, where that lives in this repository, and the source.
- A statement about a vendor, a law or a standard links to the vendor's, regulator's or standards body's own page. Where that page shows the date it was updated, the date is given. A statement about this repository names the file.
- "Not verified" in the source column means that no primary source was found, and that the row describes general practice, so there is no page to point to.
- Vendors are named as examples, not recommendations, and nothing on this page needs an account. Prices and limits are as the vendor's page showed them on the date above.
- "Planned" means that the design decides it but it is not built yet, and the version that builds it is named.
- A source that is not in English says so.

## At a glance

| Area | Verdict | In one line |
|---|---|---|
| Shop code (`src/engine`) | Reusable as is | Pricing, the cart, the checks on what a shopper types and the email domain checks are tested and do not depend on this store. |
| Hosting and terms | Needs replacing | The free plans are for personal projects and stop at fixed limits. A store needs plans whose terms allow commercial use. |
| Payments | Needs adding | Test cards never reach a bank. A store needs a payment provider and the rules that come with taking cards. |
| Orders and data | Needs adding | Records last 7 days. A store needs a durable database, order numbers, an admin, stock counts and backups. |
| Tax | Needs replacing | The rates are fixed demo rates. A store looks rates up and registers where the law says it must. |
| Currency | Needs replacing | The exchange rates are fixed demo rates. A store uses real ones and saves the rate on each order. |
| Product content | Needs adding | Every product is a flat, line-drawn illustration. A store needs real photography, which Google requires for a product's structured data to be eligible for its richer search results at all. |
| Shipping and fulfillment | Needs replacing | There are two flat methods and nothing is shipped. A store needs real rates, duties, packing and returns. |
| Email | Needs adding | The emails are simulated. A store needs a sending service, sender authentication and consent it can prove. |
| Legal and privacy | Needs adding | There is only a demo notice, and a draft policy is planned. A store needs terms, policies and a review by a professional. |
| Security and operations | Needs adding | The input checks carry over. A store also needs monitoring, backups and a watch on its dependencies. |

## What carries over unchanged

- `src/engine` holds the pricing, the cart and its saved form, the checks on what a shopper types, the postal codes and the email domain checks. It reads one store's data from `src/store`, so a new store writes its own `src/store` folder. The section "Where the code lives" in `docs/shop-rules.md` says how, and lists what still carries this store's choices.
- The event design and the data contract in `docs/tracking-plan.md`.
- The way the rules are kept: every rule is written in words in `docs/shop-rules.md`, and tests compare that page with the code.
- The checks in `.github/workflows/ci.yml`: the type check, the tests, the build and a secret scan.

## Hosting and terms

The free plans used here have terms that suit a portfolio piece and not a store.

| What the demo does | What a real launch needs | Where in this repo | Source |
|---|---|---|---|
| **Commercial use.** The demo runs on Vercel's free Hobby plan, which is limited to personal, non-commercial use. | Vercel counts a site that asks visitors for payment as commercial use, so a store needs a paid Pro or Enterprise plan, or a host whose terms allow it. | `docs/design/2026-09-19-dummy-store-design.md` (section 12) | [Vercel: Fair Use Guidelines, commercial usage](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage) (updated 2026-09-14) |
| **Limits that stop the site.** On the Hobby plan, going over a usage limit usually means waiting 30 days before that feature works again. The plan includes 1,000,000 function invocations and 100 GB of fast data transfer a month. | A paid plan keeps running and bills the extra use, and it adds email support and longer logs. | `docs/design/2026-09-19-dummy-store-design.md` (section 12) | [Vercel: Hobby plan](https://vercel.com/docs/plans/hobby) and [Vercel: Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines) (both updated 2026-09-14) |
| **Order and lead storage.** Planned (v0.2c): Upstash Redis on its Free plan, which allows 500K commands a month, 256 MB of data and one free database. The design also deletes records after 7 days. | A paid database plan sized to real traffic, with retention set by the store's own rules (see Orders and data). | `docs/design/2026-09-19-dummy-store-design.md` (section 12) | [Upstash: Redis pricing](https://upstash.com/pricing/redis) |
| **Server-side tracking host.** Planned (v0.4): Stape's Free plan, which allows 10,000 requests a month. A Free container that reaches the limit is disabled and stays disabled, and only a paid plan restores it. | A paid plan sized to the traffic. Stape's Pro plan starts at $17 a month for up to 500K requests. | `docs/design/2026-09-19-dummy-store-design.md` (section 11) | [Stape: pricing](https://stape.io/price) and [Stape: request limits and pause logic](https://stape.io/helpdesk/documentation/request-limits-and-pause-logic) (updated 2026-09-01) |

## Payments

| What the demo does | What a real launch needs | Where in this repo | Source |
|---|---|---|---|
| **Taking the card.** Only test cards will work. The check that decides is written and tested, and the checkout page (planned, v0.2c) runs it in the browser, so the card number never leaves the browser and nothing is charged. | A payment provider that collects card details on its own hosted page or in its own embedded fields, so that card numbers never pass through the store's server. | `src/demo/test-cards.ts`, `docs/shop-rules.md` | [Stripe: Integration security guide](https://docs.stripe.com/security/guide) |
| **Card industry rules.** None applies, because no real card data is handled. | Stripe's guide says that anyone who stores, processes or transmits card data must follow PCI DSS, and that a business accepting payments attests to this every year. A hosted integration reduces the work. Handling card numbers directly can mean more than 300 security controls and outside auditors. | `docs/design/2026-09-19-dummy-store-design.md` (section 5) | [Stripe: Integration security guide](https://docs.stripe.com/security/guide) |
| **Bank checks on the card.** None: test cards are never sent to a bank. | Strong customer authentication with 3-D Secure, where a regulation requires it. Stripe names PSD2 in the European Economic Area and similar rules in the UK, India, Japan and Australia. | Nothing yet | [Stripe: 3D Secure authentication](https://docs.stripe.com/payments/3d-secure) |
| **Approve or decline.** A declined test card (`4000 0000 0000 0002`) is refused by the same check in the browser, and no `purchase` event fires (planned, v0.2c and v0.2d). | The real answer comes from the provider, and the store's server confirms it, usually through a signed webhook, before an order counts as paid. | `src/demo/test-cards.ts` | [Stripe: Integration security guide](https://docs.stripe.com/security/guide) |
| **Refunds and disputes.** None, because nothing is really paid. | A way to refund, and a process for disputes, where a cardholder's bank reverses the payment and charges fees. | Nothing yet | [Stripe: Disputes](https://docs.stripe.com/disputes) |

## Orders and data

| What the demo does | What a real launch needs | Where in this repo | Source |
|---|---|---|---|
| **Order records.** The design keeps leads and orders for 7 days, and the proof page shows a visitor only their own. There is no admin, no order history, no stock count and no inventory system. | A durable database, an order number for every order, an admin to look up, fix and refund orders, and stock levels that fall as items sell. | `docs/design/2026-09-19-dummy-store-design.md` (sections 5 and 13) | Not verified: general practice |
| **Prices come from the server.** Planned (v0.2c): the server prices every order again from the catalog. The pricing code it will run is written and tested, and the cart holds no prices. | Keep it. A price that came from the browser must never be trusted, for the same reason that server-side checks are the ones that count: anything in the browser can be changed. | `src/engine/pricing.ts`, `src/engine/cart.ts` | [OWASP: Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) |
| **Double orders.** Not handled yet. The back end is planned (v0.2c). | Every request that creates an order or a charge carries a unique key, so that a double click or a network retry cannot create it twice. | Nothing yet | [Stripe: Idempotent requests](https://docs.stripe.com/api/idempotent_requests) |
| **How long to keep records.** Everything is deleted after 7 days. | Tax and accounting records generally have to be kept for years (in Canada, six years from the end of the last tax year they relate to), while personal information must not be kept longer than it is needed. A store decides, record type by record type, what it must keep and what it must delete. | `docs/design/2026-09-19-dummy-store-design.md` (section 5) | [Canada Revenue Agency: where to keep your records and for how long](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/keeping-records/where-keep-your-records-long-request-permission-destroy-them-early.html) (modified 2026-08-03) and [Office of the Privacy Commissioner: PIPEDA principle 5, limiting use, disclosure and retention](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_use/) (modified 2020-08-13) |
| **Backups.** None, because the data is disposable. | Regular backups of the order database, and a restore that has been tried. | Nothing yet | Not verified: general practice |

## Tax

| What the demo does | What a real launch needs | Where in this repo | Source |
|---|---|---|---|
| **Rates.** Fixed demo rates: each Canadian province, 20% for the United Kingdom, 21% for every EU country the store ships to, and 0% for the United States on purpose. | Rates looked up for the buyer's address by a tax service. EU countries do not share one rate: each member state sets its own number of rates and their levels. | `src/store/destinations.ts`, `docs/shop-rules.md` | [European Commission: VAT rates](https://taxation-customs.ec.europa.eu/taxation/vat/vat-rates_en) |
| **Canada.** Tax is added for Canadian addresses at fixed provincial rates. | A business registers for GST/HST, and starts charging it, once its taxable sales pass $30,000 in a single calendar quarter or over four consecutive quarters. | `src/store/destinations.ts` | [Canada Revenue Agency: when to register for and start charging the GST/HST](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html) (modified 2026-06-16) |
| **United States.** No tax is charged, and no US tax duty is assumed. | Since the Supreme Court's 2018 Wayfair decision, a state can require an out-of-state seller to collect its sales tax without any physical presence there. Each state sets its own threshold: for example Texas $500,000 in twelve months and Washington $100,000. A seller registers state by state. | `src/store/destinations.ts` | [Supreme Court: South Dakota v. Wayfair, Inc.](https://www.supremecourt.gov/opinions/17pdf/17-494_j4el.pdf), [Texas Comptroller: remote sellers](https://comptroller.texas.gov/taxes/sales/remote-sellers.php) and [Washington Department of Revenue: remote sellers](https://dor.wa.gov/taxes-rates/retail-sales-tax/marketplace-fairness-leveling-playing-field/remote-sellers) |
| **United Kingdom.** 20% is added at checkout. | For goods worth £135 or less sent from overseas straight to UK buyers, the seller must charge UK VAT at the point of sale, and must register for UK VAT to do so. | `src/store/destinations.ts` | [GOV.UK: VAT and overseas goods sold directly to customers in the UK](https://www.gov.uk/guidance/vat-and-overseas-goods-sold-directly-to-customers-in-the-uk) (updated 2022-05-13) |
| **Filing.** None, because no tax is really collected. | Collected tax is reported and paid on schedule in every place the store is registered, by the store or its accountant. | Nothing yet | Not verified: general practice |

## Currency

| What the demo does | What a real launch needs | Where in this repo | Source |
|---|---|---|---|
| **Rates.** Fixed demo rates from Canadian dollars: 0.73 for US dollars, 0.66 for euros and 0.56 for pounds. | Real rates that update. Central banks publish rates for information. The European Central Bank says that using its reference rates for transactions is strongly discouraged, and the Bank of Canada calls its rates indicative. A store uses its payment provider's conversion or a commercial rates source. | `src/store/currencies.ts` | [European Central Bank: euro foreign exchange reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html) and [Bank of Canada: daily exchange rates](https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates/) |
| **Who converts.** The store's own code converts every price, always from Canadian dollars. | When the charge currency differs from the currency the store is paid in, a payment provider such as Stripe converts the charge, and the shopper's card issuer may add its own foreign-exchange fee. | `src/engine/money.ts` | [Stripe: currencies and conversions](https://docs.stripe.com/currencies/conversions) |
| **Locking the rate.** The rates never change, so every step shows the same total. | With moving rates, the rate is saved on each order, so that a refund or a report uses the same amount the shopper paid. | Nothing yet | Not verified: general practice |
| **Currencies with no cents.** Every currency the demo supports has two decimal places, and the code keeps money in whole cents. | Some currencies have no minor unit, and Stripe lists the Japanese yen as one. Supporting one means changing how money is stored and shown. | `src/engine/money.ts` | [Stripe: currencies and conversions](https://docs.stripe.com/currencies/conversions) |
| **Reports.** Planned (v0.2d): events carry the currency the shopper was charged, and the GA4 properties are set to Canadian dollars. | Google Analytics converts other currencies into the property's currency using the previous day's exchange rate, so its totals may not match the store's own to the cent. | Nothing yet | [Google Analytics Help: currency reference](https://support.google.com/analytics/answer/9796179) |
| **Showing every currency's price at once.** Every product's price is computed in all four currencies when the site is built, and a small script in the browser only ever picks which one to show; the whole site is one static build. | This is cheap at six products and four currencies. A store offering many more currencies makes every price heavier, since each one still carries every currency's string, and a store with many more products, where prices or rates change often, would need to rebuild its whole site on every change. Real stores at that scale more often render the price server-side once the visitor's currency is known, or fetch it from a pricing service. | `src/engine/money.ts`, `src/components/currency-switcher.ts` | Not verified: general practice |

## Product content

Every product a shopper can look at is a flat, line-drawn illustration. This is a deliberate part of the store's look, not a stand-in for photography that never arrived, but a real store selling physical garments needs real photography, and search engines expect it too.

| What the demo does | What a real launch needs | Where in this repo | Source |
|---|---|---|---|
| **Product images.** None. Every product page shows an SVG illustration, recoloured per colour, and its schema.org Product script has no `image` property. | `image` is a required property of Google's Product structured data for merchant listings (pages a shopper can buy from, which is this project's case), alongside only `name` and `offers`; without it the markup is not eligible for Google's richer shopping results at all, not merely missing an optional enhancement. Google recommends multiple high-resolution photos in three aspect ratios: 16x9, 4x3 and 1x1. | `src/store-pages/products/[slug].astro` | [Google Search Central: how to add merchant listing structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing) (updated 2026-09-08) |
| **Zoom, multiple angles and video.** None; one fixed illustration per colour. | Shoppers buying clothing without trying it on typically expect multiple angles, a zoom view, and increasingly a short video or a 360-degree view, to stand in for what an in-store fitting room would answer. | `src/components/Garment.astro` | Not verified: general practice |

## Shipping and fulfillment

| What the demo does | What a real launch needs | Where in this repo | Source |
|---|---|---|---|
| **Prices.** Two flat methods for every destination: Standard at CAD 9, free from CAD 100 after discount, and Express at CAD 19. | Prices by weight and destination, or a live quote from a carrier at checkout. Canada Post, for example, lets merchants show its rates and delivery dates through its developer program. | `src/store/shipping-methods.ts`, `docs/shop-rules.md` | [Canada Post: show shipping rates and delivery dates](https://www.canadapost-postescanada.ca/cpc/en/business/ecommerce/enhance/display-rates-delivery-dates.page) |
| **Duties: United States.** No duty or import tax is charged to anyone. | The US has suspended duty-free treatment for goods worth $800 or less from all countries, including by international mail, so a parcel sent there can owe duties and taxes. The store decides who pays them, and tells the buyer before they pay. | `src/store/destinations.ts` | [U.S. Customs and Border Protection: e-commerce FAQs](https://www.cbp.gov/trade/basic-import-export/e-commerce/faqs) (modified 2026-09-02) |
| **Duties: European Union.** No duty or import tax is charged to anyone. | From 1 July 2026 the EU applies a temporary customs duty of €3 per item on consignments worth up to €150, until 1 July 2028. | `src/store/destinations.ts` | [European Commission: guidance on the temporary flat fee on low-value imports](https://taxation-customs.ec.europa.eu/news/guidance-and-legal-text-temporary-flat-fee-low-value-imports-which-will-apply-until-1-july-2028-2026-06-08_en) (2026-06-08) |
| **Packing, labels and tracking.** None, because nothing is packed or shipped. | Someone packs each order and buys the label, either the store itself or a fulfillment service, and the shopper gets tracking. | Nothing yet | Not verified: general practice |
| **Returns.** None. | A returns process: who pays for the return shipping, how the refund is made (see Payments) and how the stock is put back. | Nothing yet | Not verified: general practice |

## Email

| What the demo does | What a real launch needs | Where in this repo | Source |
|---|---|---|---|
| **Welcome and order emails.** Simulated: they are shown on the proof page for the visitor's own session and are never sent (planned, v0.5). | A service that sends them for real, with delivery, bounce and complaint handling. | `docs/design/2026-09-19-dummy-store-design.md` (section 12) | Not verified: general practice |
| **Sender authentication.** None, because nothing is sent. | Set up SPF or DKIM for every sending domain. Google also requires DMARC and one-click unsubscribe from bulk senders, which it defines as 5,000 or more messages a day. | Nothing yet | [Google: email sender guidelines](https://support.google.com/a/answer/81126) |
| **Marketing consent.** The lead popup's marketing checkbox is unticked, and no demo button fills it (planned, v0.2b). | In Canada, the anti-spam law requires consent before a commercial electronic message is sent. Express consent means that the person agreed verbally or in writing, and the sender must be ready to prove it. | `docs/design/2026-09-19-dummy-store-design.md` (section 5) | [Innovation, Science and Economic Development Canada: getting consent to send email](https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en/getting-consent-send-email) (modified 2019-04-01) |
| **Proving an address is the shopper's.** Planned (v0.2c): the server refuses temporary email domains and domains that cannot receive mail, but it never confirms that an address belongs to the shopper. | A confirmation email (double opt-in). It is left out of the demo on purpose, because it would email whatever a stranger types. | `src/engine/email-domain.ts` | Not verified: general practice |

## Legal and privacy

| What the demo does | What a real launch needs | Where in this repo | Source |
|---|---|---|---|
| **Privacy policy.** A draft is planned with the consent work (v0.3). | A privacy policy written for the places the store sells, and reviewed by a professional. In Quebec, Law 25 adds duties for a business: a person responsible for personal information, published privacy policies, consent asked for each purpose in simple terms, and a register of confidentiality incidents. | `docs/design/2026-09-19-dummy-store-design.md` (section 5) | [Commission d'accès à l'information du Québec: main changes (in French)](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/sujets-et-domaines-dinteret/principaux-changements-loi-25) |
| **Cookies and consent.** Planned (v0.3): every non-essential cookie is off until the visitor opts in. | The rules differ by place. In the UK, the regulator says that consent must be freely given, specific and informed, with a clear positive action, and that cookies which are only helpful or convenient still need consent. | `docs/design/2026-09-19-dummy-store-design.md` (section 5) | [Information Commissioner's Office: cookies and similar technologies](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/) |
| **Terms of sale and returns policy.** Only a notice that this is a demo. | Written terms of sale, a returns and refunds policy, and shipping terms for each place the store sells, reviewed by a professional. | `docs/design/2026-09-19-dummy-store-design.md` (section 6) | Not verified: general practice |

## Security and operations

| What the demo does | What a real launch needs | Where in this repo | Source |
|---|---|---|---|
| **Checks on what a shopper types.** The same code is written to run in the browser and on the server, so a form is checked in both places (the server side is planned, v0.2c). | Keep it. The checks on the server are the ones that count for security, because anything in the browser can be bypassed. | `src/engine/checkout-form.ts` | [OWASP: Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) |
| **Secrets.** A secret scan runs on every push and pull request, and no keys are kept in the repository. | Keep keys out of the code, give each key the fewest permissions it needs, and rotate them. | `.github/workflows/ci.yml` | Not verified: general practice |
| **Known-vulnerable dependencies.** Dependencies are locked in `package-lock.json`, and the checks install exactly those versions. | Watch for newly disclosed vulnerabilities in the dependencies. GitHub's Dependabot alerts notify the owner so that they can upgrade. | `package-lock.json`, `.github/workflows/ci.yml` | [GitHub Docs: Dependabot alerts](https://docs.github.com/en/code-security/dependabot/dependabot-alerts/about-dependabot-alerts) |
| **Logs and monitoring.** On Vercel's Hobby plan, runtime logs are kept for 1 hour and there are up to 3 custom firewall rules. Protection against denial-of-service attacks is on by default. | Logs kept long enough to investigate an incident (Vercel's Pro plan keeps 1 day and can send logs elsewhere), alerts when errors rise, and an incident plan. | `docs/design/2026-09-19-dummy-store-design.md` (section 11) | [Vercel: Hobby plan](https://vercel.com/docs/plans/hobby) (updated 2026-09-14) |

## Still to come

This page covers what exists or has been decided. The later parts of the project add their own rows when they are built, so that the page never claims something that is not built: the abuse controls on the lead and order endpoints (v0.2c), the consent banner and the privacy policy (v0.3), server-side tracking (v0.4) and what was found not to work at low volume (v0.5). A section on tracking in production comes with them.

## What this page does not cover

Step-by-step setup instructions, price comparisons between vendors, and legal, tax or financial advice.
