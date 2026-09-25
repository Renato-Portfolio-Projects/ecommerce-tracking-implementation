# Site words

Every word a shopper can read on the store's own pages, and every message the store shows, in one place. It is here so that the words can be read and changed before any page is built.

The voice is in `docs/brand.md`: plain and short, honest that it is a demo, and none of the words it says to avoid. The messages about a field that was filled in wrongly, and about the payment form, are in `docs/shop-rules.md` and are not repeated here.

## How to read this page

- Each table lists a key, the wording, and where the wording appears. The key is how the code finds the wording.
- A word in braces, like `{product}`, is filled in by the page. The table "Blanks filled from the code" shows the ones that come from the store's data, and the others are the shopper's own choices, such as the name of the product in the cart.
- A test compares this page with `src/store/words.ts`, so the two cannot drift apart.

## Everywhere

The demo bar, the header and the footer appear on every store page.

| Key | Wording | Where it appears |
|---|---|---|
| `site.name` | Second Impression | The wordmark in the header and footer, and in every page title |
| `site.tagline` | Worth a second look. | The footer, and the placeholder page |
| `site.openingSoon` | Opening soon | The placeholder page, before the store opens |
| `site.description` | Second Impression is a fictional clothing store, built to demonstrate production-style tracking. | The description search engines and link previews would show for the home page |
| `demo.bar` | Portfolio demo store: fictional products, no real payments. | The slim dark bar above the header, on every page |
| `demo.link` | How it's tracked → | The link at the end of the demo bar. It goes to the project on GitHub until the case study exists |
| `nav.skip` | Skip to content | A link that appears when a keyboard user presses Tab on a new page, before anything else |
| `nav.label` | Main | Read out by screen readers as the name of the main navigation |
| `nav.tees` | Tees | Header link to the Tees section of the home page |
| `nav.pants` | Pants | Header link to the Pants section of the home page |
| `nav.about` | About | Header link to the About page |
| `header.currency` | Currency | Read out as the name of the currency selector in the header |
| `header.cart` | Cart | The cart button in the header when the cart is empty |
| `header.cartCount` | Cart ({count}) | The cart button once it holds items. The blank is the number of items |
| `header.cartLabelOne` | Cart, 1 item | Read out for the cart button when it holds one item |
| `header.cartLabelMany` | Cart, {count} items | Read out for the cart button when it holds more than one item |
| `footer.demoHeading` | About this demo | Footer column heading |
| `footer.github` | The project on GitHub | Footer link, and the "Read more" list on the About page |
| `footer.guide` | Taking this to production | Footer link, and the "Read more" list on the About page. It goes to the production guide |
| `footer.helpHeading` | Help | Footer column heading |
| `footer.shipping` | Shipping | Footer link to the shipping page |
| `footer.returns` | Returns | Footer link to the returns page |
| `footer.terms` | Terms | Footer link to the terms page |
| `footer.contact` | Contact | Footer link to the contact page |
| `footer.small` | Second Impression is a fictional store made for a portfolio. Nothing here can be bought. | The last line of the footer |

## Home page

Built in the second part of this work. The hero banner is the promotion the tracking plan counts.

| Key | Wording | Where it appears |
|---|---|---|
| `home.eyebrow` | New in | Small label above the hero headline |
| `home.heroTitle` | One print. One slightly off. | The hero headline |
| `home.heroBody` | Plain tees and honest chinos, printed the way a second look should be: a little out of register, on purpose. | The hero text under the headline |
| `home.heroButton` | Shop the tees | The hero button. It scrolls to the Tees section |
| `home.heroAlt` | Logo Tee in paper, with a two-circle mark on the chest | The description of the hero drawing, read out by screen readers |
| `home.styles` | {count} styles | Small label at the end of each section heading. The blank is the number of products |
| `home.stripLabel` | About the name | Small label above the brand strip, near the bottom of the home page |
| `home.stripText` | A second impression is a second pass of ink, laid a little off the first. | The brand strip text |

## Product pages

Built in the second part of this work. The colour and size labels sit above the pickers.

| Key | Wording | Where it appears |
|---|---|---|
| `product.colour` | Colour | Label above the colour picker |
| `product.size` | Size | Label above the size picker |
| `product.quantity` | Quantity | Label above the quantity box |
| `product.add` | Add to cart | The main button on a product page |
| `product.chooseSize` | Choose a size. | Shown when the shopper presses Add to cart before choosing a size |
| `product.soldOut` | Sold out | Written on a size that is sold out in the chosen colour. The size stays visible and cannot be chosen |
| `product.sizeSoldOut` | {size} is sold out in {colour}. | Read out for a sold-out size. The blanks are the size and the colour |
| `product.sale` | Sale | A small badge next to the name of a product that is on sale |
| `product.was` | was {price} | The old price shown crossed out beside a sale price |
| `product.freeShipping` | Free standard shipping on orders over {freeFrom}. | A line under the Add to cart button. The blank is the free-shipping threshold |
| `product.details` | Details | Heading above a product's three detail lines |
| `product.added` | Added {product} ({variant}) to your cart. | Read out to screen readers after Add to cart. The blanks are the name and the colour and size |
| `product.back` | Back to {collection} | A link at the top of a product page. The blank is Tees or Pants |

## The six products

The text on each product page under its name. The colours, sizes and prices come from the catalog.

| Key | Wording | Where it appears |
|---|---|---|
| `product.SI-TEE-001.blurb` | The one you wear until it is soft. A straight, midweight tee that sits under everything. | Plain Tee, the paragraph under the name |
| `product.SI-TEE-001.detail1` | Midweight cotton jersey. | Plain Tee, first detail |
| `product.SI-TEE-001.detail2` | Regular fit, true to size. | Plain Tee, second detail |
| `product.SI-TEE-001.detail3` | Machine wash cold, tumble dry low. | Plain Tee, third detail |
| `product.SI-TEE-002.blurb` | Our two-circle mark on the chest, printed twice: once in red, once in blue, a little off. That is the second impression. | Logo Tee, the paragraph under the name |
| `product.SI-TEE-002.detail1` | Midweight cotton jersey, screen printed. | Logo Tee, first detail |
| `product.SI-TEE-002.detail2` | Regular fit, true to size. | Logo Tee, second detail |
| `product.SI-TEE-002.detail3` | Machine wash cold, inside out. | Logo Tee, third detail |
| `product.SI-TEE-003.blurb` | The same tee, and this time the print landed well off register. Every one is a first draft, so it is priced down. | Misprint Tee, the paragraph under the name |
| `product.SI-TEE-003.detail1` | Midweight cotton jersey, screen printed. | Misprint Tee, first detail |
| `product.SI-TEE-003.detail2` | Regular fit, true to size. | Misprint Tee, second detail |
| `product.SI-TEE-003.detail3` | The off-register print is intentional and is not a fault. | Misprint Tee, third detail |
| `product.SI-PNT-001.blurb` | A straight, mid-rise chino in cotton twill. Two pockets in front, two behind, and nothing else. | Plain Chino, the paragraph under the name |
| `product.SI-PNT-001.detail1` | Cotton twill. | Plain Chino, first detail |
| `product.SI-PNT-001.detail2` | Straight leg, mid rise. | Plain Chino, second detail |
| `product.SI-PNT-001.detail3` | Machine wash cold, hang to dry. | Plain Chino, third detail |
| `product.SI-PNT-002.blurb` | Cut wider through the leg, in the same twill. Room to move, priced down for the season. | Relaxed Chino, the paragraph under the name |
| `product.SI-PNT-002.detail1` | Cotton twill. | Relaxed Chino, first detail |
| `product.SI-PNT-002.detail2` | Relaxed leg, mid rise. | Relaxed Chino, second detail |
| `product.SI-PNT-002.detail3` | Machine wash cold, hang to dry. | Relaxed Chino, third detail |
| `product.SI-PNT-003.blurb` | Double pleats at the waist and a tapered leg. The dressed-up one. | Pleated Chino, the paragraph under the name |
| `product.SI-PNT-003.detail1` | Cotton twill. | Pleated Chino, first detail |
| `product.SI-PNT-003.detail2` | Pleated front, tapered leg. | Pleated Chino, second detail |
| `product.SI-PNT-003.detail3` | Machine wash cold, hang to dry. | Pleated Chino, third detail |

## Pictures

The drawings of the clothes are described in words, for people who cannot see them. The blanks are the product's name and its colour.

| Key | Wording | Where it appears |
|---|---|---|
| `garment.alt` | {product} in {colour} | The description of a product's drawing, read out by screen readers |
| `garment.altLogo` | {product} in {colour}, with a two-circle mark on the chest | The description of a drawing that carries the two-circle mark |
| `garment.altMisprint` | {product} in {colour}, with a two-circle mark printed well off register | The description of a drawing whose mark is printed well off register |

## Cart

Built in the third part of this work. The drawer and the cart page share these words.

| Key | Wording | Where it appears |
|---|---|---|
| `cart.title` | Your cart | The heading of the cart drawer and the cart page |
| `cart.close` | Close cart | The close button on the cart drawer |
| `cart.empty` | Your cart is empty. | Shown when the cart has no items |
| `cart.keepShopping` | Keep shopping | Under the empty-cart message (on the drawer it is a button that closes the drawer, and on the cart page a link to the home page), and, on the cart page only, a link to the home page under the Checkout button when the cart has items |
| `cart.remove` | Remove | The button that takes a line out of the cart |
| `cart.removeLabel` | Remove {product} ({variant}) from your cart | Read out for a Remove button. The blanks are the name and the colour and size |
| `cart.decrease` | Decrease quantity of {product} ({variant}) | Read out for the minus button on a line |
| `cart.increase` | Increase quantity of {product} ({variant}) | Read out for the plus button on a line |
| `cart.quantity` | Quantity | Label for the quantity on a line |
| `cart.subtotal` | Subtotal | The total of the items, before shipping and tax |
| `cart.laterNote` | Shipping and tax are added at checkout. | A line under the subtotal |
| `cart.checkout` | Checkout | The button under the subtotal. The checkout page arrives in a later part of the project |
| `cart.viewCart` | View cart | A link under the Checkout button on the cart drawer, to the cart page. The cart page does not have it, since it is the cart page |
| `cart.freeAway` | You are {amount} away from free standard shipping. | The progress bar message while the items come to less than the threshold |
| `cart.freeReached` | You have free standard shipping. | The progress bar message once the items reach the threshold |
| `cart.limitReached` | You can have up to {max} of one item, so we stopped at {max}. | Shown when a shopper asks for more than the limit of one item |
| `cart.droppedOne` | One item in your cart is no longer available, so we removed it. | Shown when a saved cart is reopened and one line is no longer valid |
| `cart.droppedMany` | {count} items in your cart are no longer available, so we removed them. | Shown when a saved cart is reopened and several lines are no longer valid |
| `cart.saved` | Your cart is saved on this device for {days} days. | A small line at the bottom of the cart |

## Discount code

Used at checkout, which arrives in a later part of the project. The three results match the three outcomes the tracking plan records.

| Key | Wording | Where it appears |
|---|---|---|
| `coupon.label` | Discount code | Label of the code box at checkout |
| `coupon.apply` | Apply | The button beside the code box |
| `coupon.valid` | {code} applied: {percent}% off. | Shown when the code works |
| `coupon.invalid` | That code is not valid. | Shown when the code is not one we know |
| `coupon.expired` | That code has expired. | Shown for a code we know but that no longer works |

## Currency

Built in the second part of this work. Every price is stored in Canadian dollars and converted for the shopper.

| Key | Wording | Where it appears |
|---|---|---|
| `currency.label` | Currency | Label of the currency selector |
| `currency.note` | Prices are converted from Canadian dollars at fixed demo rates. | A small note near the selector |
| `currency.locked` | The currency is locked once checkout starts. | Shown beside the selector once checkout has begun |
| `currency.CAD` | Canadian dollar (CAD) | An option in the selector |
| `currency.USD` | US dollar (USD) | An option in the selector |
| `currency.EUR` | Euro (EUR) | An option in the selector |
| `currency.GBP` | British pound (GBP) | An option in the selector |

## Lead popup

Built in the fourth part of this work. On the home page it opens by itself after 5 seconds or 40% of the page, at most once every 7 days, and a visitor can open the same form at any time from the footer link or the corner tab. The messages about a wrong name or email are the ones already listed in `docs/shop-rules.md`.

| Key | Wording | Where it appears |
|---|---|---|
| `popup.title` | Get {percent}% off your first order | The popup heading |
| `popup.body` | Add your name and email and we will show you the code. This is a demo, so demo details work fine. | The text under the heading |
| `popup.firstName` | First name | Label of the first field |
| `popup.email` | Email | Label of the second field |
| `popup.marketing` | Email me offers and news. I can unsubscribe at any time. | The box under the fields. It is never ticked for the visitor, and no demo button ticks it |
| `popup.submit` | Show my code | The main button |
| `popup.demoButton` | Use demo data | A small button that fills the fields with a made-up person |
| `popup.demoAnnounce` | Form filled with demo data. | Read out to screen readers after the demo button is pressed |
| `popup.demoNote` | Demo details are made up. Anything you type yourself is deleted after {days} days. | A small note under the demo button |
| `popup.newPerson` | Try another person | A small button, styled as a link, that fills the fields with a different made-up person. It stays hidden until a person has been filled in |
| `popup.success` | Your code is {code}. Use it at checkout for {percent}% off. | Shown after the form is accepted |
| `popup.close` | Close | Read out for the close button |
| `popup.noThanks` | No thanks | A text button under the form that closes the popup |
| `popup.reopen` | Get {percent}% off | The button, styled as a link, in the footer and the small tab in the corner of the page, which open the same form by hand. It shows the offer, never the code |
| `popup.loadFailed` | The form could not be loaded. Please reload the page and try again. | A message under the main button, shown only if the form's code cannot be loaded, which is rare. The browser does not try again by itself, so the visitor has to reload the page |

## About

The About page.

| Key | Wording | Where it appears |
|---|---|---|
| `about.title` | About | The browser tab title, before "\| Second Impression" |
| `about.description` | What Second Impression is, and why it exists. | The description search engines would show |
| `about.heading` | About Second Impression | The page heading |
| `about.p1` | Second Impression is a clothing store that does not exist. It was built as a portfolio project, to show how a shop can be tracked properly: what is measured, why, and how a visitor can check it. | First paragraph |
| `about.p2` | The name comes from screen printing. A second impression is a second pass of ink, laid over the first. In advertising it is the second time someone sees an ad, which is what retargeting is. The store is a wink at both. | Second paragraph |
| `about.p3` | Everything here is fictional: the products, the prices and the orders. Nothing is shipped and nothing is charged. Only test card numbers work. | Third paragraph |
| `about.readMore` | Read more | Heading above two links, "The project on GitHub" and "Taking this to production" |

## Contact

The Contact page has no form, so it collects nothing.

| Key | Wording | Where it appears |
|---|---|---|
| `contact.title` | Contact | The browser tab title |
| `contact.description` | How to reach the people behind this demo. | The description search engines would show |
| `contact.heading` | Contact | The page heading |
| `contact.p1` | Second Impression is a demo, so there is no shop to write to and no inbox is read. Nothing you type on this site is sent to a person. | First paragraph |
| `contact.p2` | To ask about the project, or to point out a mistake, open an issue on GitHub. | Second paragraph |
| `contact.link` | Open an issue on GitHub | A link under the second paragraph. It goes to the project's issues page |

## Shipping

The shipping page. The prices and the threshold come from the code, and the table at the end of this page shows them.

| Key | Wording | Where it appears |
|---|---|---|
| `shipping.title` | Shipping | The browser tab title |
| `shipping.description` | How shipping would work if Second Impression were real. | The description search engines would show |
| `shipping.heading` | Shipping | The page heading |
| `shipping.intro` | This is a demo store, so nothing is shipped. This page says how shipping would work if it were real. | The opening paragraph |
| `shipping.methodsHeading` | Methods and prices | A section heading |
| `shipping.standard` | Standard: {standard} (Canadian dollars), 5 to 8 business days. It is free when your items, after any discount, come to {freeFrom} or more. | The Standard method |
| `shipping.express` | Express: {express} (Canadian dollars), 2 to 3 business days. | The Express method |
| `shipping.whereHeading` | Where we would ship | A section heading |
| `shipping.where` | Nine countries: Canada, the United States, the United Kingdom, France, Germany, Ireland, Italy, the Netherlands and Spain. | The list of countries |
| `shipping.taxHeading` | Tax and duties | A section heading |
| `shipping.tax` | Tax is added at checkout, at the rate for the address you ship to. Duties and import fees are not charged in this demo. A real store would have to say who pays them. | The tax paragraph |

## Returns

The returns page.

| Key | Wording | Where it appears |
|---|---|---|
| `returns.title` | Returns | The browser tab title |
| `returns.description` | How returns would work if Second Impression were real. | The description search engines would show |
| `returns.heading` | Returns | The page heading |
| `returns.intro` | This is a demo store, so nothing can be returned. This page says how returns would work if it were real. | The opening paragraph |
| `returns.windowHeading` | Thirty days | A section heading |
| `returns.window` | You can return anything unworn, with its tags, within 30 days of delivery. We refund the original payment method within 5 business days of the parcel arriving. | The return window |
| `returns.costHeading` | Who pays | A section heading |
| `returns.cost` | A faulty item is returned at our cost. Any other return is at yours. | The cost of returning |
| `returns.misprintHeading` | The Misprint Tee | A section heading |
| `returns.misprint` | The off-register print on the Misprint Tee is on purpose, so it is not a fault. | The Misprint Tee paragraph |

## Terms

The terms page. It is short on purpose, and it is not legal advice.

| Key | Wording | Where it appears |
|---|---|---|
| `terms.title` | Terms | The browser tab title |
| `terms.description` | The terms of use for this demo store. | The description search engines would show |
| `terms.heading` | Terms of use | The page heading |
| `terms.intro` | These terms are for a demo. They are short on purpose. | The opening line |
| `terms.p1` | Second Impression is a fictional store made for a portfolio. You cannot buy anything, and no contract is made when you use it. | First paragraph |
| `terms.p2` | The products, prices, shipping and returns are made up. They show how a real store would work. | Second paragraph |
| `terms.p3` | Payment forms accept only the test card numbers shown at checkout. Do not enter a real card number. | Third paragraph |
| `terms.p4` | Details you enter are kept for {days} days and then deleted. | Fourth paragraph |
| `terms.p5` | The site is offered as it is, with no promise that it will stay online. | Fifth paragraph |

## Page not found

The page shown for an address that does not exist.

| Key | Wording | Where it appears |
|---|---|---|
| `notFound.title` | Page not found | The browser tab title |
| `notFound.description` | That page does not exist. | The description search engines would show |
| `notFound.heading` | Page not found | The page heading |
| `notFound.body` | That page does not exist. It may have moved, or the address may have a typo. | The paragraph under the heading |
| `notFound.home` | Back to the home page | A link under the paragraph |

## Style page

A page that shows the colours, type and drawings, for people working on the store. It is not linked from the store.

| Key | Wording | Where it appears |
|---|---|---|
| `style.title` | Style guide | The browser tab title |
| `style.description` | The colours, type and drawings used across the store. | The description search engines would show |
| `style.heading` | Style guide | The page heading |
| `style.intro` | The colours, type and drawings used across Second Impression. | The line under the heading |
| `style.colour` | Colour | A section heading |
| `style.type` | Type | A section heading |
| `style.buttons` | Buttons | A section heading |
| `style.garments` | Garments | A section heading |

## Blanks filled from the code

These blanks take their value from the store's data, and a test checks the value shown here against the code.

| Blank | Value now | Where it comes from |
|---|---|---|
| `{standard}` | $9.00 | The Standard price, from `SHIPPING_METHODS` in `src/store/shipping-methods.ts` |
| `{express}` | $19.00 | The Express price, from `SHIPPING_METHODS` in `src/store/shipping-methods.ts` |
| `{freeFrom}` | $100.00 | The free-shipping threshold, `FREE_SHIPPING_FROM_CAD` in `src/store/shipping-methods.ts` |
| `{max}` | 10 | The most of one item a line may hold, `MAX_QUANTITY_PER_LINE` in `src/store/policy.ts` |
| `{days}` | 7 | How long a saved cart and a lead are kept, `CART_LIFETIME_DAYS` in `src/store/policy.ts` |
| `{code}` | WELCOME10 | The welcome code, from `COUPONS` in `src/store/coupon-codes.ts` |
| `{percent}` | 10 | What the welcome code takes off, from `COUPONS` in `src/store/coupon-codes.ts` |

## Messages the code already produces

These messages are written in the cart and pricing code, and they are shown as they are. A test runs the code and checks each one. The wording can be changed there, and this table then has to change with it.

| Case | Wording now | When it appears |
|---|---|---|
| `unknown_product` | SI-TEE-999 is not a product we sell. | A cart line or an order line whose SKU is not in the catalog |
| `unknown_variant` | Logo Tee does not come in Red / M. | A colour or size the product does not come in |
| `bad_quantity` | Logo Tee: the quantity must be a whole number from 1 to 10. | A quantity that is not a whole number from 1 to the limit, when pricing |
| `sold_out` | Misprint Tee in Red / XL is sold out. | Adding a variant that is sold out |
| `cart_full` | Your cart is full: it holds up to 20 different items. | Adding a 21st different item |
| `bad_quantity_cart` | The quantity must be a whole number. | Setting a line to a quantity that is not a whole number |

## Changing a word

| To change | Edit | Then |
|---|---|---|
| Any word in the tables above | `WORDS` in `src/store/words.ts` | Update this page. The test names the row that no longer matches |
| The Standard or Express price, or the free-shipping threshold | `SHIPPING_METHODS` in `src/store/shipping-methods.ts` | Update the blanks table |
| A message about an unknown item, a colour or size, or a quantity | `checkLine` in `src/engine/pricing.ts` | Update the table of messages the code already produces |
| The message for a full cart | `addToCart` in `src/engine/cart.ts` | Update the table of messages the code already produces |
| The message for a quantity that is not a whole number, in the cart | `setQuantity` in `src/engine/cart.ts` | Update the table of messages the code already produces |
