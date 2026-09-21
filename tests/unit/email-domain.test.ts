import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEMO_EMAIL_DOMAINS,
  checkEmailDomain,
  emailDomainOf,
  isDisposableDomain,
  parseDomainList,
  type MailService,
} from '../../src/shop/email-domain';

const TEMPORARY = 'That looks like a temporary email address. Please use one you check regularly.';
const NO_MAIL = "It looks like that address can't receive email. Please check the part after the @ for typos.";

const list = new Set(['mailinator.com', 'yopmail.com', 'temp.example.org', 'burner.co.uk']);
const check = (email: unknown, mailService: MailService = 'accepts-mail', disposableDomains = list) =>
  checkEmailDomain(email, { disposableDomains, mailService });

describe('emailDomainOf', () => {
  it('gives the part after the @, in lowercase', () => {
    expect(emailDomainOf('maya@example.com')).toBe('example.com');
    expect(emailDomainOf(' Maya@Mail.EXAMPLE.Com ')).toBe('mail.example.com');
    expect(emailDomainOf('a@b@c.org')).toBe('c.org');
  });

  it('gives nothing for something that has no domain or is not text', () => {
    for (const value of ['', 'maya', 'maya@', undefined, null, 42, {}]) {
      expect(emailDomainOf(value), String(value)).toBe('');
    }
  });
});

describe('parseDomainList', () => {
  it('reads one domain from each line, ignoring blank lines and lines that start with #', () => {
    const text = '# a comment\nMailinator.com\n\n  yopmail.com  \r\n# another\nburner.co.uk\r\nmailinator.com\n';
    expect([...parseDomainList(text)].sort()).toEqual(['burner.co.uk', 'mailinator.com', 'yopmail.com']);
  });
});

describe('isDisposableDomain', () => {
  it('finds a listed domain, in any case', () => {
    expect(isDisposableDomain('mailinator.com', list)).toBe(true);
    expect(isDisposableDomain('MAILINATOR.com', list)).toBe(true);
    expect(isDisposableDomain('burner.co.uk', list)).toBe(true);
  });

  it('also finds any sub-domain of a listed domain', () => {
    expect(isDisposableDomain('inbox.mailinator.com', list)).toBe(true);
    expect(isDisposableDomain('a.b.c.yopmail.com', list)).toBe(true);
    expect(isDisposableDomain('x.burner.co.uk', list)).toBe(true);
  });

  it('does not catch a domain that only looks similar, or a parent of a listed one', () => {
    for (const domain of ['notmailinator.com', 'mailinator.com.au', 'mailinator.org', 'mailinator', 'co.uk', 'example.org', 'gmail.com', '']) {
      expect(isDisposableDomain(domain, list), domain).toBe(false);
    }
    // temp.example.org is listed, but example.org is not.
    expect(isDisposableDomain('temp.example.org', list)).toBe(true);
    expect(isDisposableDomain('example.org', list)).toBe(false);
  });

  it('never matches on a last part alone, even if the list held one', () => {
    expect(isDisposableDomain('anything.com', new Set(['com']))).toBe(false);
  });
});

describe('checkEmailDomain', () => {
  it('lets an ordinary address through when its domain takes mail', () => {
    expect(check('maya@gmail.com')).toEqual({ ok: true });
    expect(check('maya@my-shop.co.uk', 'accepts-mail')).toEqual({ ok: true });
  });

  it('turns down a temporary address, even when its domain takes mail', () => {
    expect(check('maya@mailinator.com')).toEqual({ ok: false, problem: { field: 'email', message: TEMPORARY } });
    expect(check('maya@inbox.mailinator.com', 'accepts-mail')).toEqual({ ok: false, problem: { field: 'email', message: TEMPORARY } });
  });

  it('turns down an address whose domain cannot receive email', () => {
    expect(check('maya@gmial-typo.com', 'no-mail')).toEqual({ ok: false, problem: { field: 'email', message: NO_MAIL } });
  });

  it('says it is temporary rather than unreachable when both are true', () => {
    expect(check('maya@mailinator.com', 'no-mail')).toEqual({ ok: false, problem: { field: 'email', message: TEMPORARY } });
  });

  it('lets an address through when the look at its domain failed, so a hiccup never blocks a real customer', () => {
    expect(check('maya@gmail.com', 'unknown')).toEqual({ ok: true });
    // Only the failed look is excused. A temporary address is still turned down.
    expect(check('maya@mailinator.com', 'unknown').ok).toBe(false);
  });

  it('accepts the demo domains without any mail check, so the demo people work', () => {
    expect(DEMO_EMAIL_DOMAINS).toEqual(['example.com', 'example.org', 'example.net']);
    for (const domain of DEMO_EMAIL_DOMAINS) {
      expect(check(`maya@${domain}`, 'no-mail'), domain).toEqual({ ok: true });
      expect(check(`maya@${domain.toUpperCase()}`, 'no-mail'), domain).toEqual({ ok: true });
      // Even if a list held them.
      expect(check(`maya@${domain}`, 'no-mail', new Set([domain])), domain).toEqual({ ok: true });
    }
  });

  it('gives the demo exemption to those domains only, not to their sub-domains or to names that end the same way', () => {
    expect(check('maya@mail.example.com', 'no-mail').ok).toBe(false);
    expect(check('maya@notexample.com', 'no-mail').ok).toBe(false);
    expect(check('maya@example.com.au', 'no-mail').ok).toBe(false);
  });

  it('turns down an address with no domain at all, as one that cannot receive email', () => {
    for (const email of ['', 'maya', 'maya@', undefined, null, 5]) {
      expect(check(email), String(email)).toEqual({ ok: false, problem: { field: 'email', message: NO_MAIL } });
    }
  });
});

describe('the list of temporary email domains kept in the repo', () => {
  const text = readFileSync(new URL('../../src/data/disposable-email-domains.txt', import.meta.url), 'utf8');
  const lines = text.split(/\r?\n/);
  const comments = lines.filter((line) => line.startsWith('#'));
  const domains = lines.filter((line) => line !== '' && !line.startsWith('#'));
  const parsed = parseDomainList(text);

  it('says where it came from, under what licence and when, and how many domains it holds', () => {
    const header = comments.join('\n');
    expect(header).toContain('https://github.com/disposable-email-domains/disposable-email-domains');
    expect(header).toContain('CC0');
    expect(header).toMatch(/Copied on \d{4}-\d{2}-\d{2}/);
    expect(header).toContain(`It has ${domains.length} domains`);
  });

  it('holds thousands of domains, each once, in lowercase and shaped like a domain', () => {
    expect(domains.length).toBeGreaterThan(5000);
    expect(parsed.size).toBe(domains.length);
    for (const domain of domains) expect(domain, domain).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/);
  });

  it('catches the well-known temporary email services, and their sub-domains', () => {
    for (const domain of ['mailinator.com', '10minutemail.com', 'guerrillamail.com', 'yopmail.com', 'sharklasers.com']) {
      expect(isDisposableDomain(domain, parsed), domain).toBe(true);
      expect(isDisposableDomain(`inbox.${domain}`, parsed), domain).toBe(true);
    }
  });

  it('leaves alone the big mail providers, the privacy relays real customers use, and the demo domains', () => {
    const fine = [
      'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'proton.me', 'protonmail.com', 'fastmail.com',
      'privaterelay.appleid.com', 'duck.com', 'relay.firefox.com', 'simplelogin.com', 'anonaddy.com',
      'example.com', 'example.org', 'example.net', 'bell.net', 'rogers.com', 'sympatico.ca', 'orange.fr', 'gmx.de', 'web.de', 'libero.it',
    ];
    for (const domain of fine) expect(isDisposableDomain(domain, parsed), domain).toBe(false);
  });
});

describe('email domain checks that hold for any domain', () => {
  // A small seeded generator, so the "random" domains are the same on every run.
  function seeded(seed: number) {
    let state = seed;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const words = ['mail', 'box', 'temp', 'inbox', 'shop', 'post', 'co', 'uk', 'com', 'org', 'fr', 'de', 'net'];
  const smallList = ['temp.com', 'inbox.co.uk', 'box.org', 'mail.de', 'post.net'];

  function randomDomain(random: () => number): string {
    const parts = 1 + Math.floor(random() * 4);
    const domain = Array.from({ length: parts }, () => words[Math.floor(random() * words.length)]).join('.');
    // Often put a listed domain on the end, so a good share of the domains are ones the list should catch.
    return random() < 0.3 ? `${domain}.${smallList[Math.floor(random() * smallList.length)]}` : domain;
  }

  it('finds a domain in the list exactly when it is a listed domain or ends with a dot and one', () => {
    const random = seeded(2026);
    const set = new Set(smallList);
    let caught = 0;
    let passed = 0;
    for (let i = 0; i < 2000; i += 1) {
      const domain = randomDomain(random);
      // A simple second way to work it out: the domain is a listed one, or ends with ".listed".
      const expected = smallList.some((entry) => domain === entry || domain.endsWith(`.${entry}`));
      expect(isDisposableDomain(domain, set), domain).toBe(expected);
      if (expected) caught += 1;
      else passed += 1;
    }
    // Both outcomes must really happen, or the run proves nothing.
    expect(caught).toBeGreaterThan(50);
    expect(passed).toBeGreaterThan(500);
  });

  it('follows the same order of decisions for every combination: demo first, then temporary, then unreachable', () => {
    const random = seeded(77);
    const set = new Set(smallList);
    const services: MailService[] = ['accepts-mail', 'no-mail', 'unknown'];
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i += 1) {
      const domain = random() < 0.15 ? DEMO_EMAIL_DOMAINS[Math.floor(random() * 3)] : randomDomain(random);
      const service = services[Math.floor(random() * 3)];
      const result = checkEmailDomain(`maya@${domain}`, { disposableDomains: set, mailService: service });

      const demo = DEMO_EMAIL_DOMAINS.includes(domain);
      const temporary = smallList.some((entry) => domain === entry || domain.endsWith(`.${entry}`));
      const expected = demo ? 'ok' : temporary ? TEMPORARY : service === 'no-mail' ? NO_MAIL : 'ok';
      expect(result.ok ? 'ok' : result.problem.message, `${domain} ${service}`).toBe(expected);
      seen.add(expected);
    }
    expect([...seen].sort()).toEqual([NO_MAIL, TEMPORARY, 'ok'].sort());
  });
});
