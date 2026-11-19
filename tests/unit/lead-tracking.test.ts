import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announceLead, generateLeadParams, type LeadDetail } from '../../src/tracking/lead-tracking';
import { pushEvent } from '../../src/tracking/push-event';

// What happens when the popup says a lead was kept: the email is turned into its fingerprint, and the lead is announced
// with the code, how the popup was opened and the fingerprint, and nothing else of what was typed. The hashing needs a secure
// page, so a page that cannot make it is tried too: the lead must still be announced, and the problem reported.

const fingerprintOf = (text: string) => createHash('sha256').update(text).digest('hex');

const detail: LeadDetail = {
  firstName: 'Maya',
  email: 'maya.tremblay@example.com',
  marketing: true,
  code: 'WELCOME10',
  source: 'auto',
};

function layer(): Array<Record<string, unknown>> {
  return globalThis.dataLayer as Array<Record<string, unknown>>;
}

beforeEach(() => {
  globalThis.dataLayer = undefined;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A page that is not secure has no crypto.subtle, but still has the rest of crypto, such as the random ids. */
function pageThatCannotHash(): void {
  const real = globalThis.crypto;
  vi.stubGlobal('crypto', { randomUUID: () => real.randomUUID() });
}

describe('announceLead', () => {
  it('announces a generate_lead with the code, how the popup was opened and the fingerprint of the email', async () => {
    await announceLead(detail);
    expect(layer()).toHaveLength(1);
    expect(layer()[0]).toMatchObject({
      event: 'generate_lead',
      coupon: 'WELCOME10',
      source: 'auto',
      user_data: { sha256_email_address: fingerprintOf('maya.tremblay@example.com') },
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it('fingerprints the address as the platforms do, trimmed and in lower case, worked out here independently', async () => {
    await announceLead({ ...detail, email: '  Maya.Tremblay@Example.COM ' });
    expect(layer()[0].user_data).toStrictEqual({ sha256_email_address: fingerprintOf('maya.tremblay@example.com') });
  });

  it('carries how the popup was opened', async () => {
    await announceLead({ ...detail, source: 'manual' });
    expect(layer()[0]).toMatchObject({ source: 'manual' });
  });

  it('never lets what the shopper typed reach the dataLayer: not the name, the address, or the marketing tick', async () => {
    await announceLead(detail);
    const written = JSON.stringify(layer());
    for (const typed of ['Maya', 'maya', 'tremblay', 'example.com', 'marketing']) {
      expect(written, typed).not.toContain(typed);
    }
    expect(layer()[0]).not.toHaveProperty('firstName');
    expect(layer()[0]).not.toHaveProperty('email');
    expect(layer()[0]).not.toHaveProperty('marketing');
  });

  it('gives the lead its own event_id, and keeps it out of any ecommerce box', async () => {
    await announceLead(detail);
    expect(layer()[0].event_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(layer()[0]).not.toHaveProperty('ecommerce');
  });

  it('announces each lead once, and a second lead as a second announcement', async () => {
    await announceLead(detail);
    await announceLead({ ...detail, email: 'jordan.ellis@example.org' });
    expect(layer()).toHaveLength(2);
    const [first, second] = layer().map((entry) => (entry.user_data as Record<string, string>).sha256_email_address);
    expect(first).toBe(fingerprintOf('maya.tremblay@example.com'));
    expect(second).toBe(fingerprintOf('jordan.ellis@example.org'));
  });

  it('announces the lead without user_data, and says why, when the page cannot make the fingerprint', async () => {
    pageThatCannotHash();
    await announceLead(detail);
    expect(layer()).toHaveLength(1);
    expect(layer()[0]).toMatchObject({ event: 'generate_lead', coupon: 'WELCOME10', source: 'auto' });
    expect(layer()[0]).not.toHaveProperty('user_data');
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(console.error).mock.calls[0][0])).toMatch(/generate_lead.*fingerprint/i);
  });

  it('never repeats the address in the report of a fingerprint that failed, nor anywhere else', async () => {
    pageThatCannotHash();
    await announceLead(detail);
    const everything = JSON.stringify([layer(), vi.mocked(console.error).mock.calls]);
    for (const typed of ['maya', 'tremblay', 'example.com']) expect(everything, typed).not.toContain(typed);
  });

  it('reports a fingerprint that failed with its own message, and not the browser\'s, which could name what was hashed', async () => {
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockRejectedValue(new Error('could not hash maya.tremblay@example.com'));
    await announceLead(detail);
    expect(layer()[0]).not.toHaveProperty('user_data');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('maya');
  });

  it('leaves user_data out, without a report, when there was no address to fingerprint', async () => {
    await announceLead({ ...detail, email: '   ' });
    expect(layer()).toHaveLength(1);
    expect(layer()[0]).not.toHaveProperty('user_data');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('does not throw, and says so, when the lead has no code or source, and still announces what it has', async () => {
    await expect(announceLead({ ...detail, code: '' })).resolves.toBeUndefined();
    expect(layer()).toHaveLength(1);
    expect(layer()[0]).not.toHaveProperty('coupon');
    expect(String(vi.mocked(console.error).mock.calls[0][0])).toContain('coupon');
  });

  it('does not throw when the page will not let it write to the dataLayer', async () => {
    globalThis.dataLayer = Object.freeze([]) as unknown as unknown[];
    await expect(announceLead(detail)).resolves.toBeUndefined();
  });
});

describe('generateLeadParams', () => {
  const FINGERPRINT = 'a68414a03cfb6a8136979bfaa406739eeb4a195a60d8345121b38d1c4038140f';
  // What the popup announces: the shopper's details are in it so the listener can fingerprint the email, and none of them
  // is meant to reach the dataLayer.
  const popup = {
    firstName: 'Maya',
    email: 'maya.tremblay@example.com',
    marketing: true,
    code: 'WELCOME10',
    source: 'auto',
  };

  it('carries the code the popup issued and how the popup was opened, and nothing the shopper typed', () => {
    expect(generateLeadParams(popup)).toStrictEqual({ coupon: 'WELCOME10', source: 'auto' });
    const written = JSON.stringify(generateLeadParams(popup, { sha256_email_address: FINGERPRINT }));
    for (const typed of ['Maya', 'maya.tremblay@example.com', 'marketing']) expect(written).not.toContain(typed);
  });

  it('adds the email fingerprint, which the caller makes, and leaves user_data out when there is none', () => {
    expect(generateLeadParams(popup, { sha256_email_address: FINGERPRINT })).toStrictEqual({
      coupon: 'WELCOME10',
      source: 'auto',
      user_data: { sha256_email_address: FINGERPRINT },
    });
    expect(generateLeadParams(popup)).not.toHaveProperty('user_data');
  });

  it('keeps how the popup was opened', () => {
    expect(generateLeadParams({ ...popup, source: 'manual' }).source).toBe('manual');
  });

  it('is a complete generate_lead announcement, with a fingerprint and without one', () => {
    for (const userData of [{ sha256_email_address: FINGERPRINT }, undefined]) {
      globalThis.dataLayer = undefined;
      const result = pushEvent('generate_lead', generateLeadParams(popup, userData));
      expect(result.problems, String(userData)).toStrictEqual([]);
      expect(layer()[0]).toMatchObject({ event: 'generate_lead', coupon: 'WELCOME10', source: 'auto' });
    }
  });
});
