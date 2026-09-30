# Word blanks, and how words reach a script

This page is about two small, related mechanics in the browser-side code: the `{blank}` syntax a word can hold, and the way a page hands a script only the words it needs rather than the whole file. Neither is shopper-facing; this page is for reading the code, not for reviewing wording, which is [Site words](site-words.md).

## Filling in a blank

A word in `src/store/words.ts` can hold a name in braces, like `{firstName}`. `fill()` (`src/engine/fill.ts`) replaces every blank with a value from an object passed alongside it:

```ts
fill('Thank you, {firstName}.', { firstName: 'Priya' });
// 'Thank you, Priya.'
```

It is strict in both directions: it throws if a blank in the text has no matching value, and it throws if a value is given that no blank in the text uses. A typo on either side, in the wording or in the code that fills it, fails at once, in a test, rather than leaving `{firstName}` printed literally on a live page or silently dropping a value nobody asked for.

## Handing a script only the words it needs

Most scripts do not import `src/store/words.ts` directly: the whole file is every word on every page, and Astro would bundle it into whatever page imports it (see the script-budget note in `docs/brand.md`). Instead, the Astro page picks out only the few words, blanks and all, that a script actually needs, writes them as one JSON object into a `data-words` attribute on an element already on the page, and the script reads that attribute and parses it once the page has loaded.

The shape is always the same on both sides:

```astro
---
const words = { firstName: WORDS['some.word'] /* ... */ };
---
<section data-something data-words={JSON.stringify(words)}>...</section>
```

```ts
const wordsOf = () => JSON.parse(document.querySelector('[data-something]')!.dataset.words ?? '{}');
```

## Where this is used today

| Astro file | Element | Words carried | Read by |
|---|---|---|---|
| `CartPanel.astro` | `[data-cart-panel]` | The cart's own sentences with blanks: a limit reached, a dropped line, the free-shipping bar, aria labels, a sale price | `cart-ui.ts` |
| `Header.astro` | `[data-cart-link]` | The cart count in the header ("Cart" / "Cart (3)") | `cart-ui.ts` |
| `LeadPopup.astro` | `[data-lead-popup]` | The popup's own messages: filled with demo data, saved, could not load, could not save, too many tries, and the welcome percentage | `lead-popup-ui.ts`, `lead-popup-form.ts` |
| `checkout.astro` | `[data-checkout-review]` | The order review's own words: free shipping, the three coupon outcomes, the order-failed message | `checkout-review.ts` |
| `checkout.astro` | `[data-checkout-announce]` | The demo-filled announcement, and the payment step's own summary wording | `checkout-steps.ts` |
| `thank-you.astro` | `[data-thank-you-order]` | The confirmed order's body sentence, free shipping, and the payment summary wording | `thank-you.ts` |

A test reads the code and fails if a file starts doing this, or stops, without this page saying so.

## Two worked examples

`thankYou.body`'s two blanks, `{orderNumber}` and `{firstName}`, are filled from the same `fetch` and the same `fill()` call ([thank-you.ts](../src/components/thank-you.ts)), but the two values reach it by different routes: one is invented by the server, the other is typed by the shopper. Both are worth tracing, because the second is the more common case: almost everything else `/thank-you` shows (the address, the contact details, the payment summary) is typed, not invented.

### A value the server invents: the order number

1. Is made once, on the server, the moment an order is accepted (`src/server/order-number.ts`).
2. Is saved as a field of the order record kept in the database (`src/server/order.ts`, `src/server/upstash-store.ts`; see [What the server keeps](server-data.md)).
3. Is read back out of that record and sent in the answer to `GET /api/order` (`readOrder` in `src/server/order.ts`).
4. Is parsed out of that answer, in the browser, by `src/components/thank-you.ts`.
5. Is passed to `fill()` as the value for `thankYou.body`'s `{orderNumber}` blank, and the result is written into the page.

Nothing in that chain regenerates the number: the same string, created once, is stored, fetched and displayed. The one thing kept deliberately apart from it is the token that gates `/thank-you` in the first place: a shopper is shown the order number, never the token, so the value they might read aloud or paste somewhere is never also the value that grants access to their order.

### A value the shopper types: the first name

1. Is typed into an `<input>` on the checkout page's own "Shipping address" step, and sits in that element's `.value` the way any web form holds what is typed into it.
2. Is read off that `.value` the moment the step's form is submitted (`readFields` in `src/components/checkout-steps.ts`) and checked by `checkAddress` (`src/engine/checkout-form.ts`).
3. Is read again, the same raw way, by `checkout-review.ts`'s `addressFields()` when "Place order" is pressed, and sent to `/api/order` in the request body. The browser's own check is never trusted alone: the server runs `checkAddress` again on whatever arrives, since a request can be sent by hand and skip the browser entirely.
4. Is saved as a field of the same order record the order number sits on.
5. At this point the checkout page is gone. The shopper has navigated to `/thank-you`, a separate page load with nothing left of the original form: no memory, no open tab holding that `<input>` any more.
6. `/thank-you` asks the server for the record fresh, with the same `GET /api/order` the order number comes back on, and gets a newly built JSON object back: the server's saved copy, not a live link to the form that no longer exists.
7. Is passed to `fill()` as the value for `{firstName}`, alongside the order number, in the same call.

The point worth holding onto: a value typed into a form is never carried in the browser from one page to the next. Every later page that shows it again, `/thank-you` included, asks the server for its own saved copy of it.
