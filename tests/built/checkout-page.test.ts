import { describe, expect, it } from 'vitest';
import { postalCodeLabel } from '../../src/engine/postal-codes';
import { COUNTRIES, PROVINCES } from '../../src/store/destinations';
import { SHIPPING_METHODS } from '../../src/store/shipping-methods';
import { WORDS } from '../../src/store/words';
import { decodeEntities, OPEN, readPage, scriptOf } from '../helpers/built';

// The checkout page's own markup: the three steps and their fields, the demo buttons, the currency lock, and
// that the lead popup never appears here. What a step does when its form is sent, and what happens once all
// three are complete, cannot be checked here (there is no script running): that is proven in a real browser.

const html = readPage(OPEN, 'checkout/index.html');
const page = decodeEntities(html);

describe('the checkout page, before any script has run', () => {
  it('is named and described in the store\'s words', () => {
    expect(page).toContain(`<title>${WORDS['checkout.title']} | Second Impression</title>`);
    expect(page).toContain(`<meta name="description" content="${WORDS['checkout.description']}">`);
    expect(page).toContain(`<h1>${WORDS['checkout.heading']}</h1>`);
  });

  it('has no lead popup, footer link or corner tab: a shopper checking out is never invited to start over', () => {
    expect(page).not.toContain('data-lead-popup');
    expect(page).not.toContain('data-lead-open="footer"');
    expect(page).not.toContain('data-lead-open="tab"');
  });

  it('still has the cart drawer, so a shopper can still see what they are paying for', () => {
    expect(page).toContain('data-cart-drawer');
  });

  it('locks the currency selector, with the word that says so', () => {
    const select = page.match(/<select id="currency-select"[^>]*>/)![0];
    expect(select).toMatch(/\sdisabled[\s>]/);
    expect(page).toContain(`<span class="currency-locked-note">${WORDS['currency.locked']}</span>`);
  });

  it('has the three steps, in order, only the first open', () => {
    const steps = [...page.matchAll(/<details class="checkout-step" data-checkout-step="(\w+)"( open)?>/g)];
    expect(steps.map((match) => match[1])).toEqual(['contact', 'address', 'payment']);
    expect(steps.map((match) => !!match[2])).toEqual([true, false, false]);
  });

  it('names each step in the store\'s words, with a place for its summary and its Edit link, both hidden', () => {
    for (const [step, heading] of [
      ['contact', WORDS['checkout.contactHeading']],
      ['address', WORDS['checkout.addressHeading']],
      ['payment', WORDS['checkout.paymentHeading']],
    ]) {
      const details = page.match(new RegExp(`<details class="checkout-step" data-checkout-step="${step}"[^>]*>[\\s\\S]*?<form`))![0];
      expect(details, step).toContain(`<span class="checkout-step-title">${heading}</span>`);
      expect(details, step).toContain('data-checkout-summary hidden');
      expect(details, step).toContain(`${WORDS['checkout.edit']}</span>`);
      expect(details, step).toMatch(/data-checkout-edit hidden/);
    }
  });

  it('asks for an email and an optional phone on the contact step, with the popup\'s own email label reused', () => {
    const step = page.match(/data-checkout-form="contact"[\s\S]*?<\/form>/)![0];
    expect(step).toContain(`<label for="checkout-email">${WORDS['popup.email']}</label>`);
    expect(step).toMatch(/<input id="checkout-email" name="email" type="email"/);
    expect(step).toContain(`<label for="checkout-phone">${WORDS['checkout.phone']}</label>`);
    expect(step).toMatch(/<input id="checkout-phone" name="phone" type="tel"/);
    expect(step).not.toMatch(/name="phone"[^>]*\srequired/);
  });

  it('asks for a full shipping address, every country and province listed, and the popup\'s own name labels reused', () => {
    const step = page.match(/data-checkout-form="address"[\s\S]*?<\/form>/)![0];
    expect(step).toContain(`<label for="checkout-first-name">${WORDS['popup.firstName']}</label>`);
    expect(step).toContain(`<label for="checkout-last-name">${WORDS['checkout.lastName']}</label>`);
    expect(step).toContain(`<label for="checkout-country">${WORDS['checkout.country']}</label>`);
    expect(step).toContain('data-checkout-error="country" hidden');
    expect(step).toContain(`<label for="checkout-address1">${WORDS['checkout.address1']}</label>`);
    expect(step).toContain(`<label for="checkout-address2">${WORDS['checkout.address2']}</label>`);
    expect(step).toContain(`<label for="checkout-city">${WORDS['checkout.city']}</label>`);
    expect(step).toContain(`<label for="checkout-province">${WORDS['checkout.province']}</label>`);
    for (const country of COUNTRIES) expect(step, country.name).toContain(`<option value="${country.code}">${country.name}</option>`);
    for (const province of PROVINCES) expect(step, province.name).toContain(`<option value="${province.code}">${province.name}</option>`);
    expect(step).not.toMatch(/name="address2"[^>]*\srequired/);
  });

  it('starts the postal code field labelled for the pre-selected country, Canada, so it is never empty before a script runs', () => {
    const step = page.match(/data-checkout-form="address"[\s\S]*?<\/form>/)![0];
    expect(step).toContain(`<label for="checkout-postal-code" data-checkout-postal-label>${postalCodeLabel(COUNTRIES[0].code)}</label>`);
  });

  it('asks for a card number, expiry and security code on the payment step, clearly labelled test mode', () => {
    const step = page.match(/data-checkout-form="payment"[\s\S]*?<\/form>/)![0];
    expect(step).toContain(`<p class="checkout-test-mode">${WORDS['checkout.testModeNote']}</p>`);
    expect(step).toContain(`<label for="checkout-card-number">${WORDS['checkout.cardNumber']}</label>`);
    expect(step).toContain(`<label for="checkout-card-expiry">${WORDS['checkout.cardExpiry']}</label>`);
    expect(step).toContain(`<label for="checkout-card-code">${WORDS['checkout.cardCode']}</label>`);
    expect(step).toContain('data-checkout-declined hidden');
  });

  it('gives the contact and address steps a demo button and a hidden Try another person, and the payment step a test-card button only', () => {
    const contact = page.match(/data-checkout-form="contact"[\s\S]*?<\/form>/)![0];
    const address = page.match(/data-checkout-form="address"[\s\S]*?<\/form>/)![0];
    const payment = page.match(/data-checkout-form="payment"[\s\S]*?<\/form>/)![0];
    for (const [step, name] of [
      [contact, 'contact'],
      [address, 'address'],
    ] as const) {
      expect(step, name).toContain(`data-checkout-demo="${name}">${WORDS['checkout.demoButton']}`);
      expect(step, name).toMatch(new RegExp(`data-checkout-new-person="${name}" hidden>${WORDS['checkout.newPerson']}`));
    }
    expect(payment).toContain(`data-checkout-demo="payment">${WORDS['checkout.testCardButton']}`);
    expect(payment).not.toContain('data-checkout-new-person');
  });

  it('gives every step a Continue button in the store\'s words', () => {
    expect(page.match(new RegExp(`class="btn">${WORDS['checkout.continue']}</button>`, 'g'))).toHaveLength(3);
  });

  it('gives its script the few words it needs, and not the whole words file', () => {
    // Matched against the raw, undecoded html: its own quotes are HTML entities, so decoding first would
    // truncate the match at the JSON's own quotes.
    const match = html.match(/data-checkout-announce data-words="([^"]*)"/);
    expect(match).not.toBeNull();
    expect(JSON.parse(decodeEntities(match![1]))).toEqual({ demoAnnounce: WORDS['checkout.demoAnnounce'], cardEnding: WORDS['checkout.cardEnding'] });
    const script = scriptOf(OPEN, html);
    expect(script).not.toContain(WORDS['about.p1']);
  });

  it('has the review section hidden by default, holding the five words its script needs', () => {
    // Matched against the raw, undecoded html: its own quotes are HTML entities, so decoding first would
    // truncate the match at the JSON's own quotes (the same reason the demo-announce words above do this).
    const match = html.match(/<section class="checkout-review" data-checkout-review hidden data-words="([^"]*)">/);
    expect(match).not.toBeNull();
    expect(JSON.parse(decodeEntities(match![1]))).toEqual({
      free: WORDS['checkout.freeShipping'],
      couponValid: WORDS['coupon.valid'],
      couponInvalid: WORDS['coupon.invalid'],
      couponExpired: WORDS['coupon.expired'],
      orderFailed: WORDS['checkout.orderFailed'],
    });
  });

  it('names the review section, with its heading', () => {
    const section = page.match(/<section class="checkout-review"[\s\S]*?<\/section>/)![0];
    expect(section).toContain(`<h2 data-checkout-review-heading>${WORDS['checkout.reviewHeading']}</h2>`);
  });

  it('gives the review a line-item template with a quantity, name, variant and price', () => {
    const section = page.match(/<section class="checkout-review"[\s\S]*?<\/section>/)![0];
    const template = section.match(/<template data-checkout-review-line>[\s\S]*?<\/template>/)![0];
    expect(template).toContain('data-checkout-review-qty');
    expect(template).toContain('data-checkout-review-name');
    expect(template).toContain('data-checkout-review-variant');
    expect(template).toContain('data-checkout-review-price');
    expect(template).toContain(`aria-label="${WORDS['cart.quantity']}"`);
  });

  it('lists both shipping methods, in order, standard chosen by default', () => {
    const section = page.match(/<section class="checkout-review"[\s\S]*?<\/section>/)![0];
    expect(section).toContain(`<legend>${WORDS['checkout.shippingMethodHeading']}</legend>`);
    const radios = [...section.matchAll(/<input type="radio" name="shippingMethod" value="(\w+)"( checked)?/g)];
    expect(radios.map((match) => match[1])).toEqual(SHIPPING_METHODS.map((method) => method.id));
    expect(radios.map((match) => !!match[2])).toEqual(SHIPPING_METHODS.map((_, index) => index === 0));
    for (const method of SHIPPING_METHODS) {
      expect(section, method.id).toContain(`<span>${method.name}</span>`);
      expect(section, method.id).toContain(`data-checkout-shipping-price="${method.id}"`);
    }
  });

  it('has a coupon form in the store\'s words, its field styled like every other field, and a hidden message box beside it', () => {
    const section = page.match(/<section class="checkout-review"[\s\S]*?<\/section>/)![0];
    const field = section.match(/<div class="lead-field">[\s\S]*?<\/div>/)![0];
    expect(field).toContain(`<label for="checkout-coupon">${WORDS['coupon.label']}</label>`);
    expect(field).toMatch(/<input id="checkout-coupon" name="coupon" type="text"/);
    expect(section).toContain(`class="btn">${WORDS['coupon.apply']}</button>`);
    expect(section).toContain('data-checkout-coupon-message hidden');
  });

  it('lists all five totals, the discount row hidden until a coupon earns it', () => {
    const section = page.match(/<section class="checkout-review"[\s\S]*?<\/section>/)![0];
    for (const [name, word] of [
      ['subtotal', WORDS['cart.subtotal']],
      ['discount', WORDS['checkout.discount']],
      ['shipping', WORDS['checkout.shipping']],
      ['tax', WORDS['checkout.tax']],
      ['total', WORDS['checkout.total']],
    ] as const) {
      expect(section, name).toContain(`<dt>${word}</dt><dd data-checkout-total="${name}"></dd>`);
    }
    expect(section).toMatch(/<div data-checkout-discount-row hidden><dt>/);
  });

  it('has a hidden error message and a Place order button, ready for the order to be placed', () => {
    const section = page.match(/<section class="checkout-review"[\s\S]*?<\/section>/)![0];
    expect(section).toMatch(/<p class="lead-error" role="alert" data-checkout-order-error hidden><\/p>/);
    expect(section).toContain(`<button type="button" class="btn" data-checkout-place-order>${WORDS['checkout.placeOrder']}</button>`);
  });
});

describe('the script that runs the checkout steps', () => {
  it('is loaded by the checkout page, and carries the three checks, the demo people, and the review', () => {
    const script = scriptOf(OPEN, page);
    expect(script).toContain('data-checkout-form');
    expect(script).toContain('data-checkout-summary');
    expect(script).toContain('second-impression:persona');
    expect(script).toContain('data-checkout-review');
    expect(script).toContain('checkout:step-changed');
    expect(script).toContain('data-checkout-place-order');
    expect(script).toContain('checkout:order-submitting');
    expect(script).toContain('checkout:order-submit-failed');
    expect(script).toContain('/api/order');
  });

  it('is not loaded by any other page', () => {
    for (const file of ['index.html', 'cart/index.html', 'about/index.html']) {
      const script = scriptOf(OPEN, readPage(OPEN, file));
      expect(script, file).not.toContain('data-checkout-form');
      expect(script, file).not.toContain('data-checkout-review');
    }
  });
});
