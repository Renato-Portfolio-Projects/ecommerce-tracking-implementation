import { describe, expect, it } from 'vitest';
import { SITE_LINKS } from '../../src/store/site';
import { CTA_LABELS } from '../../src/tracking/cta-labels';
import { CLOSED, OPEN, decodeEntities, htmlFiles, readPage, scriptOf } from '../helpers/built';

const labelsOn = (html: string): string[] => [...html.matchAll(/\sdata-cta="([^"]*)"/g)].map((match) => decodeEntities(match[1]));

/** The opening tags of the links and buttons in a page that carry a given label. */
function tagsLabelled(html: string, label: string): string[] {
  return [...html.matchAll(/<(?:a|button)\b[^>]*>/g)].map((match) => decodeEntities(match[0])).filter((tag) => tag.includes(` data-cta="${label}"`));
}

const openFiles = htmlFiles(OPEN);
const storePages = openFiles.filter((file) => readPage(OPEN, file).includes('<header class="header">'));
const CART = 'cart/index.html';
const CHECKOUT = 'checkout/index.html';
const THANK_YOU = 'thank-you/index.html';

interface Expectation {
  label: string;
  tag: 'a' | 'button';
  href?: string;
  /** The pages that carry it. It is on no other page. */
  on: string[];
  /** How many times it is on each of those pages. */
  times: number;
}

// The three labels of the lead popup (the footer button, the corner tab and its demo button) are pinned in lead-popup.test.ts.
const expectations: Expectation[] = [
  { label: 'Header - Logo', tag: 'a', href: '/', on: storePages, times: 1 },
  { label: 'Nav - Tees', tag: 'a', href: '/#tees', on: storePages, times: 1 },
  { label: 'Nav - Pants', tag: 'a', href: '/#pants', on: storePages, times: 1 },
  { label: 'Nav - About', tag: 'a', href: '/about', on: storePages, times: 1 },
  { label: 'Footer - GitHub', tag: 'a', href: SITE_LINKS.project, on: storePages, times: 1 },
  { label: 'Footer - Production guide', tag: 'a', href: SITE_LINKS.guide, on: storePages, times: 1 },
  { label: 'Footer - Shipping', tag: 'a', href: '/policies/shipping', on: storePages, times: 1 },
  { label: 'Footer - Returns', tag: 'a', href: '/policies/returns', on: storePages, times: 1 },
  { label: 'Footer - Terms', tag: 'a', href: '/policies/terms', on: storePages, times: 1 },
  { label: 'Footer - Contact', tag: 'a', href: '/contact', on: storePages, times: 1 },
  { label: 'Demo bar - Project link', tag: 'a', href: SITE_LINKS.project, on: storePages, times: 1 },
  // The drawer is on every store page but the cart page, and its Keep shopping is for an empty cart.
  { label: 'Cart drawer - Keep shopping', tag: 'button', on: storePages.filter((file) => file !== CART), times: 1 },
  // The cart page has two, the one for an empty cart and the one under the Checkout button, and the script shows one.
  { label: 'Cart page - Keep shopping', tag: 'a', href: '/', on: [CART], times: 2 },
  { label: 'Thank you - Keep shopping', tag: 'a', href: '/', on: [THANK_YOU], times: 1 },
  { label: 'Demo Data - Checkout contact', tag: 'button', on: [CHECKOUT], times: 1 },
  { label: 'Demo Data - Checkout address', tag: 'button', on: [CHECKOUT], times: 1 },
  { label: 'Test Card - Checkout payment', tag: 'button', on: [CHECKOUT], times: 1 },
];

describe('the call-to-action labels on the built pages', () => {
  it('are all in the list, on the store built open and on the one built closed', () => {
    for (const [folder, files] of [
      [OPEN, openFiles],
      [CLOSED, htmlFiles(CLOSED)],
    ] as const) {
      for (const file of files) {
        for (const label of labelsOn(readPage(folder, file))) expect(CTA_LABELS as readonly string[], `${label} on ${file}`).toContain(label);
      }
    }
  });

  it('use every label in the list somewhere, so none is left over from a page that has changed', () => {
    const used = new Set(openFiles.flatMap((file) => labelsOn(readPage(OPEN, file))));
    for (const label of CTA_LABELS) expect(used.has(label), label).toBe(true);
  });

  it('sit only on links and buttons, which is what a click can be heard on', () => {
    for (const file of openFiles) {
      const html = readPage(OPEN, file);
      const everywhere = html.match(/\sdata-cta="/g)?.length ?? 0;
      const onLinksAndButtons = [...html.matchAll(/<(?:a|button)\b[^>]*\sdata-cta="/g)].length;
      expect(onLinksAndButtons, file).toBe(everywhere);
    }
  });

  it.each(expectations)('put "$label" on the right element, on the pages where it belongs and on no other', ({ label, tag, href, on, times }) => {
    expect(on.length, `${label} has somewhere to be`).toBeGreaterThan(0);
    for (const file of openFiles) {
      const found = tagsLabelled(readPage(OPEN, file), label);
      expect(found.length, `${label} on ${file}`).toBe(on.includes(file) ? times : 0);
      for (const opening of found) {
        expect(opening.startsWith(`<${tag} `), `${label} is on a ${tag} in ${file}`).toBe(true);
        if (href !== undefined) expect(opening, `${label} in ${file}`).toContain(` href="${href}"`);
      }
    }
  });
});

describe('the script of a store page, for the call-to-action labels and the currency', () => {
  // Event names would prove nothing: any page that can announce at all carries the whole list of them. These are
  // the names only the wiring uses.
  it('looks for a click on a labelled element, a currency picked by the visitor, and the popup\'s first press', () => {
    const script = scriptOf(OPEN, readPage(OPEN, 'index.html'));
    for (const wiring of ['[data-cta]', 'currency:selected', 'data-track-select-once']) expect(script, wiring).toContain(wiring);
  });
});
