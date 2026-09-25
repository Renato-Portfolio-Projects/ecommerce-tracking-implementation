import type { MailService } from '../engine/email-domain.js';

/**
 * What the server asks of the name system to learn whether a domain can receive email. Node's own resolver has
 * these three methods, and a test passes its own, so no test touches the network. Only the part of an address after
 * the @ is ever looked up: the address itself, and the name in it, never leave the server.
 */
export interface DnsResolver {
  resolveMx(domain: string): Promise<{ exchange: string; priority: number }[]>;
  resolve4(domain: string): Promise<string[]>;
  resolve6(domain: string): Promise<string[]>;
}

/** How long the server waits before it gives up on the look-up and lets the address through. */
export const MAIL_LOOKUP_TIMEOUT_MS = 2000;

const errorCode = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';

/**
 * Whether a domain can receive email: `accepts-mail`, `no-mail`, or `unknown` when the look-up failed or took too
 * long. It follows the rules for mail delivery:
 * - A domain that names a mail server (an MX record) accepts mail.
 * - A domain whose only MX record is the single dot says, in words the standard gives it (RFC 7505, "null MX"),
 *   that it takes no mail.
 * - A domain with no MX record, but an address record (A or AAAA), is treated as if it named itself as its mail
 *   server (RFC 5321, section 5.1), so it accepts mail.
 * - A domain that does not exist, or that has neither, takes no mail.
 * - Anything else, such as a server that does not answer, is `unknown`, and the caller lets the address through, so a
 *   hiccup never blocks a real customer.
 */
export async function mailServiceOf(domain: string, resolver: DnsResolver, timeoutMs = MAIL_LOOKUP_TIMEOUT_MS): Promise<MailService> {
  const addressRecords = async (): Promise<MailService> => {
    const [four, six] = await Promise.allSettled([resolver.resolve4(domain), resolver.resolve6(domain)]);
    if ((four.status === 'fulfilled' && four.value.length > 0) || (six.status === 'fulfilled' && six.value.length > 0)) return 'accepts-mail';
    // Both said there is no such record. If either failed some other way, it is not known.
    const said = (result: PromiseSettledResult<string[]>) =>
      result.status === 'fulfilled' || ['ENODATA', 'ENOTFOUND'].includes(errorCode(result.reason));
    return said(four) && said(six) ? 'no-mail' : 'unknown';
  };

  const look = async (): Promise<MailService> => {
    try {
      const records = await resolver.resolveMx(domain);
      if (records.length === 0) return await addressRecords();
      if (records.length === 1 && (records[0].exchange === '' || records[0].exchange === '.')) return 'no-mail';
      return 'accepts-mail';
    } catch (error) {
      const code = errorCode(error);
      if (code === 'ENOTFOUND') return 'no-mail';
      if (code === 'ENODATA') return await addressRecords();
      return 'unknown';
    }
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const tooLong = new Promise<MailService>((resolve) => {
    timer = setTimeout(() => resolve('unknown'), timeoutMs);
  });
  try {
    return await Promise.race([look().catch((): MailService => 'unknown'), tooLong]);
  } finally {
    clearTimeout(timer);
  }
}
