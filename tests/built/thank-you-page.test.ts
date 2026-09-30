import { describe, expect, it } from 'vitest';
import { WORDS } from '../../src/store/words';
import { decodeEntities, OPEN, readPage, scriptOf } from '../helpers/built';

// The thank-you page's own markup: its three states (loading, the order, and the two messages for when it
// cannot be found or loaded), all hidden or shown as the store's words say. What the script actually does
// with a token, a found order or a failed fetch cannot be checked here (there is no script running): that is
// proven in a real browser.

const html = readPage(OPEN, 'thank-you/index.html');
const page = decodeEntities(html);

describe('the thank-you page, before any script has run', () => {
  it('is named and described in the store\'s words', () => {
    expect(page).toContain(`<title>${WORDS['thankYou.title']} | Second Impression</title>`);
    expect(page).toContain(`<meta name="description" content="${WORDS['thankYou.description']}">`);
  });

  it('has no lead popup, footer link or corner tab: a shopper who has just ordered is never invited to start over', () => {
    expect(page).not.toContain('data-lead-popup');
    expect(page).not.toContain('data-lead-open="footer"');
    expect(page).not.toContain('data-lead-open="tab"');
  });

  it('shows a loading message by default', () => {
    expect(page).toContain(`<p data-thank-you-loading>${WORDS['thankYou.loading']}</p>`);
  });

  it('has the order section hidden by default, holding the three words its script needs', () => {
    // Matched against the raw, undecoded html: its own quotes are HTML entities, so decoding first would
    // truncate the match at the JSON's own quotes.
    const match = html.match(/<section data-thank-you-order hidden data-words="([^"]*)">/);
    expect(match).not.toBeNull();
    expect(JSON.parse(decodeEntities(match![1]))).toEqual({
      body: WORDS['thankYou.body'],
      free: WORDS['checkout.freeShipping'],
      cardEnding: WORDS['checkout.cardEnding'],
    });
  });

  it('names the order section\'s heading and the three detail headings, and gives it a Keep shopping link', () => {
    const section = page.match(/<section data-thank-you-order[\s\S]*?<\/section>/)![0];
    expect(section).toContain(`<h1>${WORDS['thankYou.heading']}</h1>`);
    expect(section).toContain(`<h2>${WORDS['checkout.contactHeading']}</h2>`);
    expect(section).toContain(`<h2>${WORDS['checkout.addressHeading']}</h2>`);
    expect(section).toContain(`<h2>${WORDS['checkout.paymentHeading']}</h2>`);
    expect(section).toContain(`<a class="btn" href="/" data-thank-you-keep-shopping>${WORDS['cart.keepShopping']}</a>`);
  });

  it('gives the order section a line-item template with a quantity, name, variant and price', () => {
    const section = page.match(/<section data-thank-you-order[\s\S]*?<\/section>/)![0];
    const template = section.match(/<template data-thank-you-line>[\s\S]*?<\/template>/)![0];
    expect(template).toContain('data-thank-you-line-qty');
    expect(template).toContain('data-thank-you-line-name');
    expect(template).toContain('data-thank-you-line-variant');
    expect(template).toContain('data-thank-you-line-price');
    expect(template).toContain(`aria-label="${WORDS['cart.quantity']}"`);
  });

  it('lists all five totals, the discount row hidden until a coupon earns it', () => {
    const section = page.match(/<section data-thank-you-order[\s\S]*?<\/section>/)![0];
    for (const [name, word] of [
      ['subtotal', WORDS['cart.subtotal']],
      ['discount', WORDS['checkout.discount']],
      ['shipping', WORDS['checkout.shipping']],
      ['tax', WORDS['checkout.tax']],
      ['total', WORDS['checkout.total']],
    ] as const) {
      expect(section, name).toContain(`<dt>${word}</dt><dd data-thank-you-total="${name}"></dd>`);
    }
    expect(section).toMatch(/<div data-thank-you-discount-row hidden><dt>/);
  });

  it('has a not-found message and a load-error message, both hidden, each with a link home', () => {
    const notFound = page.match(/<section data-thank-you-not-found hidden>[\s\S]*?<\/section>/)![0];
    expect(notFound).toContain(`<h1>${WORDS['thankYou.notFoundHeading']}</h1>`);
    expect(notFound).toContain(`<p>${WORDS['thankYou.notFoundBody']}</p>`);
    expect(notFound).toContain(`href="/">${WORDS['notFound.home']}</a>`);

    const loadError = page.match(/<section data-thank-you-load-error hidden>[\s\S]*?<\/section>/)![0];
    expect(loadError).toContain(`<h1>${WORDS['thankYou.loadErrorHeading']}</h1>`);
    expect(loadError).toContain(`<p>${WORDS['thankYou.loadErrorBody']}</p>`);
    expect(loadError).toContain(`href="/">${WORDS['notFound.home']}</a>`);
  });
});

describe('the script that runs the thank-you page', () => {
  it('is loaded by the thank-you page, and calls the order function back', () => {
    const script = scriptOf(OPEN, page);
    expect(script).toContain('/api/order');
    expect(script).toContain('data-thank-you-order');
  });

  it('is not loaded by any other page', () => {
    for (const file of ['index.html', 'cart/index.html', 'checkout/index.html']) {
      const script = scriptOf(OPEN, readPage(OPEN, file));
      expect(script, file).not.toContain('data-thank-you-order');
    }
  });
});
