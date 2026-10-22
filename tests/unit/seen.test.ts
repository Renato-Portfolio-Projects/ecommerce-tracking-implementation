import { describe, expect, it } from 'vitest';
import { isSeen } from '../../src/tracking/seen';

// A block, such as a collection of products, counts as seen when half of it is visible, or when it fills
// half the screen, whichever is smaller. The numbers below were measured on the real home page: the Tees list
// is one column of three cards on a phone, and so is taller than twice the screen on most of them.

describe('isSeen', () => {
  it('needs half of a block that fits on the screen', () => {
    // A 449 px list on an 800 px screen: half of it is 224.5 px.
    expect(isSeen(225, 449, 800)).toBe(true);
    expect(isSeen(224, 449, 800)).toBe(false);
  });

  it('needs only half the screen from a block taller than twice the screen', () => {
    // The 375 x 667 phone: the list is 1,410 px, so what it must fill is half the screen, 333.5 px.
    expect(isSeen(334, 1410, 667)).toBe(true);
    expect(isSeen(333, 1410, 667)).toBe(false);
  });

  it('counts exactly the needed amount as seen', () => {
    expect(isSeen(100, 200, 800)).toBe(true);
    expect(isSeen(300, 1000, 600)).toBe(true);
  });

  it('can be satisfied on every screen that was measured, which plain "half the list" could not on four phones', () => {
    const measured = [
      { list: 1244, screen: 568 },
      { list: 1364, screen: 640 },
      { list: 1410, screen: 667 },
      { list: 781, screen: 375 },
      { list: 1456, screen: 844 },
      { list: 366, screen: 1024 },
      { list: 449, screen: 800 },
    ];
    const plainHalfCanFire = (list: number, screen: number) => Math.min(list, screen) / list >= 0.5;
    const phonesWherePlainHalfCannotFire = [];
    for (const { list, screen } of measured) {
      // The most of the list that can be on screen at once.
      const mostVisible = Math.min(list, screen);
      expect(isSeen(mostVisible, list, screen), `${list} px on a ${screen} px screen`).toBe(true);
      if (!plainHalfCanFire(list, screen)) phonesWherePlainHalfCannotFire.push(screen);
    }
    expect(phonesWherePlainHalfCannotFire).toEqual([568, 640, 667, 375]);
  });

  it('is not seen when nothing is visible, or the block has no height', () => {
    expect(isSeen(0, 449, 800)).toBe(false);
    expect(isSeen(0, 0, 800)).toBe(false);
    expect(isSeen(10, 0, 800)).toBe(false);
  });

  it('is not seen when the screen has no height, or a measurement is not a finite number', () => {
    expect(isSeen(100, 449, 0)).toBe(false);
    expect(isSeen(Number.NaN, 449, 800)).toBe(false);
    expect(isSeen(100, Number.NaN, 800)).toBe(false);
    expect(isSeen(Number.POSITIVE_INFINITY, 449, 800)).toBe(false);
    expect(isSeen(100, 449, Number.POSITIVE_INFINITY)).toBe(false);
  });
});
