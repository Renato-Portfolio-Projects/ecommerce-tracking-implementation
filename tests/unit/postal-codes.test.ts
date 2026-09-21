import { describe, expect, it } from 'vitest';
import { COUNTRIES, type CountryCode } from '../../src/shop/destinations';
import { POSTAL_CODE_FORMATS, checkPostalCode, postalCodeHelp } from '../../src/shop/postal-codes';

/** Each row: what is typed, then how it is kept. */
const accepted: Record<CountryCode, [typed: string, kept: string][]> = {
  CA: [
    ['K1A 0B1', 'K1A 0B1'],
    ['k1a0b1', 'K1A 0B1'],
    ['  h2j   3k4 ', 'H2J 3K4'],
    ['V8X 3X4', 'V8X 3X4'],
    ['T0L 1K0', 'T0L 1K0'],
  ],
  US: [
    ['95014', '95014'],
    ['22162-1010', '22162-1010'],
    ['22162 1010', '22162-1010'],
  ],
  GB: [
    ['EC1A 1HQ', 'EC1A 1HQ'],
    ['ec1a1hq', 'EC1A 1HQ'],
    ['M2 5BQ', 'M2 5BQ'],
    ['m25bq', 'M2 5BQ'],
    ['W1A 4ZZ', 'W1A 4ZZ'],
    ['SE15 4QT', 'SE15 4QT'],
    ['CR0 2YR', 'CR0 2YR'],
    ['B6 5BA', 'B6 5BA'],
    ['gir0aa', 'GIR 0AA'],
  ],
  FR: [
    ['33380', '33380'],
    ['75 001', '75001'],
  ],
  DE: [
    ['26133', '26133'],
    ['10115', '10115'],
  ],
  IE: [
    ['A65 F4E2', 'A65 F4E2'],
    ['a65f4e2', 'A65 F4E2'],
    ['D6W AB12', 'D6W AB12'],
  ],
  IT: [
    ['00144', '00144'],
    ['47037', '47037'],
  ],
  NL: [
    ['1234 AB', '1234 AB'],
    ['1234ab', '1234 AB'],
    ['2490 AA', '2490 AA'],
    ['1234 SB', '1234 SB'],
  ],
  ES: [
    ['28039', '28039'],
    ['08001', '08001'],
  ],
};

const rejected: Record<CountryCode, string[]> = {
  CA: ['D1A 0B1', 'W1A 0B1', 'Z1A 0B1', 'K1I 0B1', 'K1A 0U1', 'K1A 0B', 'K1A 0B11', '12345', 'K1A-0B1', ''],
  US: ['9501', '950145', '95014-', '95014-101', '95014-10101', 'ABCDE', ''],
  GB: ['12345', 'EC1A', 'EC1A 1H', 'EC1A 1HC', 'EC1A 1HM', '1EC1 1HQ', ''],
  FR: ['3338', '333800', '3338A', '33 3800', ''],
  DE: ['2613', '261334', '2613 3', 'D-26133', ''],
  IE: ['A65', 'A65 F4E', 'A65 F4E22', '165 F4E2', 'A6 F4E2', ''],
  IT: ['0014', '001444', ''],
  NL: ['0123 AB', '1234 A', '1234 ABC', 'AB 1234', '1234 SA', '1234 SD', '1234 SS', ''],
  ES: ['2803', '280390', '28 039', ''],
};

describe('POSTAL_CODE_FORMATS', () => {
  it('has one format for each country the store ships to, in the same order', () => {
    expect(POSTAL_CODE_FORMATS.map((format) => format.country)).toEqual(COUNTRIES.map((country) => country.code));
  });

  it("names the code the way that country's people do", () => {
    const names = Object.fromEntries(POSTAL_CODE_FORMATS.map((format) => [format.country, format.name]));
    expect(names).toEqual({
      CA: 'postal code',
      US: 'ZIP code',
      GB: 'postcode',
      FR: 'postal code',
      DE: 'postal code',
      IE: 'Eircode',
      IT: 'postal code',
      NL: 'postal code',
      ES: 'postal code',
    });
  });

  it('gives an example that passes its own check and is already in its standard form', () => {
    for (const format of POSTAL_CODE_FORMATS) {
      const result = checkPostalCode(format.country, format.example);
      expect(result, format.country).toEqual({ ok: true, value: format.example });
    }
  });

  it('describes each format in words', () => {
    for (const format of POSTAL_CODE_FORMATS) {
      expect(format.format.length, format.country).toBeGreaterThan(5);
    }
  });
});

describe('checkPostalCode', () => {
  for (const country of COUNTRIES) {
    it(`accepts and tidies ${country.name} codes`, () => {
      for (const [typed, kept] of accepted[country.code]) {
        expect(checkPostalCode(country.code, typed), `${country.code} ${typed}`).toEqual({ ok: true, value: kept });
      }
    });

    it(`rejects codes that are not ${country.name} codes`, () => {
      for (const typed of rejected[country.code]) {
        expect(checkPostalCode(country.code, typed), `${country.code} "${typed}"`).toEqual({ ok: false });
      }
    });
  }

  it("does not accept another country's code, checked in both directions", () => {
    expect(checkPostalCode('CA', '95014').ok).toBe(false);
    expect(checkPostalCode('US', 'K1A 0B1').ok).toBe(false);
    expect(checkPostalCode('GB', '10115').ok).toBe(false);
    expect(checkPostalCode('DE', 'EC1A 1HQ').ok).toBe(false);
  });

  it('reads the country in any case and ignores spaces around it', () => {
    expect(checkPostalCode(' ca ', 'k1a0b1')).toEqual({ ok: true, value: 'K1A 0B1' });
  });

  it('says no for a country the store does not ship to, and for things that are not text', () => {
    expect(checkPostalCode('JP', '100-0001')).toEqual({ ok: false });
    expect(checkPostalCode('', '95014')).toEqual({ ok: false });
    expect(checkPostalCode('CA', undefined)).toEqual({ ok: false });
    expect(checkPostalCode('CA', 12345)).toEqual({ ok: false });
    expect(checkPostalCode('CA', null)).toEqual({ ok: false });
    expect(checkPostalCode('CA', { toString: () => 'K1A 0B1' })).toEqual({ ok: false });
  });
});

describe('postalCodeHelp', () => {
  it("says what the country calls its code and gives an example that is in the country's format", () => {
    expect(postalCodeHelp('CA')).toBe('Enter a valid postal code, like K1A 0B1.');
    expect(postalCodeHelp('us')).toBe('Enter a valid ZIP code, like 95014.');
    expect(postalCodeHelp('GB')).toBe('Enter a valid postcode, like EC1A 1HQ.');
    expect(postalCodeHelp(' IE ')).toBe('Enter a valid Eircode, like A65 F4E2.');
  });

  it('falls back to a plain sentence for a country the store does not ship to', () => {
    expect(postalCodeHelp('JP')).toBe('Enter a valid postal code.');
    expect(postalCodeHelp(undefined)).toBe('Enter a valid postal code.');
  });
});

describe('postal codes that hold after any typing', () => {
  // A small seeded generator, so the "random" typing is the same on every run.
  function seeded(seed: number) {
    let state = seed;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it('accepts a good code however it is spaced or capitalised, and keeps it in one standard form', () => {
    const random = seeded(2026);
    let runs = 0;
    for (const country of COUNTRIES) {
      for (const [, kept] of accepted[country.code]) {
        for (let i = 0; i < 40; i += 1) {
          // Spaces around it, a lowercase mix, and (where the format allows) the inner space left out.
          let typed = [...kept].map((char) => (random() < 0.5 ? char.toLowerCase() : char)).join('');
          if (country.code !== 'US' && random() < 0.5) typed = typed.replace(/ /g, '');
          typed = `${' '.repeat(Math.floor(random() * 3))}${typed}${' '.repeat(Math.floor(random() * 3))}`;
          expect(checkPostalCode(country.code, typed), `${country.code} "${typed}"`).toEqual({ ok: true, value: kept });
          runs += 1;
        }
      }
    }
    expect(runs).toBeGreaterThan(1000);
  });

  it('rejects a good code with a symbol dropped into it, and keeps whatever it does accept in standard form', () => {
    const random = seeded(7);
    const symbols = ['!', '?', '_', '#', '*', '.', ','];
    for (const country of COUNTRIES) {
      for (const [, kept] of accepted[country.code]) {
        for (let i = 0; i < 40; i += 1) {
          const at = Math.floor(random() * kept.length);
          const symbol = symbols[Math.floor(random() * symbols.length)];
          const broken = kept.slice(0, at) + symbol + kept.slice(at + 1);
          expect(checkPostalCode(country.code, broken).ok, `${country.code} "${broken}"`).toBe(false);

          // Any other slip (a digit changed, a letter lost) is either refused or comes out in standard form.
          const shorter = kept.slice(0, at) + kept.slice(at + 1);
          const result = checkPostalCode(country.code, shorter);
          if (result.ok) expect(checkPostalCode(country.code, result.value)).toEqual(result);
        }
      }
    }
  });
});
