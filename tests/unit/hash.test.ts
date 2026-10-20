import { describe, expect, it } from 'vitest';
import { hashedUserData, normalizeEmail, normalizePhone, sha256Hex } from '../../src/tracking/hash';

describe('sha256Hex', () => {
  it('turns "abc" into its published SHA-256 fingerprint', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('normalizeEmail', () => {
  it('removes the spaces around an address', () => {
    expect(normalizeEmail('  maya.tremblay@example.com ')).toBe('maya.tremblay@example.com');
  });

  it('lowercases the whole address', () => {
    expect(normalizeEmail('Maya.Tremblay@Example.COM')).toBe('maya.tremblay@example.com');
  });
});

describe('normalizePhone', () => {
  it('keeps only the digits of a number typed with a plus sign', () => {
    expect(normalizePhone('+1 (650) 555-1212')).toBe('16505551212');
  });

  it('keeps the country code of a number outside North America', () => {
    expect(normalizePhone('+44 20 7946 0134')).toBe('442079460134');
  });

  it('ignores spaces around the number, even before the plus sign', () => {
    expect(normalizePhone('  +1 650 555 1212  ')).toBe('16505551212');
  });

  it('sends nothing for a number typed without a plus sign', () => {
    expect(normalizePhone('(650) 555-1212')).toBeUndefined();
  });

  it('sends nothing when no number was typed', () => {
    expect(normalizePhone('')).toBeUndefined();
    expect(normalizePhone('   ')).toBeUndefined();
  });

  it('sends nothing for a plus sign with no digits after it', () => {
    expect(normalizePhone('+')).toBeUndefined();
  });
});

describe('hashedUserData', () => {
  it('fingerprints an email after normalising it', async () => {
    expect(await hashedUserData({ email: ' Maya.Tremblay@Example.com ' })).toStrictEqual({
      sha256_email_address: 'a68414a03cfb6a8136979bfaa406739eeb4a195a60d8345121b38d1c4038140f',
    });
  });

  it('fingerprints a phone number after normalising it', async () => {
    expect(await hashedUserData({ phone: '+1 (650) 555-1212' })).toStrictEqual({
      sha256_phone_number: 'e323ec626319ca94ee8bff2e4c87cf613be6ea19919ed1364124e16807ab3176',
    });
  });

  it('carries both fingerprints when both are given', async () => {
    expect(
      await hashedUserData({ email: 'maya.tremblay@example.com', phone: '+1 514 555 0142' }),
    ).toStrictEqual({
      sha256_email_address: 'a68414a03cfb6a8136979bfaa406739eeb4a195a60d8345121b38d1c4038140f',
      sha256_phone_number: '6a9c58a9dfcba80a675c77de285919183be7afe7ef86a63fdb9a18c64867d42b',
    });
  });

  it('leaves out an email or a phone number that is missing or unusable', async () => {
    expect(await hashedUserData({ email: '   ', phone: '(650) 555-1212' })).toStrictEqual({});
    expect(await hashedUserData({})).toStrictEqual({});
  });
});
