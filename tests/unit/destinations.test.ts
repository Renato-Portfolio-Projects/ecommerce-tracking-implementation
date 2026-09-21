import { describe, expect, it } from 'vitest';
import { COUNTRIES, PROVINCES } from '../../src/store/destinations';
import { taxPercentFor } from '../../src/shop/tax';
import { scaleToInteger } from '../../src/shop/money';

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
