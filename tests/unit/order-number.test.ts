import { describe, expect, it } from 'vitest';
import { makeOrderNumber } from '../../src/server/order-number';

describe('makeOrderNumber', () => {
  it('is "SI-" and 8 characters from an alphabet with no 0, O, 1 or I', () => {
    for (let i = 0; i < 200; i += 1) expect(makeOrderNumber()).toMatch(/^SI-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  });

  it('uses the random function it is given, not the real one, so a test can make it deterministic', () => {
    const always = () => 0; // Always picks the alphabet's first character, A.
    expect(makeOrderNumber(always)).toBe('SI-AAAAAAAA');
  });

  it('is different from one call to the next, in ordinary use', () => {
    const numbers = new Set(Array.from({ length: 50 }, () => makeOrderNumber()));
    expect(numbers.size).toBeGreaterThan(45);
  });
});
