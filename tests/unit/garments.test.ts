import { describe, expect, it } from 'vitest';
import type { Colour } from '../../src/store/products';
import { garmentLabel } from '../../src/components/garment-label';
import { COLLAR, DETAILS, MARKS, OFFSET, SHAPES, garmentStyle, garmentSvg, markColours } from '../../src/components/garments';

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

describe('garmentSvg', () => {
  it('draws the outline twice, the second ink first and shifted, with the body over it', () => {
    const svg = garmentSvg('chino', 'Sand', 'none', 'Plain Chino in Sand');
    expect(svg).toContain(`<path class="second" d="${SHAPES.chino}" transform="translate(${OFFSET.x} ${OFFSET.y})"></path>`);
    expect(svg).toContain(`<path class="body" d="${SHAPES.chino}"></path>`);
    expect(svg.indexOf('class="second"')).toBeLessThan(svg.indexOf('class="body"'));
  });

  it('gives a tee its collar and trousers their pockets and fly, never both', () => {
    const tee = garmentSvg('tee', 'Paper', 'none', 'Plain Tee in Paper');
    expect(tee).toContain(`<path class="collar" d="${COLLAR}"></path>`);
    expect(tee).not.toContain('class="detail"');
    for (const kind of ['chino', 'relaxed', 'pleated'] as const) {
      const trousers = garmentSvg(kind, 'Ink', 'none', 'trousers');
      expect(trousers, kind).toContain(`<path class="detail" d="${DETAILS[kind]}"></path>`);
      expect(trousers, kind).not.toContain('class="collar"');
    }
  });

  it('colours the drawing with the same custom properties the rest of the store uses', () => {
    for (const colour of COLOURS) {
      expect(garmentSvg('tee', colour, 'none', 'x'), colour).toContain(`style="${garmentStyle(colour)}"`);
    }
  });

  it('adds the two circles of a print in the colours the print is meant to have, and none otherwise', () => {
    expect(garmentSvg('tee', 'Paper', 'none', 'x')).not.toContain('<circle');
    for (const print of ['logo', 'misprint'] as const) {
      for (const colour of COLOURS) {
        const svg = garmentSvg('tee', colour, print, 'x');
        const [first, second] = MARKS[print];
        const inks = markColours(print, colour);
        expect(svg, `${print} ${colour}`).toContain(
          `<circle data-mark="first" cx="${first.x}" cy="${first.y}" r="${first.r}" style="fill: ${inks.first}"></circle>`,
        );
        expect(svg, `${print} ${colour}`).toContain(
          `<circle data-mark="second" cx="${second.x}" cy="${second.y}" r="${second.r}" style="fill: ${inks.second}; mix-blend-mode: ${inks.blend}"></circle>`,
        );
      }
    }
  });

  it('describes a labelled drawing to people who cannot see it, and can be found by the product page', () => {
    const svg = garmentSvg('tee', 'Ink', 'logo', 'Logo Tee in Ink, with a two-circle mark on the chest');
    expect(svg.startsWith('<svg class="garment" data-garment viewBox="0 0 200 200" role="img" aria-label="Logo Tee in Ink')).toBe(true);
    expect(svg).not.toContain('aria-hidden');
  });

  it('hides a drawing that has no label from people who cannot see it, because its words are beside it', () => {
    const svg = garmentSvg('tee', 'Ink', 'none');
    expect(svg.startsWith('<svg class="garment" viewBox="0 0 200 200" aria-hidden="true"')).toBe(true);
    expect(svg).not.toContain('role="img"');
    expect(svg).not.toContain('aria-label');
    expect(svg).not.toContain('data-garment');
  });

  it('keeps a label from breaking out of its attribute', () => {
    const svg = garmentSvg('tee', 'Ink', 'none', 'A "quoted" <name> & more');
    expect(svg).toContain('aria-label="A &quot;quoted&quot; &lt;name&gt; &amp; more"');
    expect(svg.match(/<svg/g)).toHaveLength(1);
  });
});
