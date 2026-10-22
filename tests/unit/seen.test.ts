import { describe, expect, it } from 'vitest';
import { isSeen, seenAtRatio } from '../../src/tracking/seen';

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

// The browser tells a page that an element crossed one of the steps it was asked to watch, and only then. A step
// every 2.5% left a gap: on the 1,410 px Tees list a phone needs 333.5 px, but the nearest steps were at 317 px and
// 353 px, so the announcement came up to 19 px late. Asking for the exact share closes the gap.
describe('seenAtRatio', () => {
  it('is the share of the block at which it becomes seen, a hair above the exact value', () => {
    expect(seenAtRatio(1410, 667)).toBeCloseTo(333.5 / 1410 + 0.001, 6);
    expect(seenAtRatio(449, 800)).toBeCloseTo(0.501, 6);
    expect(seenAtRatio(1000, 600)).toBeCloseTo(0.301, 6);
  });

  it('asks for half when the block or the screen has no measurable height, and never for more than half and a hair', () => {
    expect(seenAtRatio(0, 800)).toBe(0.5);
    expect(seenAtRatio(449, 0)).toBe(0.5);
    expect(seenAtRatio(Number.NaN, 800)).toBe(0.5);
    expect(seenAtRatio(10, 10_000)).toBeCloseTo(0.501, 6);
  });

  it('is just enough: the block is seen at that share, and not at a share that is 0.2% smaller', () => {
    const measured = [
      [1244, 568],
      [1364, 640],
      [1410, 667],
      [781, 375],
      [1456, 844],
      [366, 1024],
      [449, 800],
    ];
    for (const [block, screen] of measured) {
      const ratio = seenAtRatio(block, screen);
      expect(isSeen(ratio * block, block, screen), `${block} on ${screen} at ${ratio}`).toBe(true);
      expect(isSeen((ratio - 0.002) * block, block, screen), `${block} on ${screen} just under`).toBe(false);
    }
  });
});
