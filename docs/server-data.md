# What the server keeps

This page says what the store's server keeps in its database, for how long, why, and what is sent to the database to do it. It also says what is never kept. The store keeps almost nothing: a visitor's cart, currency and other choices live in their own browser, which [Browser storage and sessions](browser-storage.md) describes. The server keeps a lead, which a visitor gives by typing a name and an email into the popup, and a small counter that stops floods. Orders come later (v0.2c-4), and a log of what tracking sent comes with v0.4. Each will be added to this page when it is built.

The database is [Upstash Redis](https://upstash.com/), on its Free plan, in Washington, D.C., next to the store's functions. Redis keeps things by name: a key, and something filed under it. It has no tables and no columns. What a lead looks like is decided by the store's code, which checks it again whenever it reads one back. Every key starts with a tag that says what it is, so a key names its own kind, and every key is deleted by the database itself when its time is up. Nothing needs cleaning up, and no record can outlive the promise made about it.

The functions can only reach the database from Vercel's Preview deployments, where the two settings that name it are set. Production has neither setting, and while the store is closed every function answers 404 anyway. In Vercel the settings are marked sensitive, so their values are hidden even from the dashboard.

## What is kept

| Key | The rest of the name | What it holds | Fields | Expires | Why |
|---|---|---|---|---|---|
| `lead:<id>` | 32 random hexadecimal characters, made when the lead is kept | One lead | `firstName`, `email`, `marketing`, `source`, `createdAt` | 7 days (604800 seconds) after it is kept. The time is set once, and nothing extends it | The store's promise that a lead is deleted after 7 days. The lead is what `generate_lead` will later report, once the server has really kept it |
| `rl:<hash>` | 64 hexadecimal characters: a hash of the visitor's address and the hour, made with a secret | A number: how many times one visitor has sent the form in that hour | None: it is a plain number | 1 hour (3600 seconds) after the last try | The limit of 10 tries an hour, which stops floods and not people |

Both keys have an id, and the two are made differently. A lead's id is random and new every time. The counter's name is worked out from the visitor's address and the hour, with a secret: the same visitor in the same hour always gets the same name, which is how their tries are counted together, and a new hour gives a new name. So it names a visitor's connection for one hour, not a person. Without the secret it means nothing and cannot be turned back into an address. Someone who held the secret could only test a guess of an address against it, which is why the secret is a sensitive setting, and why the counter is deleted an hour after the last try.

What the five fields of a lead hold:

- `firstName` and `email` are what the visitor typed, as the checks cleaned them (spaces trimmed, the email in the form the checks accept).
- `marketing` is the text `true` or `false`: whether the visitor ticked the box that asks for marketing email. It starts unticked.
- `source` is `auto` if the popup opened by itself, or `manual` if the visitor opened it, from the footer link or the corner tab.
- `createdAt` is the time it was kept, as an ISO 8601 date and time in UTC, so it reads plainly in the database's own viewer.

Every value is kept as text, and nothing is converted on the way in or out. (With conversion on, a first name of `1234` came back as the number 1234, which is why it is off.)

## What is sent to the database

These are all the commands the store's code sends, and they are sent by one file, `src/server/upstash-store.ts`. A test runs that file and fails if it sends a command that is not listed here.

| Command | Sent when | Why |
|---|---|---|
| `MULTI` and `EXEC` | Around each pair of commands below | They make the two commands one transaction, so a lead can never be kept without its expiry, and a counter never without its |
| `INCR` | A visitor sends the form, once the name and email have passed the checks | Adds one to that visitor's counter for the hour |
| `EXPIRE` | Together with `INCR` (3600 seconds), and together with `HSET` (604800 seconds) | Sets the time after which the database deletes the key |
| `HSET` | A lead has passed every check and is being kept | Writes the five fields of the lead under its key |
| `HGETALL` | Only in tests and in `npm run smoke:lead`. The site itself never reads a lead back | Reads a lead's fields, to prove it was kept as written |

A try that fails the name and email checks, or that fills the hidden trap field, sends nothing to the database at all.

## What is never kept

- The visitor's address on the network. It is used to tell one visitor from another for the rate limit, in the moment of the request, and only as an input to the hash in the counter's name. The hash is made with a secret, so it cannot be turned back into an address, only checked against a guess by someone who holds the secret, and the address is never written anywhere else.
- Their browser or device details, their country, cookies, or anything about their cart or the pages they looked at.
- Anything the visitor did not type into the popup. A lead holds the five fields above and nothing more, and a test says so.
- Card numbers. There is no real payment in this store, and a card number never leaves the browser.
- Anything in a log. When the database cannot be used, the store logs only the kind of fault, never a name, an email or the fault's own message.

## When something goes wrong

If the database cannot be reached, or does not answer within three seconds, the function answers that it could not save, with status 503. That answer carries no welcome code and no `saved` field, so a visitor is never told a lead was kept when it was not.

If the two settings that name the database are missing, the function refuses in the same way. It never falls back to keeping leads somewhere that would lose them. Only the local server, and only when it is asked to, keeps leads in memory, and that is refused on Vercel.

## Where the settings live

| Setting | What it is |
|---|---|
| `KV_REST_API_URL` | The database's address. |
| `KV_REST_API_TOKEN` | The key that allows using the database. It is also the secret that makes the hash of a visitor's address, so no other setting is needed. |
| `SECOND_IMPRESSION_MEMORY_STORE` | Asks the local server to keep leads in memory when there is no database. It is only honoured when it is exactly `true` and the function is not running on Vercel. |

The first two are given to Preview deployments by the Vercel and Upstash connection, and to nothing else. To try the real database from your own machine, put them in a git-ignored file called `.env.local` and run `npm run smoke:lead`, which prints results and never a setting.

## How to look at it yourself

In the Vercel dashboard, open the project's storage, choose the database and use "Open in Upstash". Upstash's console has a Data Browser that shows what is kept. How many seconds a key has left is what the Redis command `TTL` gives: about 604800 right after a lead is kept, about 3600 for a counter, and `-2` when the key is already gone. Whether the console shows that time, or has a place to type a command, is for you to check when you first open it. Treat what you see as personal data: the demo people use `example.com` addresses, but anything a visitor types is kept as typed until it expires.

## Copies and backups

The seven-day promise is about what the store's code keeps and deletes. Two things Upstash says about copies (neither page shows a date, and both were read on 2026-09-25):

- Backups are not created automatically unless someone turns them on, and a scheduled backup is kept for 1 or 3 days ([Upstash: Backup/Restore](https://upstash.com/docs/redis/features/backup)). This store does not turn them on.
- A Free plan database that has been unused for at least 30 days is archived, and a backup is taken so that its data can be restored ([Upstash: FAQ](https://upstash.com/docs/redis/help/faq)). Every lead in a database that quiet has already expired after 7 days, so the backup should hold no lead. Restoring an archived database is done in Upstash's console, and until it is restored the lead function answers 503.

Not verified: how Upstash treats a key that has expired but was still in memory when a backup is taken. A real store would read Upstash's terms and data-processing agreement, and say in its privacy policy where the data is held and for how long.

## What this page does not cover yet

Orders and their token (v0.2c-4), and tracking receipts (v0.4). Their keys, fields and expiry will be added to the tables above when they are built, and the test that keeps this page in step with the code will require it.
