import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEST_CARD,
  TEST_CARDS,
  checkPayment,
  demoCard,
  formatCardNumber,
  testCardExpiry,
  type CardProblem,
  type PaymentCheck,
} from '../../src/shop/test-cards';

/** A moment in the middle of a month, so a test does not depend on the day it runs. */
const now = Date.UTC(2026, 8, 21, 12, 0, 0);
const goodExpiry = '12/30';
const goodCode = '123';

const NOT_A_TEST_CARD =
  'This is a demo store, so only test cards work. Please don\'t enter a real card number. Use the "Use test card" button.';
const DECLINED =
  'Your card was declined. This is the test card that always declines. Use the "Use test card" button to try one that works.';

const visa = { number: '4242 4242 4242 4242', expiry: goodExpiry, securityCode: goodCode };

function problemsOf(result: PaymentCheck): string[] {
  return result.status === 'invalid' ? result.problems.map((problem: CardProblem) => `${problem.field}: ${problem.message}`) : [];
}

/** The standard card-number checksum. */
function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

describe('TEST_CARDS', () => {
  it('has the two cards that work and the one that always declines', () => {
    expect(TEST_CARDS.map((card) => [card.number, card.brand, card.result])).toEqual([
      ['4242424242424242', 'Visa', 'accepted'],
      ['5555555555554444', 'Mastercard', 'accepted'],
      ['4000000000000002', 'Visa', 'declined'],
    ]);
  });

  it('lists each number once, and each one passes the standard card checksum like a real number would', () => {
    expect(new Set(TEST_CARDS.map((card) => card.number)).size).toBe(TEST_CARDS.length);
    for (const card of TEST_CARDS) expect(passesLuhn(card.number), card.number).toBe(true);
  });

  it('makes the first card, the one that works, the default', () => {
    expect(DEFAULT_TEST_CARD).toBe(TEST_CARDS[0]);
    expect(DEFAULT_TEST_CARD.result).toBe('accepted');
  });
});

describe('formatCardNumber', () => {
  it('groups the digits in fours', () => {
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242');
    expect(formatCardNumber('4000000000000002')).toBe('4000 0000 0000 0002');
    expect(formatCardNumber('12345')).toBe('1234 5');
    expect(formatCardNumber('123')).toBe('123');
    expect(formatCardNumber('')).toBe('');
  });
});

describe('checkPayment with a card that works', () => {
  it('accepts the Visa test card and keeps only its brand and last four digits', () => {
    expect(checkPayment(visa, now)).toEqual({ status: 'accepted', card: { brand: 'Visa', last4: '4242' } });
  });

  it('accepts the Mastercard test card', () => {
    const result = checkPayment({ ...visa, number: '5555 5555 5555 4444' }, now);
    expect(result).toEqual({ status: 'accepted', card: { brand: 'Mastercard', last4: '4444' } });
  });

  it('reads the number with spaces, dashes or none, and with spaces around it', () => {
    for (const number of ['4242424242424242', '4242-4242-4242-4242', ' 4242 4242 4242 4242 ', '42424242 42424242']) {
      expect(checkPayment({ ...visa, number }, now).status, number).toBe('accepted');
    }
  });

  it('keeps nothing of the card but its brand and last four digits, not even in the answer for a mistake', () => {
    const answers = [
      checkPayment(visa, now),
      checkPayment({ ...visa, number: '4000 0000 0000 0002' }, now),
      checkPayment({ ...visa, number: '4111 1111 1111 1111' }, now),
      checkPayment({ number: '4242 4242 4242 4242', expiry: '01/20', securityCode: '12' }, now),
    ];
    for (const answer of answers) {
      expect(JSON.stringify(answer)).not.toMatch(/\d{5,}/);
      if (answer.status !== 'invalid') expect(Object.keys(answer.card).sort()).toEqual(['brand', 'last4']);
    }
  });
});

describe('the decline card', () => {
  it('is declined with a message that says why, when everything else is fine', () => {
    const result = checkPayment({ ...visa, number: '4000 0000 0000 0002' }, now);
    expect(result).toEqual({ status: 'declined', card: { brand: 'Visa', last4: '0002' }, message: DECLINED });
  });

  it('asks for a good expiry date first, instead of being declined', () => {
    const result = checkPayment({ number: '4000000000000002', expiry: '01/20', securityCode: goodCode }, now);
    expect(problemsOf(result)).toEqual(['expiry: That card has expired. Enter a date in the future.']);
  });
});

describe('a number that is not one of the test cards', () => {
  it('is turned down with one friendly message, however real it looks', () => {
    // Real-looking numbers that pass the checksum, the well-known Amex and older Visa test numbers, and junk.
    const numbers = ['4111 1111 1111 1111', '3782 822463 10005', '4012 8888 8888 1881', '6011 1111 1111 1117', '4242 4242 4242 4241', '4242', '0000 0000 0000 0000', 'abcd efgh ijkl mnop', '4242 4242 4242 4242 4'];
    for (const number of numbers) {
      expect(problemsOf(checkPayment({ ...visa, number }, now)), number).toEqual([`number: ${NOT_A_TEST_CARD}`]);
    }
  });

  it('never repeats what was typed', () => {
    const answer = JSON.stringify(checkPayment({ ...visa, number: '4111 1111 1111 1111' }, now));
    expect(answer).not.toContain('4111');
  });
});

describe('the expiry date', () => {
  it('takes any month from this one on, written as MM/YY', () => {
    for (const expiry of ['09/26', '10/26', '12/26', '01/27', '12/30', '1/30', '01 / 30', ' 12/99 ']) {
      expect(checkPayment({ ...visa, expiry }, now).status, expiry).toBe('accepted');
    }
  });

  it('turns down a month that is over, but not this month, which is good to its last day', () => {
    for (const expiry of ['08/26', '12/25', '01/20', '12/00']) {
      expect(problemsOf(checkPayment({ ...visa, expiry }, now)), expiry).toEqual([
        'expiry: That card has expired. Enter a date in the future.',
      ]);
    }
    const lastMoment = Date.UTC(2026, 8, 30, 23, 59, 59, 999);
    const firstMomentOfNextMonth = Date.UTC(2026, 9, 1, 0, 0, 0, 0);
    expect(checkPayment({ ...visa, expiry: '09/26' }, lastMoment).status).toBe('accepted');
    expect(checkPayment({ ...visa, expiry: '09/26' }, firstMomentOfNextMonth).status).toBe('invalid');
  });

  it('asks for MM/YY when it is empty or written another way', () => {
    for (const expiry of ['', '   ', '00/30', '13/30', '12/2030', '1230', '12-30', '12/3', 'ab/cd', undefined, null, 1230]) {
      expect(problemsOf(checkPayment({ ...visa, expiry }, now)), String(expiry)).toEqual(['expiry: Enter the expiry date as MM/YY.']);
    }
  });
});

describe('the security code', () => {
  it('takes any 3 digits', () => {
    for (const securityCode of ['123', '000', '999', ' 456 ']) {
      expect(checkPayment({ ...visa, securityCode }, now).status, securityCode).toBe('accepted');
    }
  });

  it('asks for 3 digits when it is empty, or has other digits, letters or spaces', () => {
    for (const securityCode of ['', '12', '1234', 'abc', '12a', '1 2 3', undefined, null, 123]) {
      expect(problemsOf(checkPayment({ ...visa, securityCode }, now)), String(securityCode)).toEqual([
        'securityCode: Enter the 3-digit security code.',
      ]);
    }
  });
});

describe('asking for everything at once', () => {
  it('reports the number, then the expiry, then the code, one problem for each', () => {
    expect(problemsOf(checkPayment({}, now))).toEqual([
      'number: Enter the card number.',
      'expiry: Enter the expiry date as MM/YY.',
      'securityCode: Enter the 3-digit security code.',
    ]);
    expect(problemsOf(checkPayment({ number: 42, expiry: {}, securityCode: [] }, now))).toEqual([
      'number: Enter the card number.',
      'expiry: Enter the expiry date as MM/YY.',
      'securityCode: Enter the 3-digit security code.',
    ]);
  });
});

describe('the "Use test card" button', () => {
  it('fills the default card, an expiry date far enough ahead, and a code', () => {
    expect(demoCard(now)).toEqual({ number: '4242 4242 4242 4242', expiry: '12/29', securityCode: '123' });
  });

  it('picks December three years on, which changes with the year', () => {
    expect(testCardExpiry(Date.UTC(2026, 0, 1))).toBe('12/29');
    expect(testCardExpiry(Date.UTC(2026, 11, 31, 23, 59, 59))).toBe('12/29');
    expect(testCardExpiry(Date.UTC(2027, 0, 1))).toBe('12/30');
  });

  it('always fills a card that is accepted, on every day of the coming decades, so it never goes stale', () => {
    let checked = 0;
    for (let year = 2026; year <= 2090; year += 1) {
      for (let month = 0; month < 12; month += 1) {
        for (const day of [1, 28]) {
          const moment = Date.UTC(year, month, day, 23, 59, 59);
          expect(checkPayment(demoCard(moment), moment).status, `${year}-${month + 1}-${day}`).toBe('accepted');
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(1500);
  });
});

describe('payment checks that hold for any typing', () => {
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

  function digits(random: () => number, length: number): string {
    let text = '';
    for (let i = 0; i < length; i += 1) text += Math.floor(random() * 10);
    return text;
  }

  /** A made-up number of the given length that passes the checksum, the way a real number does. */
  function luhnNumber(random: () => number, first: string, length: number): string {
    const body = first + digits(random, length - first.length - 1);
    for (let check = 0; check < 10; check += 1) {
      if (passesLuhn(body + check)) return body + check;
    }
    throw new Error('unreachable');
  }

  it('never accepts a real-looking number, only the three test numbers', () => {
    const random = seeded(99);
    const known = new Set(TEST_CARDS.map((card) => card.number));
    let looksReal = 0;
    for (let i = 0; i < 600; i += 1) {
      const number = luhnNumber(random, random() < 0.5 ? '4' : '5', random() < 0.8 ? 16 : 15);
      if (known.has(number)) continue;
      looksReal += 1;
      const result = checkPayment({ number, expiry: goodExpiry, securityCode: goodCode }, now);
      expect(problemsOf(result), number).toEqual([`number: ${NOT_A_TEST_CARD}`]);
    }
    expect(looksReal).toBeGreaterThan(500);
  });

  it('answers the three test cards the same way however the number is spaced', () => {
    const random = seeded(5);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i += 1) {
      const card = TEST_CARDS[Math.floor(random() * TEST_CARDS.length)];
      let number = '';
      for (const digit of card.number) number += random() < 0.3 ? `${digit}${random() < 0.5 ? ' ' : '-'}` : digit;
      const result = checkPayment({ number: ` ${number} `, expiry: goodExpiry, securityCode: goodCode }, now);
      expect(result.status, number).toBe(card.result);
      seen.add(result.status);
    }
    // Both good answers must really happen, or the run proves nothing.
    expect([...seen].sort()).toEqual(['accepted', 'declined']);
  });

  it('never fails on odd input, and only ever accepts a card that is in the list', () => {
    const random = seeded(2026);
    const pool = [...'0123456789  -/abcXYZ<>"\'\n😀+.'];
    const odd = (): unknown => {
      const roll = random();
      if (roll < 0.1) return undefined;
      if (roll < 0.15) return null;
      if (roll < 0.2) return Math.floor(random() * 100000);
      let text = '';
      for (let i = 0; i < Math.floor(random() * 24); i += 1) text += pool[Math.floor(random() * pool.length)];
      return text;
    };
    const statuses = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      const result = checkPayment({ number: odd(), expiry: odd(), securityCode: odd() }, now);
      statuses.add(result.status);
      expect(JSON.stringify(result)).not.toMatch(/\d{5,}/);
      if (result.status === 'invalid') {
        const fields = result.problems.map((problem) => problem.field);
        expect(new Set(fields).size).toBe(fields.length);
        expect(fields).toEqual((['number', 'expiry', 'securityCode'] as const).filter((field) => fields.includes(field)));
      }
    }
    expect([...statuses]).toEqual(['invalid']);
  });
});
