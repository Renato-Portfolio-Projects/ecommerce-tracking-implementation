import { describe, expect, it } from 'vitest';
import { buildPhone, checkPhoneNumber } from '../../src/engine/phone';
import { COUNTRIES, type CountryCode } from '../../src/store/destinations';

// The number goes to the order as one string: a plus sign, the calling code, a space, then the number as the shopper
// typed it with the national prefix (the digit dialled first for a call inside the country) left off. So the country
// code takes the place of that digit, if the country has one: 07700 900123 becomes +44 7700 900123.

describe('buildPhone, a number typed the way it is dialled at home', () => {
  // [the country picked, what was typed, what is sent]
  const rows: [CountryCode, string, string][] = [
    ['GB', '07700 900123', '+44 7700 900123'],
    ['GB', '07700900123', '+44 7700900123'],
    ['GB', '7700 900123', '+44 7700 900123'],
    ['GB', '020 7946 0134', '+44 20 7946 0134'],
    ['GB', '(020) 7946 0134', '+44 (20) 7946 0134'],
    ['GB', '(0) 7700 900123', '+44 7700 900123'],
    ['GB', '(0)7700 900123', '+44 7700 900123'],
    ['CA', '1-514-555-0142', '+1 514-555-0142'],
    ['CA', '1 (514) 555-0142', '+1 (514) 555-0142'],
    ['CA', '(514) 555-0142', '+1 (514) 555-0142'],
    ['CA', '514 555 0142', '+1 514 555 0142'],
    ['US', '512.555.0184', '+1 512.555.0184'],
    ['US', '1.512.555.0184', '+1 512.555.0184'],
    ['FR', '06 12 34 56 78', '+33 6 12 34 56 78'],
    ['DE', '030 23125123', '+49 30 23125123'],
    ['IE', '087 123 4567', '+353 87 123 4567'],
    ['NL', '06 12345678', '+31 6 12345678'],
    ['IT', '06 1234 5678', '+39 06 1234 5678'],
    ['ES', '612 345 678', '+34 612 345 678'],
  ];

  it('puts the calling code in front, and takes the home digit off the front when it was typed', () => {
    for (const [country, typed, sent] of rows) {
      expect(buildPhone(country, typed), `${country} ${typed}`).toEqual({ ok: true, country, value: sent });
    }
  });

  it('gives the same digits whether or not the shopper typed the home digit', () => {
    const digitsOf = (value: string) => value.replace(/\D/g, '');
    const withAndWithout: [CountryCode, string, string][] = [
      ['GB', '07700 900123', '7700 900123'],
      ['FR', '06 12 34 56 78', '6 12 34 56 78'],
      ['DE', '030 23125123', '30 23125123'],
      ['IE', '087 123 4567', '87 123 4567'],
      ['NL', '06 12345678', '6 12345678'],
      ['CA', '1-514-555-0142', '514-555-0142'],
      ['US', '1 512 555 0184', '512 555 0184'],
    ];
    for (const [country, withHomeDigit, without] of withAndWithout) {
      const one = buildPhone(country, withHomeDigit);
      const other = buildPhone(country, without);
      expect(one.ok && other.ok, country).toBe(true);
      if (one.ok && other.ok) expect(digitsOf(one.value), country).toBe(digitsOf(other.value));
    }
  });

  it('keeps the 0 of an Italian number, since in Italy it is part of the number', () => {
    expect(buildPhone('IT', '06 1234 5678')).toEqual({ ok: true, country: 'IT', value: '+39 06 1234 5678' });
    expect(buildPhone('IT', '02 1234 5678')).toEqual({ ok: true, country: 'IT', value: '+39 02 1234 5678' });
  });

  it('takes off only the first home digit, and leaves a second one to be refused by the check', () => {
    expect(buildPhone('GB', '0 07700 900123')).toEqual({ ok: true, country: 'GB', value: '+44 07700 900123' });
    expect(buildPhone('CA', '11 514 555 0142')).toEqual({ ok: true, country: 'CA', value: '+1 1 514 555 0142' });
  });

  it('keeps the shopper\'s own spacing and punctuation, with the ends trimmed and runs of spaces made into one', () => {
    expect(buildPhone('GB', '  07700   900123 ')).toEqual({ ok: true, country: 'GB', value: '+44 7700 900123' });
    expect(buildPhone('FR', '\t06\n12 34 56 78')).toEqual({ ok: true, country: 'FR', value: '+33 6 12 34 56 78' });
  });

  it('sends nothing when the number box is empty, whatever the list says', () => {
    for (const typed of ['', '   ', '\n\t']) {
      expect(buildPhone('GB', typed), JSON.stringify(typed)).toEqual({ ok: true, country: 'GB', value: '' });
    }
  });

  it('sends the code alone when only the home digit was typed, so the check can ask for the rest', () => {
    expect(buildPhone('GB', '0')).toEqual({ ok: true, country: 'GB', value: '+44' });
    expect(buildPhone('CA', '1')).toEqual({ ok: true, country: 'CA', value: '+1' });
    expect(buildPhone('GB', '(0)')).toEqual({ ok: true, country: 'GB', value: '+44' });
  });

  it('builds numbers that the check accepts and gives back unchanged', () => {
    for (const [country, typed] of rows) {
      const built = buildPhone(country, typed);
      expect(built.ok, `${country} ${typed}`).toBe(true);
      if (built.ok) expect(checkPhoneNumber(built.value), `${country} ${typed}`).toEqual({ ok: true, value: built.value });
    }
  });
});

describe('buildPhone, a number that arrives with its own country code', () => {
  // [the country picked, what was typed or pasted, the country the list moves to, what is sent]
  const rows: [CountryCode, string, CountryCode, string][] = [
    ['CA', '+44 7700 900123', 'GB', '+44 7700 900123'],
    ['CA', '+44 (0) 7700 900123', 'GB', '+44 7700 900123'],
    ['CA', '+44 (0)7700 900123', 'GB', '+44 7700 900123'],
    ['CA', '+44 07700 900123', 'GB', '+44 7700 900123'],
    ['CA', '0044 7700 900123', 'GB', '+44 7700 900123'],
    ['CA', '+447700900123', 'GB', '+44 7700900123'],
    ['GB', '+ 44 7700 900123', 'GB', '+44 7700 900123'],
    ['GB', '+44 7700 900123', 'GB', '+44 7700 900123'],
    ['GB', '+353 87 123 4567', 'IE', '+353 87 123 4567'],
    ['GB', '+353 (0)87 123 4567', 'IE', '+353 87 123 4567'],
    ['GB', '+31 6 12345678', 'NL', '+31 6 12345678'],
    ['GB', '+33 (0)6 12 34 56 78', 'FR', '+33 6 12 34 56 78'],
    ['GB', '+49 30 23125123', 'DE', '+49 30 23125123'],
    ['GB', '+34 612 345 678', 'ES', '+34 612 345 678'],
    ['GB', '0034 612 345 678', 'ES', '+34 612 345 678'],
    ['CA', '+39 06 1234 5678', 'IT', '+39 06 1234 5678'],
    ['GB', '0039 06 1234 5678', 'IT', '+39 06 1234 5678'],
  ];

  it('moves the list to that country, and takes the code, and any home digit after it, off the front', () => {
    for (const [picked, typed, moved, sent] of rows) {
      expect(buildPhone(picked, typed), `${picked} ${typed}`).toEqual({ ok: true, country: moved, value: sent });
    }
  });

  it('keeps Canada or the United States when the code is +1 and one of them is picked, and otherwise moves to Canada', () => {
    expect(buildPhone('US', '+1 512 555 0184')).toEqual({ ok: true, country: 'US', value: '+1 512 555 0184' });
    expect(buildPhone('CA', '+1 514 555 0142')).toEqual({ ok: true, country: 'CA', value: '+1 514 555 0142' });
    expect(buildPhone('GB', '+1 514 555 0142')).toEqual({ ok: true, country: 'CA', value: '+1 514 555 0142' });
    expect(buildPhone('US', '001 512 555 0184')).toEqual({ ok: true, country: 'US', value: '+1 512 555 0184' });
  });

  it('asks for a code from the list when the code is not one the store ships to', () => {
    for (const typed of ['+81 90 1234 5678', '0081 90 1234 5678', '+7 912 345 6789', '+', '+ ', '00', '++44 7700 900123', '+4', '+abc']) {
      expect(buildPhone('GB', typed), typed).toEqual({ ok: false, reason: 'unknown-code' });
    }
  });

  it('leaves the rest of the number to the check, so letters and odd marks come through to be refused there', () => {
    expect(buildPhone('GB', '07700 CALL ME')).toEqual({ ok: true, country: 'GB', value: '+44 7700 CALL ME' });
    expect(buildPhone('GB', '+44x')).toEqual({ ok: true, country: 'GB', value: '+44 x' });
  });
});

describe('checkPhoneNumber', () => {
  const wrong = (callingCode: string) => ({ ok: false, reason: 'wrong-number', callingCode });
  const noCode = { ok: false, reason: 'unknown-code' };

  it('accepts a number written in each country\'s own style, and gives it back as it is', () => {
    const good = [
      '+44 7700 900123',
      '+44 20 7946 0134',
      '+44 (20) 7946 0134',
      '+1 514 555 0142',
      '+1 514-555-0142',
      '+1 (514) 555-0142',
      '+1 512.555.0184',
      '+1 234 567 8901',
      '+33 6 12 34 56 78',
      '+33 4 65 71 30 21',
      '+49 30 23125123',
      '+49 30 23125 123',
      '+353 87 123 4567',
      '+31 6 12345678',
      '+39 06 1234 5678',
      '+34 612 345 678',
    ];
    for (const phone of good) expect(checkPhoneNumber(phone), phone).toEqual({ ok: true, value: phone });
  });

  it('puts one space after the code and one between words, and trims the ends', () => {
    expect(checkPhoneNumber('+447700900123')).toEqual({ ok: true, value: '+44 7700900123' });
    expect(checkPhoneNumber('  +44   7700  900123 ')).toEqual({ ok: true, value: '+44 7700 900123' });
    expect(checkPhoneNumber('+1(514)555-0142')).toEqual({ ok: true, value: '+1 (514)555-0142' });
    expect(checkPhoneNumber('+ 44 7700 900123')).toEqual({ ok: true, value: '+44 7700 900123' });
  });

  it('accepts the fewest and the most digits each country allows', () => {
    const edges = [
      '+44 121 234 567', // 9 digits
      '+44 20 7946 0134', // 10
      '+49 30231', // 5
      '+49 3023125123456', // 13
      '+353 1234567', // 7
      '+353 8181234567', // 10
      '+39 061234', // 6
      '+39 061234567890', // 12
    ];
    for (const phone of edges) expect(checkPhoneNumber(phone), phone).toEqual({ ok: true, value: phone });
  });

  it('refuses one digit too few and one too many, and names the country\'s code', () => {
    // [the calling code, too few digits, too many digits]
    const outside: [string, string, string][] = [
      ['1', '+1 514 555 014', '+1 514 555 01422'],
      ['44', '+44 7700 9001', '+44 7700 9001234'],
      ['33', '+33 6 12 34 56 7', '+33 6 12 34 56 789'],
      ['49', '+49 3023', '+49 30 231251234567'],
      ['353', '+353 87 1234', '+353 87 123 456789'],
      ['39', '+39 06 123', '+39 06 1234 5678 901'],
      ['31', '+31 6 1234567', '+31 6 123456789'],
      ['34', '+34 612 345 67', '+34 612 345 6789'],
    ];
    for (const [callingCode, tooFew, tooMany] of outside) {
      for (const phone of [tooFew, tooMany]) expect(checkPhoneNumber(phone), phone).toEqual(wrong(callingCode));
    }
  });

  it('refuses letters, symbols and digits from other scripts', () => {
    for (const phone of ['+44 7700 CALL 123', '+44 7700-900-123x5', '+44 <7700900123>', '+44 7700 900123 ext 5', '+44 7700 900123!', '+44 ７７００ ９００１２３']) {
      expect(checkPhoneNumber(phone), phone).toEqual(wrong('44'));
    }
    expect(checkPhoneNumber('+1 514 555 CALL')).toEqual(wrong('1'));
  });

  it('refuses a number that still starts with the home digit after the code, since the code takes its place', () => {
    for (const [callingCode, phone] of [
      ['44', '+44 0770 090012'],
      ['33', '+33 06 12 34 56 7'],
      ['31', '+31 06 1234567'],
      ['49', '+49 030 23125 123'],
      ['353', '+353 087 123 456'],
    ]) {
      expect(checkPhoneNumber(phone), phone).toEqual(wrong(callingCode));
    }
  });

  it('refuses a Canadian or US number whose area code or exchange starts with 0 or 1', () => {
    for (const phone of ['+1 014 555 0142', '+1 114 555 0142', '+1 514 055 0142', '+1 514 155 0142']) {
      expect(checkPhoneNumber(phone), phone).toEqual(wrong('1'));
    }
  });

  it('refuses a UK number typed under the Canadian code, with its 0 and, for some numbers, without it', () => {
    expect(checkPhoneNumber('+1 07700 900123')).toEqual(wrong('1'));
    expect(checkPhoneNumber('+1 7700 900123')).toEqual(wrong('1'));
  });

  it('asks for a calling code from the list when there is none, or it is not one the store ships to', () => {
    for (const phone of ['+81 90 1234 5678', '514 555 0142', '(514) 555-0142', '0044 7700 900123', '++1 514 555 0142', '+', '+4', 'abc']) {
      expect(checkPhoneNumber(phone), phone).toEqual(noCode);
    }
  });
});

describe('buildPhone and checkPhoneNumber on odd input', () => {
  function seeded(seed: number) {
    let state = seed;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Digits and the marks a number is written with, a plus, letters from two scripts, digits from another script,
  // an emoji, a line break, a tab and a non-breaking space.
  const junk = [...'+0123456789 ().-xA<>٣٤😀\n\t '];
  const digits = [...'0123456789'];

  function text(random: () => number, longest: number, pool: string[]): string {
    const length = Math.floor(random() * longest);
    let result = '';
    for (let i = 0; i < length; i += 1) result += pool[Math.floor(random() * pool.length)];
    return result;
  }

  it('never throws, and a number the check accepts is the same when checked again', () => {
    const random = seeded(31);
    const counts = { unknownCode: 0, wrongNumber: 0, accepted: 0, empty: 0 };
    for (let i = 0; i < 4000; i += 1) {
      const country = COUNTRIES[Math.floor(random() * COUNTRIES.length)].code;
      const roll = random();
      const typed =
        roll < 0.3 ? text(random, 24, junk)
        : roll < 0.5 ? `+${text(random, 14, digits)}`
        : roll < 0.6 ? `00${text(random, 14, digits)}`
        : text(random, 14, digits);

      const built = buildPhone(country, typed);
      if (!built.ok) {
        counts.unknownCode += 1;
        continue;
      }
      if (built.value === '') {
        counts.empty += 1;
        continue;
      }
      const checked = checkPhoneNumber(built.value);
      if (checked.ok) {
        counts.accepted += 1;
        expect(checkPhoneNumber(checked.value), `${country} ${JSON.stringify(typed)}`).toEqual(checked);
      } else if (checked.reason === 'wrong-number') {
        counts.wrongNumber += 1;
      }
      // Anything at all may be checked on its own, as a hand-made request would send it.
      expect(() => checkPhoneNumber(typed)).not.toThrow();
    }
    // Every outcome must really happen, or the run proves nothing.
    expect(counts.unknownCode).toBeGreaterThan(50);
    expect(counts.wrongNumber).toBeGreaterThan(50);
    expect(counts.accepted).toBeGreaterThan(50);
    expect(counts.empty).toBeGreaterThan(5);
  });
});
