import { describe, expect, it } from 'vitest';
import {
  BASE_CURRENCY,
  CURRENCIES,
  EURO_AREA_COUNTRIES,
  defaultCurrencyFor,
} from '../../src/store/currencies';
import {
  convertFromCad,
  divideRounded,
  formatMoney,
  isCurrencyCode,
  pricesInAllCurrencies,
  scaleToInteger,
  storedCurrencyOr,
} from '../../src/engine/money';

describe('CURRENCIES', () => {
  it('offers the four currencies from the design, with CAD as the base', () => {
    expect(CURRENCIES.map((currency) => currency.code)).toEqual(['CAD', 'USD', 'EUR', 'GBP']);
    expect(BASE_CURRENCY).toBe('CAD');
    expect(CURRENCIES[0].rate).toBe(1);
  });

  it('uses the demo rates: 1 CAD is 0.73 USD, 0.66 EUR and 0.56 GBP', () => {
    const rates = Object.fromEntries(CURRENCIES.map((currency) => [currency.code, currency.rate]));
    expect(rates).toEqual({ CAD: 1, USD: 0.73, EUR: 0.66, GBP: 0.56 });
  });

  it('keeps every rate to four decimal places, so nothing is lost when it is scaled', () => {
    for (const currency of CURRENCIES) {
      expect(() => scaleToInteger(currency.rate, 4), currency.code).not.toThrow();
    }
  });
});

describe('isCurrencyCode', () => {
  it('accepts the offered currencies and nothing else', () => {
    expect(isCurrencyCode('USD')).toBe(true);
    expect(isCurrencyCode('usd')).toBe(false);
    expect(isCurrencyCode('JPY')).toBe(false);
    expect(isCurrencyCode('')).toBe(false);
  });
});

describe('scaleToInteger', () => {
  it('turns a short decimal into a whole number without float drift', () => {
    expect(scaleToInteger(0.73, 4)).toBe(7300);
    expect(scaleToInteger(14.975, 3)).toBe(14975);
    expect(scaleToInteger(13, 3)).toBe(13000);
  });

  it('refuses a value with more decimal places than allowed', () => {
    expect(() => scaleToInteger(0.12345, 4)).toThrow('more than 4 decimal places');
  });
});

describe('divideRounded', () => {
  it('rounds halves up and everything else to the nearest whole number', () => {
    expect(divideRounded(5, 2)).toBe(3);
    expect(divideRounded(7, 3)).toBe(2);
    expect(divideRounded(1, 3)).toBe(0);
    expect(divideRounded(0, 5)).toBe(0);
    expect(divideRounded(10, 5)).toBe(2);
  });

  it('refuses anything that is not a non-negative whole number over a positive one', () => {
    expect(() => divideRounded(-1, 2)).toThrow();
    expect(() => divideRounded(1.5, 2)).toThrow();
    expect(() => divideRounded(1, 0)).toThrow();
    expect(() => divideRounded(1, -2)).toThrow();
  });
});

describe('convertFromCad', () => {
  it('converts a price in CAD cents into the other currencies', () => {
    expect(convertFromCad(3800, 'CAD')).toBe(3800);
    expect(convertFromCad(3800, 'USD')).toBe(2774);
    expect(convertFromCad(3800, 'EUR')).toBe(2508);
    expect(convertFromCad(3800, 'GBP')).toBe(2128);
  });

  it('rounds a half cent up', () => {
    // 50 cents at 0.73 is 36.5 cents.
    expect(convertFromCad(50, 'USD')).toBe(37);
  });

  it('converts zero to zero', () => {
    expect(convertFromCad(0, 'GBP')).toBe(0);
  });

  it('refuses an amount that is not a whole number of cents', () => {
    expect(() => convertFromCad(12.5, 'USD')).toThrow();
  });
});

describe('formatMoney', () => {
  it('shows each currency the way a Canadian shopper would expect', () => {
    expect(formatMoney(3800, 'CAD')).toBe('$38.00');
    expect(formatMoney(2774, 'USD')).toBe('US$27.74');
    expect(formatMoney(2508, 'EUR')).toBe('€25.08');
    expect(formatMoney(2128, 'GBP')).toBe('£21.28');
  });

  it('shows thousands separators and zero', () => {
    expect(formatMoney(123450, 'CAD')).toBe('$1,234.50');
    expect(formatMoney(0, 'CAD')).toBe('$0.00');
  });
});

describe('pricesInAllCurrencies', () => {
  it('formats one price in every offered currency', () => {
    expect(pricesInAllCurrencies(3800)).toEqual({
      CAD: '$38.00',
      USD: 'US$27.74',
      EUR: '€25.08',
      GBP: '£21.28',
    });
  });

  it('formats zero the same way in every currency', () => {
    expect(pricesInAllCurrencies(0)).toEqual({ CAD: '$0.00', USD: 'US$0.00', EUR: '€0.00', GBP: '£0.00' });
  });
});

describe('storedCurrencyOr', () => {
  it('accepts a saved currency the store offers', () => {
    expect(storedCurrencyOr('USD', 'CAD')).toBe('USD');
    expect(storedCurrencyOr('GBP', 'CAD')).toBe('GBP');
  });

  it('falls back for anything missing or not offered', () => {
    for (const raw of [null, undefined, '', 'usd', 'JPY', 'CAD ']) {
      expect(storedCurrencyOr(raw, 'CAD'), String(raw)).toBe('CAD');
    }
  });
});

describe('EURO_AREA_COUNTRIES', () => {
  it('lists the 21 euro-area countries, each once, with a two-letter code and a name', () => {
    expect(EURO_AREA_COUNTRIES).toHaveLength(21);
    expect(new Set(EURO_AREA_COUNTRIES.map((country) => country.code)).size).toBe(21);
    for (const country of EURO_AREA_COUNTRIES) {
      expect(country.code, country.name).toMatch(/^[A-Z]{2}$/);
      expect(country.name.trim(), country.code).not.toBe('');
    }
  });

  it('is exactly the euro area, which Bulgaria joined on 1 January 2026', () => {
    expect(EURO_AREA_COUNTRIES.map((country) => country.code)).toEqual([
      'AT', 'BE', 'BG', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE',
      'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES',
    ]);
  });

  it('includes the six euro countries the store ships to, and not Canada, the US or the UK', () => {
    const codes = EURO_AREA_COUNTRIES.map((country) => country.code);
    for (const shipsTo of ['FR', 'DE', 'IE', 'IT', 'NL', 'ES']) expect(codes).toContain(shipsTo);
    for (const other of ['CA', 'US', 'GB']) expect(codes).not.toContain(other);
  });
});

describe('defaultCurrencyFor', () => {
  it('starts Canadian visitors in CAD, US visitors in USD and UK visitors in GBP', () => {
    expect(defaultCurrencyFor('CA')).toBe('CAD');
    expect(defaultCurrencyFor('US')).toBe('USD');
    expect(defaultCurrencyFor('GB')).toBe('GBP');
  });

  it('starts every euro-area visitor in EUR', () => {
    for (const country of EURO_AREA_COUNTRIES) {
      expect(defaultCurrencyFor(country.code), country.name).toBe('EUR');
    }
  });

  it('starts everyone else in USD, including countries next to the euro area that use their own money', () => {
    for (const code of ['JP', 'AU', 'BR', 'MX', 'CH', 'SE', 'DK', 'PL', 'NO']) {
      expect(defaultCurrencyFor(code), code).toBe('USD');
    }
  });

  it('ignores capitalisation and stray spaces in the header', () => {
    expect(defaultCurrencyFor('ca')).toBe('CAD');
    expect(defaultCurrencyFor(' gb ')).toBe('GBP');
    expect(defaultCurrencyFor(' de')).toBe('EUR');
  });

  it('falls back to USD when the header is missing or does not look like a country code', () => {
    for (const header of [null, undefined, '', '   ', 'Canada', 'C', 'CAN', '12', 'ZZ']) {
      expect(defaultCurrencyFor(header), String(header)).toBe('USD');
    }
  });
});
