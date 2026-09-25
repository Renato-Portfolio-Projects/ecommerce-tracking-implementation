# Browser storage and sessions

This page says what the store keeps in a visitor's browser, for how long, and when each thing comes into play. It also says what "session" means, because this project uses the word for three different things. It describes what the code does today. Anything not built yet is marked as planned.

## The kinds of storage

| Kind | How long it lasts | Shared between tabs | Sent to the server | In this store today |
|---|---|---|---|---|
| `localStorage` | No expiry. It stays until the visitor clears it or the store's code removes it. In a private window it is cleared when the last private tab is closed | Yes, by every tab of the same site | Never | The cart, the chosen currency and the lead popup's note |
| `sessionStorage` | For the life of one tab. It survives a reload and is cleared when the tab is closed | No, each tab has its own. A page opened from another page can start with a copy of the opener's, and the two are separate after that | Never | The demo person, and which list a product was picked from |
| Cookies | Set by whoever writes them: until the browser session ends, or until a date | Yes | Yes, with requests to the site that set them | None. The store's own code sets no cookies. Google's tags will set their own from v0.2d if the visitor agrees (v0.3). Google lists its `_ga` cookie as lasting 2 years |
| A variable in the page | Until the page is left | No | Never | What each script falls back on when the browser will not keep something |
| Records on the server | 7 days, then the database deletes them itself | Not held in the browser | Not applicable | Planned (v0.2c): leads and orders |

## What this store keeps, exactly

| Key | Kind | What it holds | How long | If the browser will not keep it |
|---|---|---|---|---|
| `second-impression:cart` | `localStorage` | Each line's SKU, colour, size, quantity and the list it was picked from, and the time it was saved. No prices and no personal data | 7 days from the last change, then it counts as an empty cart | The cart works on the page it was made on and is empty on the next page |
| `second-impression:currency` | `localStorage` | The code of the currency the visitor chose | Until the visitor clears it | The choice holds for that page only, and the next page starts in Canadian dollars |
| `second-impression:lead-popup` | `localStorage` | When the lead popup was last shown, and whether it ended closed or with the code taken. No name and no email | Until it is written over. The popup's 7 days of quiet are counted from the time in it | It is remembered for that page only, so the popup can open again on the next page load |
| `second-impression:persona` | `sessionStorage` | The id of the demo person, such as `maya` | Until the tab is closed | The person holds for that page only |
| `second-impression:list-handoff:<sku>` | `sessionStorage` | Which list a product card was clicked from: its id, its name and its position | From the click until the product page reads it, which removes it | The product page has no list to report |

Nothing a visitor types is kept in the browser. The lead form's fields are never saved, and a half-typed form lives only in the open page. The one record made from what a visitor types is the lead, which the server will hold for 7 days from v0.2c.

## When each thing comes into play

| What the visitor does | What happens to what is stored |
|---|---|
| Arrives for the first time | Nothing is stored yet. On the home page the lead popup opens after 5 seconds and writes its note the moment it is shown |
| Chooses a currency | It is saved, and every page loaded from then on starts in it |
| Clicks a product card | The card writes the list hand-off and the product page reads it once and deletes it. A reload of the product page, a bookmark and a shared link have no list |
| Adds to the cart | The cart is saved. Other open tabs of the store redraw their cart at once, because the browser tells them the saved cart changed. It does not tell the tab that made the change, which already knows |
| Uses "Use demo data" | The demo person is saved for this tab, and every demo button in the tab uses the same person |
| Reloads the page | Everything stays except the list hand-off, which was read once |
| Opens the store in a second tab | It sees the same cart, currency and popup note, because `localStorage` is shared. It starts with no demo person, because `sessionStorage` belongs to one tab |
| Closes the tab | The demo person and any unread list hand-off are gone. The cart, the currency and the popup note stay |
| Comes back another day | Everything in `localStorage` is still there. After 7 days from the last change the cart counts as empty, and after 7 days from the last showing the popup may open by itself again |
| Uses a private window | It all works, but `localStorage` is cleared when the last private tab is closed, so the next visit is a first visit |
| Uses another browser or another device | Nothing follows them, because there are no accounts. A real store keeps carts on its server for this, which is covered under "Where the cart lives" in [Taking this to production](production-guide.md) |

## When the browser will not keep anything

Browsers have settings that turn storage off. When one is on, a script that reads or writes storage gets an error, and a browser whose storage is full gives a different error. This is rare among shoppers. It is normal for automated visitors: Google's rendering service does not keep local or session storage from one page load to the next.

Every read and write in the store's code is guarded, so a refusal cannot stop a page from working, and each script keeps what it needs in memory for as long as the page is open. A whole shopping trip was driven in a real Chrome with both kinds of storage blocked: there were no script errors, the item went into the cart and the drawer showed it, and the currency changed. On the next page the cart was empty and the prices were back in Canadian dollars, which is what "for that page only" means in the table above.

## Three meanings of "session"

| Meaning | What it is | Where it lives | In this store |
|---|---|---|---|
| Browser session | The life of one tab. This is what `sessionStorage` means: it lasts as long as the tab or the browser is open and survives reloads | In the browser | The demo person and the list hand-off use it |
| Analytics session | Google Analytics' grouping of a visitor's activity: a period of time during which a user interacts with the site, which by default ends after 30 minutes of inactivity | Worked out by Google from the events it receives. The store keeps nothing for it | Planned (v0.2d). The store will send the events, and Google decides where a session begins and ends |
| Demo session | The design's word for one visitor's own records on the tracking inspector (`/proof`): the leads and orders they made, found again with a random token, with no login and no IP address | On the server for 7 days, found again with the token | Planned (v0.2c and later). The design does not yet say where the browser keeps the token |

There is no login session, because there are no accounts.

## Keeping this page true

A test reads the code and this page. Every storage key in the code must be in the second table, with the right kind, and the store's own code must not set a cookie. When a later phase adds a key or a cookie, that test fails until this page says so.

## Sources

Checked on 2026-09-25.

- [MDN: Window.localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) (modified 2026-07-28)
- [MDN: Window.sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage) (modified 2025-11-30)
- [MDN: Window storage event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event) (modified 2026-08-21)
- [MDN: Using the Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API) (modified 2026-05-26)
- [MDN: Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies) (modified 2026-09-17)
- [Google Search Central: Fix Search-related JavaScript problems](https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript) (updated 2025-12-18)
- [Google Analytics Help: About Analytics sessions](https://support.google.com/analytics/answer/9191807?hl=en) (no date shown on the page)
- [Google: Advertising and measurement cookies](https://business.safety.google/adscookies/) (no date shown on the page)
