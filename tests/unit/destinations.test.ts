import { describe, expect, it } from 'vitest';
import { COUNTRIES, PROVINCES } from '../../src/store/destinations';
import { taxPercentFor } from '../../src/engine/tax';
import { scaleToInteger } from '../../src/engine/money';

describe('COUNTRIES', () => {
  it('ships to Canada, the United States, the United Kingdom and six EU countries', () => {
    expect(COUNTRIES.map((country) => [country.code, country.name])).toEqual([
      ['CA', 'Canada'],
      ['US', 'United States'],
      ['GB', 'United Kingdom'],
      ['FR', 'France'],
      ['DE', 'Germany'],
      ['IE', 'Ireland'],
      ['IT', 'Italy'],
      ['NL', 'Netherlands'],
      ['ES', 'Spain'],
    ]);
  });

  it('has a tax rate for every country except Canada, which is taxed by province', () => {
    for (const country of COUNTRIES) {
      expect(country.taxPercent === undefined, country.code).toBe(country.code === 'CA');
    }
  });
});

// The facts below were read on 2026-11-16 from Google's libphonenumber data (resources/PhoneNumberMetadata.xml,
// last changed 2026-11-04), the file the production guide names for a real launch. They are pinned here so that a
// change to one of them has to be made on purpose.
describe('COUNTRIES, how a phone number is written there', () => {
  it('gives each country the calling code Google lists: +1 for Canada and the United States, then +44, +33, +49, +353, +39, +31 and +34', () => {
    expect(COUNTRIES.map((country) => [country.code, country.phone.callingCode])).toEqual([
      ['CA', '1'],
      ['US', '1'],
      ['GB', '44'],
      ['FR', '33'],
      ['DE', '49'],
      ['IE', '353'],
      ['IT', '39'],
      ['NL', '31'],
      ['ES', '34'],
    ]);
  });

  it('drops a 1 in Canada and the United States and a 0 in the United Kingdom, France, Germany, Ireland and the Netherlands, and nothing in Italy or Spain', () => {
    expect(COUNTRIES.map((country) => [country.code, country.phone.nationalPrefix])).toEqual([
      ['CA', '1'],
      ['US', '1'],
      ['GB', '0'],
      ['FR', '0'],
      ['DE', '0'],
      ['IE', '0'],
      ['IT', undefined],
      ['NL', '0'],
      ['ES', undefined],
    ]);
  });

  it('allows the number of digits Google allows after the code, with the home digit left off', () => {
    expect(COUNTRIES.map((country) => [country.code, country.phone.digits.fewest, country.phone.digits.most])).toEqual([
      ['CA', 10, 10],
      ['US', 10, 10],
      ['GB', 9, 10],
      ['FR', 9, 9],
      ['DE', 5, 13],
      ['IE', 7, 10],
      ['IT', 6, 12],
      ['NL', 9, 9],
      ['ES', 9, 9],
    ]);
  });

  it('writes a calling code as one to three digits, with no plus sign, and a national prefix as a single digit', () => {
    for (const country of COUNTRIES) {
      expect(country.phone.callingCode, country.code).toMatch(/^[1-9]\d{0,2}$/);
      if (country.phone.nationalPrefix !== undefined) expect(country.phone.nationalPrefix, country.code).toMatch(/^\d$/);
    }
  });

  it('never lets one calling code start with another, so a code can always be read off the front of a number', () => {
    const codes = [...new Set(COUNTRIES.map((country) => country.phone.callingCode))];
    for (const one of codes) {
      for (const other of codes) {
        if (one !== other) expect(other.startsWith(one), `${one} and ${other}`).toBe(false);
      }
    }
  });

  it('gives countries that share a calling code the same rule, since a number is checked by its code alone', () => {
    for (const country of COUNTRIES) {
      const first = COUNTRIES.find((candidate) => candidate.phone.callingCode === country.phone.callingCode);
      expect(country.phone, country.code).toEqual(first?.phone);
    }
  });

  it('keeps the code and the longest number within the 15 digits that an international number may have, and never asks for none', () => {
    for (const country of COUNTRIES) {
      const { callingCode, digits } = country.phone;
      expect(callingCode.length + digits.most, country.code).toBeLessThanOrEqual(15);
      expect(digits.fewest, country.code).toBeGreaterThanOrEqual(1);
      expect(digits.fewest, country.code).toBeLessThanOrEqual(digits.most);
    }
  });

  it('gives Canada and the United States the numbering plan they share: an area code and an exchange that each start with 2 to 9', () => {
    const { shape } = COUNTRIES[0].phone;
    expect(shape?.test('5145550142')).toBe(true);
    for (const wrong of ['0145550142', '1145550142', '5140550142', '5141550142', '514555014', '51455501422']) {
      expect(shape?.test(wrong), wrong).toBe(false);
    }
    expect(COUNTRIES.filter((country) => country.phone.shape !== undefined).map((country) => country.code)).toEqual(['CA', 'US']);
  });
});

describe('PROVINCES', () => {
  it('lists all ten provinces and three territories once each', () => {
    expect(PROVINCES).toHaveLength(13);
    expect(new Set(PROVINCES.map((province) => province.code)).size).toBe(13);
    for (const province of PROVINCES) {
      expect(province.code, province.name).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('uses the demo rates: Ontario 13, Québec 14.975, British Columbia 12, Alberta 5, the rest 13', () => {
    const rates = Object.fromEntries(PROVINCES.map((province) => [province.code, province.taxPercent]));
    expect(rates.ON).toBe(13);
    expect(rates.QC).toBe(14.975);
    expect(rates.BC).toBe(12);
    expect(rates.AB).toBe(5);
    const others = PROVINCES.filter((province) => !['ON', 'QC', 'BC', 'AB'].includes(province.code));
    expect(others).toHaveLength(9);
    expect(others.every((province) => province.taxPercent === 13)).toBe(true);
  });
});

describe('taxPercentFor', () => {
  it('uses the province for Canada', () => {
    expect(taxPercentFor('CA', 'ON')).toBe(13);
    expect(taxPercentFor('CA', 'QC')).toBe(14.975);
    expect(taxPercentFor('CA', 'BC')).toBe(12);
    expect(taxPercentFor('CA', 'AB')).toBe(5);
    expect(taxPercentFor('CA', 'MB')).toBe(13);
  });

  it('has no answer for Canada without a known province', () => {
    expect(taxPercentFor('CA')).toBeUndefined();
    expect(taxPercentFor('CA', 'ZZ')).toBeUndefined();
  });

  it('uses the demo rate for the other countries: US 0, UK 20, EU 21', () => {
    expect(taxPercentFor('US')).toBe(0);
    expect(taxPercentFor('GB')).toBe(20);
    for (const code of ['FR', 'DE', 'IE', 'IT', 'NL', 'ES']) {
      expect(taxPercentFor(code), code).toBe(21);
    }
  });

  it('ignores a province outside Canada', () => {
    expect(taxPercentFor('US', 'ON')).toBe(0);
  });

  it('has no answer for a country the store does not ship to', () => {
    expect(taxPercentFor('JP')).toBeUndefined();
    expect(taxPercentFor('')).toBeUndefined();
  });

  it('keeps every rate to three decimal places, so nothing is lost when it is scaled', () => {
    const rates = [
      ...COUNTRIES.map((country) => country.taxPercent),
      ...PROVINCES.map((province) => province.taxPercent),
    ].filter((rate): rate is number => rate !== undefined);
    for (const rate of rates) {
      expect(() => scaleToInteger(rate, 3), String(rate)).not.toThrow();
    }
  });
});
