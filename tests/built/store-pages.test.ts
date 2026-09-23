import { describe, expect, it } from 'vitest';
import { fill } from '../../src/engine/fill';
import { formatMoney } from '../../src/engine/money';
import { CART_LIFETIME_DAYS } from '../../src/store/policy';
import { FREE_SHIPPING_FROM_CAD, SHIPPING_METHODS } from '../../src/store/shipping-methods';
import { SITE_LINKS } from '../../src/store/site';
import { WORDS } from '../../src/store/words';
import {
  CLOSED,
  OPEN,
  decodeEntities,
  externalLinks,
  fileFor,
  headingLevels,
  htmlFiles,
  internalLinks,
  readPage,
  requestsToOtherSites,
} from '../helpers/built';

const standard = SHIPPING_METHODS.find((method) => method.id === 'standard')!;
const express = SHIPPING_METHODS.find((method) => method.id === 'express')!;

/** Each of the store's pages: where it is built, its title, its heading and some of its words. */
const PAGES = [
  {
    file: 'about/index.html',
    title: WORDS['about.title'],
    description: WORDS['about.description'],
    heading: WORDS['about.heading'],
    words: [WORDS['about.p1'], WORDS['about.p2'], WORDS['about.p3'], WORDS['about.readMore'], WORDS['footer.github'], WORDS['footer.guide']],
    links: [SITE_LINKS.project, SITE_LINKS.guide],
  },
  {
    file: 'contact/index.html',
    title: WORDS['contact.title'],
    description: WORDS['contact.description'],
    heading: WORDS['contact.heading'],
    words: [WORDS['contact.p1'], WORDS['contact.p2'], WORDS['contact.link']],
    links: [SITE_LINKS.issues],
  },
  {
    file: 'policies/shipping/index.html',
    title: WORDS['shipping.title'],
    description: WORDS['shipping.description'],
    heading: WORDS['shipping.heading'],
    words: [
      WORDS['shipping.intro'],
      fill(WORDS['shipping.standard'], { standard: formatMoney(standard.priceCad, 'CAD'), freeFrom: formatMoney(FREE_SHIPPING_FROM_CAD, 'CAD') }),
      fill(WORDS['shipping.express'], { express: formatMoney(express.priceCad, 'CAD') }),
      WORDS['shipping.where'],
      WORDS['shipping.tax'],
    ],
    links: [],
  },
  {
    file: 'policies/returns/index.html',
    title: WORDS['returns.title'],
    description: WORDS['returns.description'],
    heading: WORDS['returns.heading'],
    words: [WORDS['returns.intro'], WORDS['returns.window'], WORDS['returns.cost'], WORDS['returns.misprint']],
    links: [],
  },
  {
    file: 'policies/terms/index.html',
    title: WORDS['terms.title'],
    description: WORDS['terms.description'],
    heading: WORDS['terms.heading'],
    words: [
      WORDS['terms.intro'],
      WORDS['terms.p1'],
      WORDS['terms.p2'],
      WORDS['terms.p3'],
      fill(WORDS['terms.p4'], { days: CART_LIFETIME_DAYS }),
      WORDS['terms.p5'],
    ],
    links: [],
  },
  {
    file: '404.html',
    title: WORDS['notFound.title'],
    description: WORDS['notFound.description'],
    heading: WORDS['notFound.heading'],
    words: [WORDS['notFound.body'], WORDS['notFound.home']],
    links: [],
  },
];

const built = htmlFiles(OPEN);
const allowedOutside = new Set<string>(Object.values(SITE_LINKS));

describe.each(PAGES)('the store page $file', (page) => {
  const html = readPage(OPEN, page.file);
  const text = decodeEntities(html);

  it('is named and described in the store\'s words', () => {
    expect(text).toContain(`<title>${page.title} | ${WORDS['site.name']}</title>`);
    expect(text).toContain(`<meta name="description" content="${page.description}"`);
    expect(html).toContain('<html lang="en-CA">');
  });

  it('has one heading of level 1, and its heading levels never skip', () => {
    const levels = headingLevels(html);
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    levels.forEach((level, index) => {
      if (index > 0) expect(level, `heading ${index + 1} jumps from ${levels[index - 1]} to ${level}`).toBeLessThanOrEqual(levels[index - 1] + 1);
    });
    expect(text).toContain(`<h1>${page.heading}</h1>`);
  });

  it('shows its words', () => {
    for (const word of page.words) expect(text, word).toContain(word);
  });

  it('has the demo bar, a skip link first, the header, the main area and the footer', () => {
    expect(text.indexOf('class="skip-link"'), 'the skip link comes before the demo bar').toBeLessThan(text.indexOf('class="demo-bar"'));
    expect(text).toContain(`href="#content">${WORDS['nav.skip']}</a>`);
    expect(text).toContain(`${WORDS['demo.bar']}`);
    expect(text).toContain(`<a href="${SITE_LINKS.project}">${WORDS['demo.link']}</a>`);
    expect(text).toContain(`<nav class="nav" aria-label="${WORDS['nav.label']}">`);
    expect(html.match(/<header\b/g)).toHaveLength(1);
    expect(html.match(/<main\b[^>]*id="content"/g)).toHaveLength(1);
    expect(html.match(/<footer\b/g)).toHaveLength(1);
  });

  it('links only to pages that were built, and to the few places outside that the store names', () => {
    for (const address of internalLinks(html)) {
      expect(built, `${address} is linked but was not built`).toContain(fileFor(address));
    }
    for (const address of externalLinks(html)) expect(allowedOutside, address).toContain(address);
    for (const link of page.links) expect(externalLinks(html), link).toContain(link);
  });

  it('keeps out of search engines and asks no other site for anything', () => {
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"\s*\/?>/);
    expect(requestsToOtherSites(html)).toEqual([]);
  });
});

describe('the footer and the header', () => {
  const html = decodeEntities(readPage(OPEN, 'about/index.html'));

  it('link to every page the store has, and to the project', () => {
    for (const address of ['/policies/shipping', '/policies/returns', '/policies/terms', '/contact', '/about']) {
      expect(html, address).toContain(`href="${address}"`);
    }
    expect(html).toContain(`href="${SITE_LINKS.project}">${WORDS['footer.github']}</a>`);
    expect(html).toContain(`href="${SITE_LINKS.guide}">${WORDS['footer.guide']}</a>`);
    expect(html).toContain(WORDS['footer.small']);
    expect(html).toContain(WORDS['site.tagline']);
  });
});

describe('the 404 page with the store closed', () => {
  const html = readPage(CLOSED, '404.html');
  const text = decodeEntities(html);

  it('is as bare as the placeholder: the demo bar and the message, and no header or footer', () => {
    expect(text).toContain(`<h1>${WORDS['notFound.heading']}</h1>`);
    expect(text).toContain(WORDS['notFound.body']);
    expect(text).toContain(WORDS['demo.bar']);
    expect(html).not.toContain('<header');
    expect(html).not.toContain('<footer');
    expect(text).not.toContain(WORDS['demo.link']);
    expect(requestsToOtherSites(html)).toEqual([]);
  });
});
