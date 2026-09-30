# What the server functions answer

This page says what each of the store's server functions answers, and what the popup does with each answer. It also says which parts of an answer come from a universal standard and which parts this store decided. The functions are plain web addresses under `/api`. Every answer has two parts: a status number, which is standard, and a small body written as JSON, which is this store's own. What the functions keep in their database is on [What the server keeps](server-data.md).

## The numbers, and who decided what

A status number is the same in every browser, server and tool, because the [HTTP standard](https://www.rfc-editor.org/rfc/rfc9110.html) (RFC 9110, June 2022) gives it a name and a meaning, and the [IANA registry](https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml) (last updated 2025-09-15) lists every number that is allowed. The first digit says who was at fault: 2 means it worked, 4 means the request was at fault, and 5 means the server was at fault. The standard gives 429 in a separate document, [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) (April 2012). All three pages were read on 2026-09-25.

| Number | The standard's name | Defined in | What this store uses it for |
|---|---|---|---|
| 200 | OK | RFC 9110, section 15.3.1 | The request worked. Also, on purpose, what a robot that fills the hidden trap field is told (see "What is ours") |
| 400 | Bad Request | RFC 9110, section 15.5.1 | The lead's name or email has a problem, or the request was not a small JSON object |
| 404 | Not Found | RFC 9110, section 15.5.5 | The store is closed, so the function answers nothing else. `/api/order` also uses it for a token that names no order |
| 405 | Method Not Allowed | RFC 9110, section 15.5.6 | The function was asked in a way it does not accept. The standard requires the answer to say which ways it does, in an `Allow` header |
| 429 | Too Many Requests | RFC 6585, section 4 | One visitor has sent the lead form more than the hourly limit. The standard allows a `Retry-After` header to say how long to wait, and the function sends one |
| 500 | Internal Server Error | RFC 9110, section 15.6.1 | Something failed that the function did not expect |
| 503 | Service Unavailable | RFC 9110, section 15.6.4 | The lead could not be kept, because the database could not be reached or refused |

## Rules every function follows

These are written once, in `src/server/http.ts`, so that no function can forget one. A test runs every function and checks each of them.

- While the store is closed, which is always the case in production for now, the function answers 404 and nothing else, whatever it was asked.
- A function accepts only the ways of asking that it names, and answers 405, with an `Allow` header, to any other.
- A fault gives a plain 500 that says nothing about its cause. The log records only the kind of fault, never its message, since a message can carry what a visitor typed.
- Every answer carries `Cache-Control: no-store`, so that a cache shared between visitors never keeps one visitor's answer for the next.
- Every body is JSON, sent as `application/json; charset=utf-8`.

The answers to a closed store, a wrong method and a fault are the same for every function:

| Number | When | Body |
|---|---|---|
| 404 | The store is closed | `{ "error": "not found" }` |
| 405 | The method is not one the function accepts | `{ "error": "method not allowed" }` |
| 500 | The function failed | `{ "error": "something went wrong" }` |

## /api/currency

Asked with GET. It tells the browser which currency to start in, worked out from the country that Vercel says the connection comes from. The country is used and dropped: it is never sent back and never kept. Its own answers:

| Number | When | Body |
|---|---|---|
| 200 | Always, once the store is open. `currency` is one of `CAD`, `USD`, `EUR` or `GBP`. Canada gives CAD, the United Kingdom GBP, the euro-area countries EUR, and everyone else, and a missing or unrecognisable country, USD | `{ "currency": "..." }` |

## /api/lead

Asked with POST. The popup sends a JSON body with these five fields, and nothing else:

| Field | What it holds |
|---|---|
| `firstName` | What the visitor typed, as the checks in the browser cleaned it |
| `email` | The same |
| `marketing` | `true` if the visitor ticked the box that asks for marketing email, otherwise `false` |
| `source` | `auto` if the popup opened by itself, `manual` if the visitor opened it |
| `website` | The hidden trap field. It is empty for every person, and its name is set once for both sides in `src/store/policy.ts` |

The function checks them again, whatever the browser did, and answers:

| Number | When | Body | The popup |
|---|---|---|---|
| 200 | The lead passed every check and was kept | `{ "ok": true, "saved": true, "code": "..." }` | Shows the code, and announces the lead |
| 200 | The trap field was filled. Nothing is kept | `{ "ok": true, "saved": false, "code": "..." }` | Shows the code, and announces nothing |
| 400 | The name or the email has a problem: the same checks as in the browser, then the email's domain (a temporary domain, or one that cannot receive mail) | `{ "ok": false, "problems": [ { "field": "email", "message": "..." } ] }` | Shows each problem under its field |
| 400 | The body was not a JSON object of at most 8 KB | `{ "ok": false, "error": "bad request" }` | Says the save failed |
| 429 | This visitor has sent the form more than the hourly limit. `Retry-After` says how many seconds until the hour ends | `{ "ok": false, "error": "too many attempts" }` | Says too many tries |
| 503 | The database could not be reached, or refused | `{ "ok": false, "error": "could not save" }` | Says the save failed |

In a body, `"..."` stands for any text: a code is the store's welcome code, and a message is the plain words the checks give, which `docs/shop-rules.md` lists. A 404, a 405 and a 500 are the ones above, and the popup says the save failed for each.

## /api/order

Asked with POST to place an order, or GET with a token to read one back for the thank-you page.

Placing an order sends the raw cart, the coupon typed if any, the shipping method, the shopper's own contact and address, a summary of the accepted card (brand and last four digits only: the card number, its expiry and its security code never reach this function, the same way they never reach any server for a real hosted payment integration), and one idempotency key that makes retrying the same attempt safe. The function checks the contact and the address again, checks the payment summary's shape, and prices the whole order again from the raw cart, never trusting a total the browser might send. Its answers:

| Number | When | Body |
|---|---|---|
| 200 | The order passed every check and was kept, or this is a repeat of an attempt already placed, answered the same way without placing a second order | `{ "ok": true, "orderNumber": "...", "token": "..." }` |
| 400 | The contact or the address has a problem: the same checks as in the browser | `{ "ok": false, "problems": [ { "field": "email", "message": "..." } ] }` |
| 400 | The cart itself does not check out once priced again: an unknown product, colour, size or quantity, a sold-out item, an unknown currency or an unknown shipping method | `{ "ok": false, "problems": [ { "code": "unknown_currency", "message": "..." } ] }` |
| 400 | The body was not a small JSON object of at most 16 KB, the idempotency key was missing or not a short piece of text, or the payment summary was not a shape the store's own checks produce | `{ "ok": false, "error": "bad request" }` |
| 429 | This visitor has placed more orders than the hourly limit. `Retry-After` says how many seconds until the hour ends. This is its own counter, apart from the lead form's | `{ "ok": false, "error": "too many attempts" }` |
| 503 | The database could not be reached, or refused | `{ "ok": false, "error": "could not save" }` |

Reading an order back sends only the token, in the query string (`/api/order?token=...`). Its answers:

| Number | When | Body |
|---|---|---|
| 200 | The token names an order that is still kept | `{ "ok": true, "orderNumber": "...", "order": { ... }, "contact": { ... }, "address": { ... }, "payment": { ... } }` |
| 404 | The token is missing from the request, names no order, or names one that has expired. All three, and a closed store, are answered exactly the same way, since there is nothing a stranger could learn from telling them apart | `{ "error": "not found" }` |
| 503 | The database could not be reached, or refused | `{ "ok": false, "error": "could not save" }` |

In a body, `"..."` stands for any text, and `{ ... }` stands for the shape `src/server/store.ts` gives `OrderRecord`'s own fields: the order is `priceOrder`'s own result (the items, the totals, the shipping method, the coupon), the contact is an email and an optional phone, the address is the full shipping address, and the payment is a brand and last four digits. A 404 (a closed store), a 405 and a 500 are the ones every function gives, listed above.

## How the popup reads each answer

The popup reads only what it needs, in `src/components/submit-lead.ts`, and turns every answer into one of four results. It waits six seconds at most. An answer it cannot trust is never treated as a success, so a code is only ever shown for a lead the server says it took.

| Number | The body | The popup's result | What the visitor sees |
|---|---|---|---|
| 200 | `ok` is true, `saved` is true or false, and `code` is a short text | accepted | The code. If `saved` is true, the lead is also announced for tracking |
| 200 | Anything else | failed | The message `popup.saveFailed`, and no code |
| 400 | A list of problems, at least one of which names `firstName` or `email` and has a message a person can read | problems | The problems, each under its field. Any problem that names another field is dropped |
| 400 | Anything else | failed | The message `popup.saveFailed`, and no code |
| 429 | Not read | too-many-tries | The message `popup.tooManyTries`, and no code |
| Any other | Not read. This includes no answer in six seconds and no connection at all | failed | The message `popup.saveFailed`, and no code |

The two messages are worded on [the site words page](site-words.md).

## What is this store's own choice

These are decisions, not the standard, and another store could make them differently.

| Decision | What this store does | What another store might do |
|---|---|---|
| The number for a problem with a field | 400 | 422, "Unprocessable Content" (RFC 9110, section 15.5.21): the request was understood, but what it says is not acceptable. Both are allowed |
| What a filled trap field is told | 200, as if the lead had been kept, with `saved: false`. The standard reading of 200 is "it worked", so this is a deliberate untruth, told so that a robot cannot tell it was caught | Refuse it with an error number, which is honest but tells the robot it was caught |
| The shape of a body | `ok`, `saved`, `code`, `error` and a `problems` list of `field` and `message`. Only this store's function and popup know what they mean | A published format for errors, such as [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html), "Problem Details for HTTP APIs" (July 2023, read on 2026-09-25) |
| A number the popup does not know | Treated as a failed save | The same, or a different message for a failure the visitor can fix |
| A try that timed out | The popup gives up after six seconds and says the save failed. The server may still have kept the lead, so trying again keeps a second copy, which expires like any other. `/api/order` does not have this problem: it takes an idempotency key, made once and reused for every retry of the same attempt, so a repeat is answered without placing a second order | An idempotency key for the lead form too |

Not verified: what Vercel itself answers before a request reaches these functions, for example the sign-in page of a protected Preview. The popup treats any number it does not know as a failed save, so it is safe either way, but this page does not list them.

## What this page does not cover yet

Orders and their token (v0.2c-4) and tracking receipts (v0.4). Their answers will be added when they are built, and the test that keeps this page in step with the code will require it.
