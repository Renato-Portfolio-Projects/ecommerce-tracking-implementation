import { describe, expect, it } from 'vitest';
import { welcomeCoupon } from '../../src/engine/coupons';
import { fill } from '../../src/engine/fill';
import { CART_LIFETIME_DAYS } from '../../src/store/policy';
import { WORDS } from '../../src/store/words';
import { OPEN, decodeEntities, htmlFiles, readPage } from '../helpers/built';

const welcome = welcomeCoupon()!;
const percent = welcome.percentOff;
const built = htmlFiles(OPEN);
const pages = built.filter((file) => readPage(OPEN, file).includes('<header class="header">'));

/** What the footer link and the tab say, as the store's words fill it in for the welcome code. */
const offer = fill(WORDS['popup.reopen'], { percent });
/** The text as a pattern that matches only itself, so it can sit inside a longer pattern. */
const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const popupOf = (html: string) => html.match(/<dialog class="lead-popup"[\s\S]*?<\/dialog>/)![0];
const footerOf = (html: string) => html.match(/<footer class="footer">[\s\S]*?<\/footer>/)![0];

describe('the lead popup, before any script has opened it', () => {
  it('is on every page that has the store\'s header, once, and closed', () => {
    expect(pages.length).toBeGreaterThan(10);
    for (const file of pages) {
      const html = readPage(OPEN, file);
      expect(html.match(/<dialog class="lead-popup"/g), file).toHaveLength(1);
      expect(html, file).not.toMatch(/<dialog class="lead-popup"[^>]*\sopen[\s>=]/);
    }
  });

  it('opens by itself on the home page and on no other page', () => {
    for (const file of pages) {
      const marked = /<dialog class="lead-popup"[^>]*data-lead-auto/.test(readPage(OPEN, file));
      expect(marked, file).toBe(file === 'index.html');
    }
  });

  it('is named by its own heading, which says the welcome offer in the store\'s words', () => {
    const popup = decodeEntities(popupOf(readPage(OPEN, 'index.html')));
    expect(popup).toContain('aria-labelledby="lead-popup-title"');
    expect(popup.match(/id="lead-popup-title"/g)).toHaveLength(1);
    expect(popup).toContain(`>${fill(WORDS['popup.title'], { percent })}</h2>`);
    expect(popup).toContain(`<p class="lead-body">${WORDS['popup.body']}</p>`);
  });

  it('asks for a first name and an email, each with a label, and the browser can fill them in', () => {
    const popup = popupOf(readPage(OPEN, 'index.html'));
    expect(popup).toContain(`<label for="lead-first-name">${WORDS['popup.firstName']}</label>`);
    expect(popup).toMatch(/<input id="lead-first-name" name="firstName" type="text" autocomplete="given-name" required autofocus/);
    expect(popup).toContain(`<label for="lead-email">${WORDS['popup.email']}</label>`);
    expect(popup).toMatch(/<input id="lead-email" name="email" type="email" inputmode="email" autocomplete="email"/);
  });

  it('has a marketing box that is never ticked, with its own words', () => {
    for (const file of pages) {
      const popup = popupOf(readPage(OPEN, file));
      expect(popup, file).toMatch(/<input type="checkbox" name="marketing"\s*\/?>/);
      expect(popup, file).not.toMatch(/\schecked[\s=>]/);
    }
    expect(decodeEntities(popupOf(readPage(OPEN, 'index.html')))).toContain(`<span>${WORDS['popup.marketing']}</span>`);
  });

  it('is checked by script and never sends what is typed in an address', () => {
    const popup = popupOf(readPage(OPEN, 'index.html'));
    expect(popup).toMatch(/<form class="lead-form" method="post" novalidate/);
    expect(popup).not.toMatch(/method="get"/i);
  });

  it('has its buttons and its note in the store\'s words, and the note says how long a made-up lead is kept', () => {
    const popup = decodeEntities(popupOf(readPage(OPEN, 'index.html')));
    expect(popup).toContain(`>${WORDS['popup.submit']}</button>`);
    expect(popup).toContain(`>${WORDS['popup.demoButton']}</button>`);
    expect(popup).toContain(`>${WORDS['popup.newPerson']}</button>`);
    expect(popup).toContain(`>${WORDS['popup.noThanks']}</button>`);
    expect(popup).toContain(`<p class="lead-note">${fill(WORDS['popup.demoNote'], { days: CART_LIFETIME_DAYS })}</p>`);
  });

  it('can be closed by its own button and by No thanks, and says which was used', () => {
    const popup = decodeEntities(popupOf(readPage(OPEN, 'index.html')));
    expect(popup).toContain(`data-lead-close="close-button" aria-label="${WORDS['popup.close']}"`);
    expect(popup).toMatch(/data-lead-close="no-thanks">/);
    expect(popup.match(/data-lead-close=/g)).toHaveLength(2);
  });

  it('gives the demo button a tracking label, and Try another person none, since it is not a business action', () => {
    const popup = popupOf(readPage(OPEN, 'index.html'));
    expect(popup).toMatch(/<button type="button" class="link-button" data-lead-demo data-cta="Demo Data - Lead popup">/);
    const newPerson = popup.match(/<button[^>]*data-lead-new-person[^>]*>/)![0];
    expect(newPerson).toContain('hidden');
    expect(newPerson).not.toContain('data-cta');
    expect(popup.match(/data-cta=/g)).toHaveLength(1);
  });

  it('gives its script the sentences it fills in, and not the code', () => {
    const html = readPage(OPEN, 'index.html');
    const match = popupOf(html).match(/data-words="([^"]*)"/);
    expect(match).not.toBeNull();
    const words = JSON.parse(decodeEntities(match![1]));
    expect(words).toEqual({
      demoAnnounce: WORDS['popup.demoAnnounce'],
      success: WORDS['popup.success'],
      percent: String(percent),
    });
    expect(words.success).toContain('{code}');
  });

  it('keeps the welcome code out of every page: it is shown only after the form is accepted', () => {
    for (const file of built) {
      expect(readPage(OPEN, file), file).not.toContain(welcome.code);
    }
  });

  it('has a place for the success message, hidden until the script fills it in', () => {
    const popup = popupOf(readPage(OPEN, 'index.html'));
    expect(popup).toMatch(/<div class="lead-success" data-lead-success hidden tabindex="-1" role="status">\s*<p data-lead-success-text><\/p>/);
  });
});

describe('the two ways to open the lead popup by hand', () => {
  it('has a link in the footer of every store page, once, that says the offer and not the code', () => {
    for (const file of pages) {
      const footer = decodeEntities(footerOf(readPage(OPEN, file)));
      expect(footer.match(/data-lead-open="footer"/g), file).toHaveLength(1);
      expect(footer, file).toMatch(
        new RegExp(`<button type="button" class="link-button" data-lead-open="footer" data-cta="Lead Popup - Footer link" aria-haspopup="dialog">\\s*${literal(offer)}\\s*</button>`),
      );
      expect(footer, file).not.toContain(welcome.code);
    }
  });

  it('puts the footer link in the first block, under the store name and tagline', () => {
    const footer = footerOf(readPage(OPEN, 'index.html'));
    const tagline = footer.indexOf(WORDS['site.tagline']);
    const link = footer.indexOf('data-lead-open="footer"');
    const demoHeading = footer.indexOf(WORDS['footer.demoHeading']);
    expect(tagline).toBeGreaterThan(-1);
    expect(link).toBeGreaterThan(tagline);
    expect(link).toBeLessThan(demoHeading);
  });

  it('has a small tab on every store page, once, hidden until the script decides a reminder belongs', () => {
    for (const file of pages) {
      const html = decodeEntities(readPage(OPEN, file));
      expect(html.match(/data-lead-open="tab"/g), file).toHaveLength(1);
      expect(html, file).toMatch(
        new RegExp(`<button type="button" class="lead-tab" data-lead-open="tab" data-cta="Lead Popup - Corner tab" aria-haspopup="dialog" hidden>\\s*${literal(offer)}\\s*</button>`),
      );
    }
  });

  // Nothing here writes the percentage in by hand, so a new welcome code changes the pages and these tests still pass.
  it('follows the store\'s welcome code, so a new offer changes every place that names it', () => {
    for (const file of pages) {
      const html = decodeEntities(readPage(OPEN, file));
      expect(html, file).toContain(offer);
      expect(html, file).toContain(fill(WORDS['popup.title'], { percent }));
    }
  });
});
