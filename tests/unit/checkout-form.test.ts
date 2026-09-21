import { describe, expect, it } from 'vitest';
import { COUNTRIES, PROVINCES } from '../../src/store/destinations';
import {
  checkAddress,
  checkContact,
  checkLead,
  type FieldProblem,
  type FormField,
} from '../../src/engine/checkout-form';

/** Every field of a check that fails, as "field: message", so a test can see it all at once. */
function problemsOf(result: { ok: boolean; problems?: FieldProblem[] }): string[] {
  return result.ok ? [] : (result.problems ?? []).map((problem) => `${problem.field}: ${problem.message}`);
}

const validAddress = {
  firstName: 'Maya',
  lastName: 'Tremblay',
  address1: '47 Rue des Lilas',
  city: 'Montréal',
  province: 'QC',
  postalCode: 'H2J 3K4',
  country: 'CA',
};

describe('checkLead', () => {
  it('keeps a first name and an email, tidied', () => {
    expect(checkLead({ firstName: '  Maya  ', email: ' maya@example.com ' })).toEqual({
      ok: true,
      value: { firstName: 'Maya', email: 'maya@example.com' },
    });
  });

  it('asks for both when both are empty, first name first', () => {
    expect(problemsOf(checkLead({ firstName: '', email: '' }))).toEqual([
      'firstName: Enter your first name.',
      'email: Enter your email address.',
    ]);
  });

  it('reports only what is wrong', () => {
    expect(problemsOf(checkLead({ firstName: 'Maya', email: 'not an email' }))).toEqual([
      "email: That email address doesn't look right. It should look like name@example.com.",
    ]);
  });

  it('treats a missing or odd input as empty instead of failing', () => {
    expect(problemsOf(checkLead({}))).toHaveLength(2);
    expect(problemsOf(checkLead({ firstName: 42, email: ['maya@example.com'] }))).toHaveLength(2);
    expect(problemsOf(checkLead({ firstName: null, email: undefined }))).toHaveLength(2);
  });
});

describe('names', () => {
  const good: [typed: string, kept: string][] = [
    ['Maya', 'Maya'],
    ["O'Brien", "O'Brien"],
    ['O’Brien', 'O’Brien'],
    ['Jean-Luc', 'Jean-Luc'],
    ['Zoë', 'Zoë'],
    ['Straße', 'Straße'],
    ['Åsa', 'Åsa'],
    ['Núñez', 'Núñez'],
    ['St. John', 'St. John'],
    ['李', '李'],
    ['R2D2', 'R2D2'],
    ['Test 1', 'Test 1'],
    ['User2', 'User2'],
    ['1234', '1234'],
    ['  Ana   María ', 'Ana María'],
    ['Maya\nTremblay', 'Maya Tremblay'],
    ['x'.repeat(50), 'x'.repeat(50)],
  ];
  const wrong = ['<script>', 'Maya😀', '-Maya', "'Maya", 'Maya_', 'Maya@home', 'x'.repeat(51)];
  const empty: unknown[] = ['', '   ', undefined, null, 42, ['Maya'], {}];

  it('accepts names from many places and tidies the spacing', () => {
    for (const [typed, kept] of good) {
      const result = checkLead({ firstName: typed, email: 'maya@example.com' });
      expect(result, typed).toEqual({ ok: true, value: { firstName: kept, email: 'maya@example.com' } });
    }
  });

  it('says what a name can use when it has something else in it or is too long', () => {
    for (const typed of wrong) {
      expect(problemsOf(checkLead({ firstName: typed, email: 'maya@example.com' })), typed).toEqual([
        'firstName: Your first name can only use letters, numbers, spaces, apostrophes, hyphens and periods, up to 50 characters.',
      ]);
    }
  });

  it('asks for a name that is empty, or is not text', () => {
    for (const typed of empty) {
      expect(problemsOf(checkLead({ firstName: typed, email: 'maya@example.com' })), String(typed)).toEqual([
        'firstName: Enter your first name.',
      ]);
    }
  });

  it('uses the same rule for a last name, with its own words', () => {
    expect(problemsOf(checkAddress({ ...validAddress, lastName: '' }))).toEqual(['lastName: Enter your last name.']);
    expect(problemsOf(checkAddress({ ...validAddress, lastName: 'Maya_' }))).toEqual([
      'lastName: Your last name can only use letters, numbers, spaces, apostrophes, hyphens and periods, up to 50 characters.',
    ]);
  });
});

describe('email', () => {
  const good = [
    'maya@example.com',
    'maya.tremblay@example.com',
    'a.b+c@mail.co.uk',
    "o'brien@example.com",
    'x@y.co',
    'MAYA@Example.COM',
    'first_last-1@sub.domain.example.org',
    '12345@example.com',
    'user@example.museum',
    'user@xn--bcher-kva.de',
    'josé@example.com',
    'nathalie.müller@example.de',
    'info@bücher.de',
    '用户@例子.广告',
  ];
  const wrong = [
    'a@b',
    'asdf@asdf',
    'a b@c.com',
    '@example.com',
    'maya@',
    'maya',
    'maya@@example.com',
    'maya@example..com',
    'maya@-example.com',
    'maya@example-.com',
    'maya@exam ple.com',
    '<maya>@example.com',
    'maya@example.com>',
    'maya..t@example.com',
    '.maya@example.com',
    'maya.@example.com',
    'maya@.example.com',
    'maya@example.com.',
    'maya@example.c',
    'maya@1.2',
    'maya@123.123.123.123',
    'maya,t@example.com',
    '"maya"@example.com',
    '"maya t"@example.com',
    '(maya)@example.com',
    'maya😀@example.com',
    'maya@exa😀mple.com',
    'maya@localhost',
    'maya@[192.168.0.1]',
    // Names that are set aside so they can never belong to anyone, and so can never receive mail.
    'maya@mail.test',
    'maya@mail.invalid',
    'maya@mail.example',
    'maya@mail.localhost',
  ];

  it('accepts ordinary addresses, including ones on example.com, and keeps them as typed', () => {
    for (const typed of good) {
      expect(checkContact({ email: typed }), typed).toEqual({ ok: true, value: { email: typed } });
    }
  });

  it('refuses text that is not shaped like an address', () => {
    for (const typed of wrong) {
      expect(problemsOf(checkContact({ email: typed })), typed).toEqual([
        "email: That email address doesn't look right. It should look like name@example.com.",
      ]);
    }
  });

  it('allows 254 characters in all, 64 before the @, and 63 in each part after it', () => {
    const domain = (last: number) => ['b'.repeat(63), 'b'.repeat(63), 'b'.repeat(63), 'b'.repeat(last), 'co'].join('.');
    expect(checkContact({ email: `a@${domain(57)}` }).ok).toBe(true);
    expect(checkContact({ email: `a@${domain(58)}` }).ok).toBe(false);
    expect(checkContact({ email: `${'a'.repeat(64)}@example.com` }).ok).toBe(true);
    expect(checkContact({ email: `${'a'.repeat(65)}@example.com` }).ok).toBe(false);
    expect(checkContact({ email: `a@${'b'.repeat(63)}.com` }).ok).toBe(true);
    expect(checkContact({ email: `a@${'b'.repeat(64)}.com` }).ok).toBe(false);
  });

  it('asks for an address that is empty, or is not text', () => {
    for (const typed of ['', '  ', undefined, null, 7, {}]) {
      expect(problemsOf(checkContact({ email: typed })), String(typed)).toEqual(['email: Enter your email address.']);
    }
  });
});

describe('phone', () => {
  const good = [
    '+1 514 555 0142',
    '(416) 555-0117',
    '416.555.0117',
    '5145550142',
    '+44 20 7946 0134',
    '+49 30 23125 123',
    '5550142',
    '+123456789012345',
  ];
  const wrong = ['12345', '123456', '1234567890123456', 'abc', '514-555-CALL', '++1 514 555 0142', '514 555 0142 ext 5', '1+514 555 0142', '<1234567>'];

  it('is optional, and an empty one is left out of the result', () => {
    for (const typed of [undefined, null, '', '   ', 5145550142]) {
      expect(checkContact({ email: 'maya@example.com', phone: typed }), String(typed)).toStrictEqual({
        ok: true,
        value: { email: 'maya@example.com' },
      });
    }
  });

  it('accepts 7 to 15 digits with spaces, dashes, dots, brackets and a leading plus', () => {
    for (const typed of good) {
      expect(checkContact({ email: 'maya@example.com', phone: typed }), typed).toEqual({
        ok: true,
        value: { email: 'maya@example.com', phone: typed },
      });
    }
  });

  it('tidies the spacing', () => {
    const result = checkContact({ email: 'maya@example.com', phone: '  +1   514 555  0142 ' });
    expect(result).toEqual({ ok: true, value: { email: 'maya@example.com', phone: '+1 514 555 0142' } });
  });

  it('asks for a real number when there are too few or too many digits or odd characters', () => {
    for (const typed of wrong) {
      expect(problemsOf(checkContact({ email: 'maya@example.com', phone: typed })), typed).toEqual([
        "phone: That phone number doesn't look right. Use 7 to 15 digits, or leave it empty.",
      ]);
    }
  });

  it('reports the email first and the phone second', () => {
    expect(problemsOf(checkContact({ email: '', phone: '12' }))).toEqual([
      'email: Enter your email address.',
      "phone: That phone number doesn't look right. Use 7 to 15 digits, or leave it empty.",
    ]);
  });
});

describe('checkAddress', () => {
  const streets = [
    '47 Rue des Lilas',
    'Birkenweg 9',
    '1509 Cedar Row',
    'Apt 4B, 220 King St. W.',
    '5-220 Main St.',
    'Calle de Alcalá, 45',
    'Rue de l’Église 3',
    "1 O'Connell St",
    'Unit 3/14 High St & Low St',
    '#4 - 220 King St',
    'x'.repeat(80),
  ];
  const badStreets = ['<b>', '12 <script>', '!!', '@home', 'x'.repeat(81)];
  const cities = ['Montréal', 'Saint-Étienne-du-Rouvray', "St. John's", 'Zürich', 'Berlin', 'Quartier 5', 'x'.repeat(60)];
  const badCities = ['<x>', 'Toronto_', 'x'.repeat(61)];

  it('keeps a whole good address, tidied', () => {
    expect(checkAddress({ ...validAddress, address2: '  Suite   5 ', postalCode: 'h2j3k4', province: 'qc', country: ' ca ' })).toStrictEqual({
      ok: true,
      value: { ...validAddress, address2: 'Suite 5' },
    });
  });

  it('leaves out an empty second line', () => {
    for (const typed of [undefined, null, '', '  ']) {
      const result = checkAddress({ ...validAddress, address2: typed });
      expect(result, String(typed)).toStrictEqual({ ok: true, value: validAddress });
    }
  });

  it('accepts street lines and cities from many places', () => {
    for (const street of streets) {
      expect(checkAddress({ ...validAddress, address1: street }).ok, street).toBe(true);
    }
    for (const city of cities) {
      expect(checkAddress({ ...validAddress, city }).ok, city).toBe(true);
    }
  });

  it('says what a street line or a city can use when it has something else in it or is too long', () => {
    const street = 'Check your street address. It can use letters, numbers and basic punctuation, up to 80 characters.';
    for (const typed of badStreets) {
      expect(problemsOf(checkAddress({ ...validAddress, address1: typed })), typed).toEqual([`address1: ${street}`]);
    }
    expect(problemsOf(checkAddress({ ...validAddress, address2: '<b>' }))).toEqual([
      'address2: Check your second address line. It can use letters, numbers and basic punctuation, up to 80 characters.',
    ]);
    const city = 'Check your city. It can only use letters, numbers, spaces, apostrophes, hyphens and periods, up to 60 characters.';
    for (const typed of badCities) {
      expect(problemsOf(checkAddress({ ...validAddress, city: typed })), typed).toEqual([`city: ${city}`]);
    }
  });

  it('asks for a street and a city when they are empty', () => {
    expect(problemsOf(checkAddress({ ...validAddress, address1: '', city: '' }))).toEqual([
      'address1: Enter your street address.',
      'city: Enter your city.',
    ]);
  });

  it('needs a province in Canada, and only in Canada', () => {
    for (const province of [undefined, '', 'XX', 'Ontario', 42]) {
      expect(problemsOf(checkAddress({ ...validAddress, province })), String(province)).toEqual([
        'province: Choose your province or territory.',
      ]);
    }
    for (const { code } of PROVINCES) {
      expect(checkAddress({ ...validAddress, province: code }).ok, code).toBe(true);
    }
    // Elsewhere a province is ignored and left out, even one that would be a real Canadian code.
    const us = checkAddress({ ...validAddress, country: 'US', postalCode: '97205', province: 'ON' });
    expect(us).toStrictEqual({
      ok: true,
      value: { firstName: 'Maya', lastName: 'Tremblay', address1: '47 Rue des Lilas', city: 'Montréal', postalCode: '97205', country: 'US' },
    });
  });

  it('accepts only the countries the store ships to', () => {
    for (const typed of ['', 'JP', 'Canada', undefined, 5]) {
      expect(problemsOf(checkAddress({ ...validAddress, country: typed })), String(typed)).toEqual(['country: Choose a country we ship to.']);
    }
    for (const { code } of COUNTRIES) {
      const result = checkAddress({ ...validAddress, country: code.toLowerCase(), province: 'ON', postalCode: '' });
      expect(problemsOf(result).some((line) => line.startsWith('country:')), code).toBe(false);
    }
  });

  it("asks for a postal code in the country's own words, with an example", () => {
    const words: Record<string, string> = {
      CA: 'Enter a valid postal code, like K1A 0B1.',
      US: 'Enter a valid ZIP code, like 95014.',
      GB: 'Enter a valid postcode, like EC1A 1HQ.',
      FR: 'Enter a valid postal code, like 33380.',
      DE: 'Enter a valid postal code, like 26133.',
      IE: 'Enter a valid Eircode, like A65 F4E2.',
      IT: 'Enter a valid postal code, like 00144.',
      NL: 'Enter a valid postal code, like 1234 AB.',
      ES: 'Enter a valid postal code, like 28039.',
    };
    for (const { code } of COUNTRIES) {
      for (const postalCode of ['', 'nonsense']) {
        const result = checkAddress({ ...validAddress, country: code, province: 'ON', postalCode });
        expect(problemsOf(result), `${code} "${postalCode}"`).toEqual([`postalCode: ${words[code]}`]);
      }
    }
  });

  it("does not take another country's postal code", () => {
    expect(problemsOf(checkAddress({ ...validAddress, postalCode: '97205' }))).toEqual([
      'postalCode: Enter a valid postal code, like K1A 0B1.',
    ]);
  });

  it('keeps a good address from each country, with its postal code in standard form', () => {
    const cases: [country: string, postalCode: string, kept: string][] = [
      ['US', '97205', '97205'],
      ['GB', 'se154qt', 'SE15 4QT'],
      ['FR', '69 003', '69003'],
      ['DE', '10115', '10115'],
      ['IE', 'a65f4e2', 'A65 F4E2'],
      ['IT', '00144', '00144'],
      ['NL', '1234ab', '1234 AB'],
      ['ES', '28039', '28039'],
    ];
    for (const [country, postalCode, kept] of cases) {
      const result = checkAddress({ ...validAddress, country, postalCode, province: undefined });
      expect(result, country).toEqual({
        ok: true,
        value: { firstName: 'Maya', lastName: 'Tremblay', address1: '47 Rue des Lilas', city: 'Montréal', postalCode: kept, country },
      });
    }
  });

  it('reports every problem at once, one for each field, in the order of the form', () => {
    expect(problemsOf(checkAddress({}))).toEqual([
      'country: Choose a country we ship to.',
      'firstName: Enter your first name.',
      'lastName: Enter your last name.',
      'address1: Enter your street address.',
      'city: Enter your city.',
    ]);
    expect(problemsOf(checkAddress({ country: 'CA' }))).toEqual([
      'firstName: Enter your first name.',
      'lastName: Enter your last name.',
      'address1: Enter your street address.',
      'city: Enter your city.',
      'province: Choose your province or territory.',
      'postalCode: Enter a valid postal code, like K1A 0B1.',
    ]);
  });
});

describe('checks that hold for any typing', () => {
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

  // Letters from several scripts, digits, spaces, every kind of symbol, an emoji, a line break and a tab.
  const junkPool = [...'abcXYZéÅßñ李 -\'’.,#/&0123456789 @+()_!?<>"%$*=;:[]{}|\\^~`\n\t😀'];
  // Only the characters a name, a city or a street line may use, so that some typing is good.
  const nameLike = [...'abcXYZéÅßñ李 -\'’.'];
  const streetLike = [...'abcXYZéÅßñ李 -\'’.0123456789,#/&'];
  const emailLike = [...'abcdefghij0123456789._-+'];
  const formFields: FormField[] = ['country', 'firstName', 'lastName', 'address1', 'address2', 'city', 'province', 'postalCode'];
  const countryCodes = ['CA', 'US', 'GB', 'FR', 'DE', 'IE', 'IT', 'NL', 'ES', 'JP', 'ca', ' us ', ''];
  const goodPostalCodes: Record<string, string> = {
    CA: 'H2J 3K4',
    US: '97205',
    GB: 'se154qt',
    FR: '69003',
    DE: '10115',
    IE: 'a65f4e2',
    IT: '00144',
    NL: '1234ab',
    ES: '28039',
  };

  function text(random: () => number, longest: number, pool: string[]): string {
    const length = Math.floor(random() * longest);
    let result = '';
    for (let i = 0; i < length; i += 1) result += pool[Math.floor(random() * pool.length)];
    return result;
  }

  function oneOf<T>(random: () => number, values: T[]): T {
    return values[Math.floor(random() * values.length)];
  }

  /** Something a person, or a hand-made request, might send for a field. */
  function anything(random: () => number, longest: number, likely = nameLike): unknown {
    const roll = random();
    if (roll < 0.05) return undefined;
    if (roll < 0.1) return null;
    if (roll < 0.15) return Math.floor(random() * 1000);
    return roll < 0.7 ? text(random, longest, likely) : text(random, longest, junkPool);
  }

  function checkRules(values: object, label: string) {
    for (const [field, value] of Object.entries(values)) {
      if (value === undefined) continue;
      expect(typeof value, `${label} ${field}`).toBe('string');
      const text = value as string;
      expect(text, `${label} ${field}`).toBe(text.trim());
      expect(text, `${label} ${field}`).not.toMatch(/\s{2}|[\n\t]/);
      expect(text, `${label} ${field}`).not.toMatch(/[<>]/);
      expect(text.length, `${label} ${field}`).toBeGreaterThan(0);
    }
  }

  it('lead: never fails on odd input, and what it keeps is clean and stays the same when checked again', () => {
    const random = seeded(11);
    let kept = 0;
    let refused = 0;
    for (let i = 0; i < 600; i += 1) {
      const input = { firstName: anything(random, 60), email: random() < 0.6 ? `${text(random, 10, emailLike)}@example.com` : anything(random, 30) };
      const result = checkLead(input);
      if (result.ok) {
        kept += 1;
        checkRules(result.value, `lead ${i}`);
        expect(checkLead(result.value), `lead ${i}`).toEqual(result);
      } else {
        refused += 1;
        expect(result.problems.length).toBeGreaterThan(0);
      }
    }
    // Both outcomes must really happen, or the run proves nothing.
    expect(kept).toBeGreaterThan(20);
    expect(refused).toBeGreaterThan(20);
  });

  it('contact: never fails on odd input, and what it keeps is clean and stays the same when checked again', () => {
    const random = seeded(23);
    let kept = 0;
    for (let i = 0; i < 600; i += 1) {
      const digits = Array.from({ length: Math.floor(random() * 20) }, () => Math.floor(random() * 10)).join('');
      const input = {
        email: random() < 0.7 ? `${text(random, 10, emailLike)}@example.com` : anything(random, 30),
        phone: random() < 0.5 ? `${random() < 0.5 ? '+' : ''}${digits}` : anything(random, 20),
      };
      const result = checkContact(input);
      if (result.ok) {
        kept += 1;
        checkRules(result.value, `contact ${i}`);
        expect(checkContact(result.value), `contact ${i}`).toEqual(result);
      }
    }
    expect(kept).toBeGreaterThan(20);
  });

  it('address: never fails on odd input, reports each field at most once in form order, and keeps only clean values', () => {
    const random = seeded(37);
    let kept = 0;
    let refused = 0;
    for (let i = 0; i < 1000; i += 1) {
      const country = oneOf(random, countryCodes);
      const goodPostalCode = goodPostalCodes[country.trim().toUpperCase()] ?? '10115';
      const input = {
        firstName: random() < 0.7 ? 'Maya' : anything(random, 60),
        lastName: random() < 0.7 ? 'Tremblay' : anything(random, 60),
        address1: random() < 0.7 ? '47 Rue des Lilas' : anything(random, 100, streetLike),
        address2: random() < 0.6 ? undefined : anything(random, 100, streetLike),
        city: random() < 0.7 ? 'Montréal' : anything(random, 70),
        province: random() < 0.6 ? oneOf(random, [...PROVINCES.map((province) => province.code), 'on', 'XX']) : anything(random, 4),
        postalCode: random() < 0.7 ? goodPostalCode : anything(random, 12, [...'ABC0123456789 -']),
        country: random() < 0.9 ? country : anything(random, 4),
      };
      const result = checkAddress(input);
      if (result.ok) {
        kept += 1;
        checkRules(result.value, `address ${i}`);
        expect(checkAddress(result.value), `address ${i}`).toEqual(result);
      } else {
        refused += 1;
        const fields = result.problems.map((problem) => problem.field);
        expect(new Set(fields).size, `address ${i}`).toBe(fields.length);
        expect(fields, `address ${i}`).toEqual(formFields.filter((field) => fields.includes(field)));
        for (const problem of result.problems) expect(problem.message.length).toBeGreaterThan(5);
      }
    }
    expect(kept).toBeGreaterThan(20);
    expect(refused).toBeGreaterThan(20);
  });
});
