import { describe, expect, it } from 'vitest';
import type { Colour } from '../../src/store/products';
import { DETAILS, MARKS, SHAPES, garmentLabel, garmentStyle, markColours } from '../../src/components/garments';

const COLOURS: Colour[] = ['Paper', 'Ink', 'Red', 'Blue', 'Sand'];

describe('SHAPES and DETAILS', () => {
  it('draws a shape for every kind of garment, closed and only with the letters an SVG path allows', () => {
    for (const [kind, path] of Object.entries(SHAPES)) {
      expect(path.trim().endsWith('Z'), kind).toBe(true);
      expect(path, kind).toMatch(/^[MLCQZ0-9.,\- \n]+$/i);
    }
  });

  it('draws the trouser details as lines only, with no fill', () => {
    for (const [kind, path] of Object.entries(DETAILS)) {
      expect(path, kind).not.toContain('Z');
    }
  });
});

describe('garmentStyle', () => {
  it('gives every colour a garment fill and a second ink that differs from it', () => {
    for (const colour of COLOURS) {
      const style = garmentStyle(colour);
      const garment = style.match(/--garment: ([^;]+);/)![1];
      const second = style.match(/--second: ([^;]+);/)![1];
      expect(second, colour).not.toBe(garment);
    }
  });

  it('gives every colour all four custom properties', () => {
    for (const colour of COLOURS) {
      for (const property of ['--garment', '--second', '--detail', '--collar']) {
        expect(garmentStyle(colour), `${colour} ${property}`).toContain(`${property}:`);
      }
    }
  });
});

describe('markColours', () => {
  it('keeps the mark readable against a light garment, by using the two spot inks', () => {
    const { first, second } = markColours('logo', 'Paper');
    expect([first, second].sort()).toEqual(['var(--spot-blue)', 'var(--spot-red)']);
  });

  it('keeps the mark readable against a dark garment, by using paper for the first ink', () => {
    for (const colour of ['Ink', 'Blue', 'Red'] as Colour[]) {
      expect(markColours('logo', colour).first, colour).toBe('var(--paper)');
    }
  });

  it('has two circles for every kind of print that has one', () => {
    for (const [print, circles] of Object.entries(MARKS)) {
      expect(circles, print).toHaveLength(2);
      for (const circle of circles) expect(circle.r, print).toBeGreaterThan(0);
    }
  });
});

describe('garmentLabel', () => {
  it('names the product and the colour for a plain garment', () => {
    expect(garmentLabel('Plain Tee', 'Ink', 'none')).toBe('Plain Tee in Ink');
  });

  it('says the mark is on the chest for the Logo Tee', () => {
    expect(garmentLabel('Logo Tee', 'Paper', 'logo')).toBe('Logo Tee in Paper, with a two-circle mark on the chest');
  });

  it('says the mark is off register for the Misprint Tee', () => {
    expect(garmentLabel('Misprint Tee', 'Red', 'misprint')).toBe(
      'Misprint Tee in Red, with a two-circle mark printed well off register',
    );
  });
});
