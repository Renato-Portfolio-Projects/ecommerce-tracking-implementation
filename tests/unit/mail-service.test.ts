import { describe, expect, it } from 'vitest';
import { mailServiceOf, type DnsResolver } from '../../src/server/mail-service';

const fault = (code: string) => Object.assign(new Error(code), { code });

/** A resolver that answers from a plan, and remembers what it was asked. */
function resolver(plan: { mx?: unknown; a?: unknown; aaaa?: unknown }) {
  const asked: string[] = [];
  const answer = (name: string, value: unknown) => async (domain: string) => {
    asked.push(`${name} ${domain}`);
    if (value instanceof Error) throw value;
    return value as never;
  };
  const dns: DnsResolver = {
    resolveMx: answer('MX', plan.mx ?? []),
    resolve4: answer('A', plan.a ?? []),
    resolve6: answer('AAAA', plan.aaaa ?? []),
  };
  return { dns, asked };
}

const server = { exchange: 'mx.example.net', priority: 10 };

describe('a domain that names a mail server', () => {
  it('accepts mail, and only the MX record is asked about', async () => {
    const r = resolver({ mx: [server] });
    expect(await mailServiceOf('shop.test', r.dns)).toBe('accepts-mail');
    expect(r.asked).toEqual(['MX shop.test']);
  });

  it('accepts mail whatever the priorities, and when several are named', async () => {
    expect(await mailServiceOf('a.test', resolver({ mx: [{ ...server, priority: 20 }, server] }).dns)).toBe('accepts-mail');
  });
});

describe('a domain that says it takes no mail (RFC 7505, "null MX")', () => {
  it('takes no mail when its only MX record is the single dot, however the resolver writes it', async () => {
    for (const exchange of ['', '.']) {
      expect(await mailServiceOf('none.test', resolver({ mx: [{ exchange, priority: 0 }] }).dns), JSON.stringify(exchange)).toBe('no-mail');
    }
  });

  it('is not taken to say so when the dot is only one of several records', async () => {
    expect(await mailServiceOf('mixed.test', resolver({ mx: [{ exchange: '.', priority: 0 }, server] }).dns)).toBe('accepts-mail');
  });
});

describe('a domain with no MX record but an address record (RFC 5321, section 5.1)', () => {
  it('accepts mail when it has an IPv4 address, or only an IPv6 one', async () => {
    expect(await mailServiceOf('a.test', resolver({ mx: fault('ENODATA'), a: ['192.0.2.1'], aaaa: fault('ENODATA') }).dns)).toBe('accepts-mail');
    expect(await mailServiceOf('b.test', resolver({ mx: fault('ENODATA'), a: fault('ENODATA'), aaaa: ['2001:db8::1'] }).dns)).toBe('accepts-mail');
  });

  it('is treated the same when the MX look-up answers with an empty list instead of an error', async () => {
    expect(await mailServiceOf('c.test', resolver({ mx: [], a: ['192.0.2.1'] }).dns)).toBe('accepts-mail');
  });

  it('takes no mail when it has neither, as the name system says so plainly', async () => {
    expect(await mailServiceOf('d.test', resolver({ mx: fault('ENODATA'), a: fault('ENODATA'), aaaa: fault('ENODATA') }).dns)).toBe('no-mail');
    expect(await mailServiceOf('e.test', resolver({ mx: fault('ENODATA'), a: fault('ENOTFOUND'), aaaa: [] }).dns)).toBe('no-mail');
    expect(await mailServiceOf('f.test', resolver({ mx: [] }).dns)).toBe('no-mail');
  });

  it('is not known when one of the two address look-ups failed some other way and the other found nothing', async () => {
    expect(await mailServiceOf('g.test', resolver({ mx: fault('ENODATA'), a: fault('ESERVFAIL'), aaaa: fault('ENODATA') }).dns)).toBe('unknown');
    expect(await mailServiceOf('h.test', resolver({ mx: fault('ENODATA'), a: [], aaaa: fault('ETIMEOUT') }).dns)).toBe('unknown');
  });

  it('accepts mail when one address look-up failed but the other found an address', async () => {
    expect(await mailServiceOf('i.test', resolver({ mx: fault('ENODATA'), a: fault('ESERVFAIL'), aaaa: ['2001:db8::1'] }).dns)).toBe('accepts-mail');
  });
});

describe('a domain that does not exist', () => {
  it('takes no mail, and nothing more is asked', async () => {
    const r = resolver({ mx: fault('ENOTFOUND') });
    expect(await mailServiceOf('no-such-domain.test', r.dns)).toBe('no-mail');
    expect(r.asked).toEqual(['MX no-such-domain.test']);
  });
});

describe('a look-up that fails', () => {
  it('is not known, whatever the fault, and never throws', async () => {
    for (const code of ['ESERVFAIL', 'ETIMEOUT', 'ECONNREFUSED', 'EREFUSED', 'ECANCELLED', 'SOMETHING']) {
      expect(await mailServiceOf('x.test', resolver({ mx: fault(code) }).dns), code).toBe('unknown');
    }
    const odd: DnsResolver = {
      resolveMx: async () => Promise.reject('a string, not an error'),
      resolve4: async () => [],
      resolve6: async () => [],
    };
    expect(await mailServiceOf('x.test', odd)).toBe('unknown');
  });

  it('is not known when the name system takes longer than the limit, and it does not wait past it', async () => {
    const never: DnsResolver = {
      resolveMx: () => new Promise(() => {}),
      resolve4: () => new Promise(() => {}),
      resolve6: () => new Promise(() => {}),
    };
    const started = Date.now();
    expect(await mailServiceOf('slow.test', never, 40)).toBe('unknown');
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('answers as soon as the name system does, not after the limit', async () => {
    const started = Date.now();
    expect(await mailServiceOf('quick.test', resolver({ mx: [server] }).dns, 5000)).toBe('accepts-mail');
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
