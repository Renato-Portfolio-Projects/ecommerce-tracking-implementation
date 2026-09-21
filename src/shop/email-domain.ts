import type { FieldProblem } from './checkout-form';

// The checks on an email's domain. They run on the server, after the shape of the address has been
// accepted, because they need a list and a look at the domain's mail service. Only the domain, the
// part after the @, is ever looked up, and no email address is sent to anyone else. The list of
// temporary domains is a file in the repo, and the look at the mail service is done by the server
// and passed in, so all of this can be tested without a network.

/**
 * Reserved for examples, so they can never belong to anyone and never receive mail. The demo people
 * use example.com. These domains are accepted without any mail check, so the demo works. Every other
 * domain has to pass the real checks.
 */
export const DEMO_EMAIL_DOMAINS = ['example.com', 'example.org', 'example.net'];

/**
 * What a look at the domain's mail service found.
 * - `accepts-mail`: it has a mail server, or, with none named, an address a mail server could be at.
 * - `no-mail`: the domain does not exist, or says it takes no mail.
 * - `unknown`: the look failed or timed out. The address is let through, so a hiccup never blocks a
 *   real customer.
 */
export type MailService = 'accepts-mail' | 'no-mail' | 'unknown';

export interface EmailDomainOptions {
  /** The temporary domains, from `parseDomainList`. */
  disposableDomains: ReadonlySet<string>;
  mailService: MailService;
}

export type EmailDomainCheck = { ok: true } | { ok: false; problem: FieldProblem };

const TEMPORARY = 'That looks like a temporary email address. Please use one you check regularly.';
const NO_MAIL = "It looks like that address can't receive email. Please check the part after the @ for typos.";

const problem = (message: string): EmailDomainCheck => ({ ok: false, problem: { field: 'email', message } });

/** The part after the last @, in lowercase. Empty when there is none, or when the value is not text. */
export function emailDomainOf(email: unknown): string {
  if (typeof email !== 'string') return '';
  const text = email.trim();
  const at = text.lastIndexOf('@');
  return at === -1 ? '' : text.slice(at + 1).toLowerCase();
}

/** Reads a list with one domain on each line. Blank lines and lines that start with # are skipped. */
export function parseDomainList(text: string): Set<string> {
  const domains = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const domain = line.trim().toLowerCase();
    if (domain !== '' && !domain.startsWith('#')) domains.add(domain);
  }
  return domains;
}

/**
 * Whether a domain is on the list, or is a sub-domain of one that is. A last part alone, such as
 * `com`, is never looked up, so a stray entry cannot catch a whole ending.
 */
export function isDisposableDomain(domain: string, list: ReadonlySet<string>): boolean {
  const parts = domain.toLowerCase().split('.');
  for (let start = 0; start < parts.length - 1; start += 1) {
    if (list.has(parts.slice(start).join('.'))) return true;
  }
  return false;
}

/**
 * Checks the domain of an email that has already passed the shape check. The demo domains come
 * first, then temporary domains, then domains that cannot receive email. An address with no domain
 * cannot receive email either.
 */
export function checkEmailDomain(email: unknown, options: EmailDomainOptions): EmailDomainCheck {
  const domain = emailDomainOf(email);
  if (domain === '') return problem(NO_MAIL);
  if (DEMO_EMAIL_DOMAINS.includes(domain)) return { ok: true };
  if (isDisposableDomain(domain, options.disposableDomains)) return problem(TEMPORARY);
  if (options.mailService === 'no-mail') return problem(NO_MAIL);
  return { ok: true };
}
