import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MAX_QUANTITY_PER_LINE,
  PRODUCTS,
  findCollection,
  variantLabel,
  variantSku,
  variantsOf,
} from '../../src/shop/catalog';
import { MAX_CART_LINES } from '../../src/shop/cart';
import { CART_LIFETIME_DAYS } from '../../src/shop/cart-storage';
import { COUPONS } from '../../src/shop/coupons';
import { COUNTRIES, PROVINCES } from '../../src/shop/destinations';
import {
  CURRENCIES,
  EURO_AREA_COUNTRIES,
  defaultCurrencyFor,
  formatMoney,
} from '../../src/shop/money';
import { SHIPPING_METHODS } from '../../src/shop/shipping';
import { checkAddress, checkContact, checkLead, type FormCheck, type FormField } from '../../src/shop/checkout-form';
import { DEMO_EMAIL_DOMAINS, checkEmailDomain, parseDomainList, type MailService } from '../../src/shop/email-domain';
import { PERSONAS } from '../../src/shop/personas';
import { POSTAL_CODE_FORMATS } from '../../src/shop/postal-codes';
import { DEFAULT_TEST_CARD, TEST_CARDS, checkPayment, formatCardNumber } from '../../src/shop/test-cards';
import { tableUnderHeading } from '../helpers/markdown';

const rules = readFileSync(new URL('../../docs/shop-rules.md', import.meta.url), 'utf8');
const trackingPlan = readFileSync(new URL('../../docs/tracking-plan.md', import.meta.url), 'utf8');
const cad = (cents: number) => formatMoney(cents, 'CAD');

/** The message a form check gives for one field, so the page can be compared with what the code says. */
function problemMessage(result: FormCheck<unknown>, field: FormField): string {
  if (result.ok) throw new Error(`Expected a problem with ${field}`);
  const found = result.problems.find((problem) => problem.field === field);
  if (!found) throw new Error(`No problem was reported for ${field}`);
  return found.message;
}

describe('docs/shop-rules.md', () => {
  it('lists the currencies and demo rates the way the code does', () => {
    expect(tableUnderHeading(rules, '## Currencies')).toEqual(
      CURRENCIES.map((currency) => [currency.code, currency.name, String(currency.rate)]),
    );
  });

  it('lists the products, their prices, colours, sizes and sold-out variants the way the code does', () => {
    expect(tableUnderHeading(rules, '## Products')).toEqual(
      PRODUCTS.map((product) => [
        product.sku,
        product.name,
        findCollection(product.collection)!.name,
        cad(product.priceCad),
        product.compareAtCad === undefined ? '-' : cad(product.compareAtCad),
        product.colours.join(', '),
        product.sizes.join(', '),
        product.soldOut.length === 0
          ? '-'
          : product.soldOut.map((variant) => variantLabel(variant.colour, variant.size)).join(', '),
      ]),
    );
  });

  it('lists the shipping methods, prices and free-shipping line the way the code does', () => {
    expect(tableUnderHeading(rules, '## Shipping')).toEqual(
      SHIPPING_METHODS.map((method) => [
        method.name,
        cad(method.priceCad),
        method.freeFromCad === undefined
          ? 'Never'
          : `Items after discount reach ${cad(method.freeFromCad)}`,
      ]),
    );
  });

  it('lists the tax rate for every country and province the way the code does', () => {
    expect(tableUnderHeading(rules, '## Tax by country')).toEqual(
      COUNTRIES.map((country) => [
        country.name,
        country.taxPercent === undefined ? 'By province, see below' : `${country.taxPercent}%`,
      ]),
    );
    expect(tableUnderHeading(rules, '## Tax by province')).toEqual(
      PROVINCES.map((province) => [province.name, `${province.taxPercent}%`]),
    );
  });

  it('lists the coupons the way the code does', () => {
    expect(tableUnderHeading(rules, '## Coupons')).toEqual(
      COUPONS.map((coupon) => [
        coupon.code,
        `${coupon.percentOff}% off each item`,
        coupon.expired ? 'Expired' : 'Valid',
      ]),
    );
  });

  it('states the cart limits the way the code does', () => {
    expect(tableUnderHeading(rules, '## Limits')).toEqual([
      ['Most units of one product, colour and size on one cart line', String(MAX_QUANTITY_PER_LINE)],
      ['Most different lines in one cart', String(MAX_CART_LINES)],
      ['How long a saved cart is kept, from its last change', `${CART_LIFETIME_DAYS} days`],
    ]);
  });

  it('lists an example variant SKU and the number of variants for each product the way the code does', () => {
    expect(tableUnderHeading(rules, '## Variant SKUs')).toEqual(
      PRODUCTS.map((product) => [
        product.sku,
        variantSku(product.sku, product.colours[0], product.sizes[0]),
        String(variantsOf(product).length),
      ]),
    );
    const total = PRODUCTS.reduce((sum, product) => sum + variantsOf(product).length, 0);
    expect(rules).toContain(`There are ${total} in all.`);
  });

  it('lists the starting currency for each kind of visitor the way the code does', () => {
    expect(tableUnderHeading(rules, '## Default currency')).toEqual([
      ['Canada', defaultCurrencyFor('CA')],
      ['United States', defaultCurrencyFor('US')],
      ['United Kingdom', defaultCurrencyFor('GB')],
      [`Euro area (${EURO_AREA_COUNTRIES.length} countries)`, defaultCurrencyFor('FR')],
      ['Anywhere else', defaultCurrencyFor('JP')],
    ]);
  });

  it('lists the euro-area countries the way the code does', () => {
    expect(tableUnderHeading(rules, '## Euro area countries')).toEqual(
      EURO_AREA_COUNTRIES.map((country) => [country.code, country.name]),
    );
  });

  it('lists what each checkout form field accepts, and the message for each mistake, the way the code does', () => {
    const email = 'maya@example.com';
    const address = {
      country: 'CA',
      firstName: 'Maya',
      lastName: 'Tremblay',
      address1: '47 Rue des Lilas',
      city: 'Montréal',
      province: 'QC',
      postalCode: 'H2J 3K4',
    };
    // A field that is optional says so on the page, and a test checks that leaving it empty really is fine.
    const optional = 'Nothing, it is optional';
    expect(checkContact({ email, phone: '' }).ok).toBe(true);
    expect(checkAddress({ ...address, address2: '' }).ok).toBe(true);

    const rows = tableUnderHeading(rules, '## Checkout forms').map(([field, , empty, wrong]) => [field, empty, wrong]);
    expect(rows).toEqual([
      [
        'First name',
        problemMessage(checkLead({ firstName: '', email }), 'firstName'),
        problemMessage(checkLead({ firstName: '<b>', email }), 'firstName'),
      ],
      [
        'Last name',
        problemMessage(checkAddress({ ...address, lastName: '' }), 'lastName'),
        problemMessage(checkAddress({ ...address, lastName: '<b>' }), 'lastName'),
      ],
      [
        'Email',
        problemMessage(checkContact({ email: '' }), 'email'),
        problemMessage(checkContact({ email: 'not an email' }), 'email'),
      ],
      ['Phone', optional, problemMessage(checkContact({ email, phone: '12' }), 'phone')],
      [
        'Country',
        problemMessage(checkAddress({ ...address, country: '' }), 'country'),
        problemMessage(checkAddress({ ...address, country: 'JP' }), 'country'),
      ],
      [
        'Street address',
        problemMessage(checkAddress({ ...address, address1: '' }), 'address1'),
        problemMessage(checkAddress({ ...address, address1: '<b>' }), 'address1'),
      ],
      ['Second address line', optional, problemMessage(checkAddress({ ...address, address2: '<b>' }), 'address2')],
      [
        'City',
        problemMessage(checkAddress({ ...address, city: '' }), 'city'),
        problemMessage(checkAddress({ ...address, city: '<b>' }), 'city'),
      ],
      [
        'Province',
        problemMessage(checkAddress({ ...address, province: '' }), 'province'),
        problemMessage(checkAddress({ ...address, province: 'XX' }), 'province'),
      ],
      [
        'Postal code',
        problemMessage(checkAddress({ ...address, postalCode: '' }), 'postalCode'),
        problemMessage(checkAddress({ ...address, postalCode: 'nonsense' }), 'postalCode'),
      ],
    ]);
  });

  it('lists the email domain checks, and what the shopper reads for each, the way the code does', () => {
    const said = (email: string, mailService: MailService): string => {
      const result = checkEmailDomain(email, { disposableDomains: new Set(['mailinator.com']), mailService });
      if (result.ok) throw new Error('Expected a problem');
      return result.problem.message;
    };
    const rows = tableUnderHeading(rules, '## Email addresses').map(([check, , shopper]) => [check, shopper]);
    expect(rows).toEqual([
      ['Temporary address', said('maya@mailinator.com', 'accepts-mail')],
      ['Domain cannot receive email', said('maya@some-typo.com', 'no-mail')],
    ]);
  });

  it('says how many temporary email domains the list holds, when it was copied, and which domains are the demo ones, the way the code does', () => {
    const file = readFileSync(new URL('../../src/data/disposable-email-domains.txt', import.meta.url), 'utf8');
    const copied = file.match(/Copied on (\d{4}-\d{2}-\d{2})/)?.[1];
    expect(copied).toBeDefined();
    expect(rules).toContain(`copied on ${copied} and holds ${parseDomainList(file).size} domains`);
    for (const domain of DEMO_EMAIL_DOMAINS) expect(rules).toContain(`\`${domain}\``);
  });

  it('lists the postal code formats the way the code does', () => {
    expect(tableUnderHeading(rules, '## Postal codes')).toEqual(
      POSTAL_CODE_FORMATS.map((format) => [
        COUNTRIES.find((country) => country.code === format.country)!.name,
        format.name,
        format.format,
        format.example,
      ]),
    );
  });

  it('lists the test cards the way the code does', () => {
    expect(tableUnderHeading(rules, '## Test cards')).toEqual(
      TEST_CARDS.map((card) => [
        formatCardNumber(card.number),
        card.brand,
        card.result === 'declined'
          ? 'Declined, and no purchase is recorded'
          : card === DEFAULT_TEST_CARD
            ? 'Accepted. The "Use test card" button fills this one'
            : 'Accepted',
      ]),
    );
  });

  it('lists what the payment form checks, and what it says, the way the code does', () => {
    const now = Date.UTC(2026, 8, 21);
    const card = { number: '4242 4242 4242 4242', expiry: '12/30', securityCode: '123' };
    const said = (change: object, field: string): string => {
      const result = checkPayment({ ...card, ...change }, now);
      if (result.status !== 'invalid') throw new Error('Expected a problem');
      const found = result.problems.find((problem) => problem.field === field);
      if (!found) throw new Error(`No problem was reported for ${field}`);
      return found.message;
    };
    const declined = checkPayment({ ...card, number: '4000 0000 0000 0002' }, now);
    if (declined.status !== 'declined') throw new Error('Expected the decline card to be declined');

    const rows = tableUnderHeading(rules, '### What the payment form checks').map(([field, , empty, wrong]) => [
      field,
      empty,
      wrong,
    ]);
    expect(rows).toEqual([
      ['Card number', said({ number: '' }, 'number'), said({ number: '4111 1111 1111 1111' }, 'number')],
      ['Expiry date', said({ expiry: '' }, 'expiry'), said({ expiry: '99/99' }, 'expiry')],
      ['Security code', said({ securityCode: '' }, 'securityCode'), said({ securityCode: '12' }, 'securityCode')],
      ['Expiry date, month already over', '-', said({ expiry: '01/20' }, 'expiry')],
      ['The decline card', '-', declined.message],
    ]);
  });

  it('lists the demo people the way the code does', () => {
    expect(PERSONAS).toHaveLength(8);
    expect(rules).toContain('one of eight fictional people');
    expect(tableUnderHeading(rules, '## Demo people')).toEqual(
      PERSONAS.map((persona) => [
        `${persona.firstName} ${persona.lastName}`,
        persona.city,
        COUNTRIES.find((country) => country.code === persona.country)!.name,
      ]),
    );
  });

  it('points every rule to a name that really exists in the file it names', () => {
    const rows = tableUnderHeading(rules, '## Changing a rule');
    expect(rows.length).toBeGreaterThan(0);
    for (const [rule, , where] of rows) {
      const pairs = [...where.matchAll(/`([^`]+)` in `([^`]+)`/g)];
      expect(pairs.length, rule).toBeGreaterThan(0);
      for (const [, name, path] of pairs) {
        const source = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
        expect(source, `${name} in ${path}`).toContain(name);
      }
    }
  });
});

describe('docs/tracking-plan.md, for the values the shop produces', () => {
  it('says which values shipping_tier can take', () => {
    const line = trackingPlan
      .split(/\r?\n/)
      .find((candidate) => candidate.startsWith('- ') && candidate.includes('`shipping_tier`'));
    expect(line).toBeDefined();
    for (const method of SHIPPING_METHODS) {
      expect(line, method.name).toContain(`\`${method.name}\``);
    }
  });

  it("says an item's index counts from 1", () => {
    expect(trackingPlan).toContain("`index` is the item's place in the list, counting from 1");
  });

  it('says the colour-and-size SKU names the exact item but is not the item_id', () => {
    expect(trackingPlan).toContain(`\`${variantSku('SI-TEE-002', 'Ink', 'M')}\``);
    expect(trackingPlan).toContain('is not sent as `item_id`');
  });

  it('says how item_variant is written', () => {
    expect(trackingPlan).toContain(`\`${variantLabel('Ink', 'M')}\``);
  });

  it("says item_id is the product's SKU, the same at every step, not a colour and size SKU", () => {
    expect(trackingPlan).toContain("`item_id` is the product's SKU");
    expect(trackingPlan).toContain('until add to cart');
  });
});
