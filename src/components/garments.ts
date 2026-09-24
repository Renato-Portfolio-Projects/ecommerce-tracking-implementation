// What the garment drawings are made of: the outlines, the colours and how a drawing is written out.
// src/components/Garment.astro puts them together. Everything is drawn on a 200 by 200 square.
//
// Each shape below is SVG path data: a short, standard mini-language of pen instructions, read as a
// letter followed by the coordinates it needs. There is no drawing software behind these, they were
// placed by hand on a 200 by 200 grid. The letters used here are:
//   M x y        move the pen to this point, without drawing (starts a new stroke)
//   L x y        draw a straight line to this point
//   H x / V y    draw a straight line, but only horizontally or only vertically, to this coordinate
//   C ... x y    draw a smooth curve using two control points, ending at x y (used once, for the tee)
//   Q x1 y1 x y  draw a smoother curve using one control point (x1 y1), ending at x y
//   Z            close the shape back to its start (only a filled outline needs this; a line does not)
// For example, 'M60 30 H140' moves to (60, 30) and draws a straight horizontal line to (140, 30): the
// waistband on a pair of trousers. A single path can hold several strokes one after another, each
// starting with its own M, the way DETAILS below draws the waistband, the fly and both pockets as one
// path per garment. The three cuts of trousers differ only in the numbers: a wider or narrower shape,
// and, for the pleated cut, two extra straight lines for the pleats.

import type { GarmentKind, Print } from '../store/art';
import type { Colour } from '../store/products';

/** The outline of each garment. See the file comment above for how to read the path data. */
export const SHAPES: Record<GarmentKind, string> = {
  tee: 'M62 28 L86 20 C92 36 108 36 114 20 L138 28 L182 56 L166 90 L144 78 L144 176 L56 176 L56 78 L34 90 L18 56 Z',
  chino: 'M60 14 L140 14 L148 190 L108 190 L100 84 L92 190 L52 190 Z',
  relaxed: 'M54 14 L146 14 L166 190 L114 190 L100 90 L86 190 L34 190 Z',
  pleated: 'M60 14 L140 14 L148 190 L108 190 L100 84 L92 190 L52 190 Z',
};

/** The waistband, fly, pockets and pleats of the trousers, drawn as lines over the shape. */
export const DETAILS: Record<Exclude<GarmentKind, 'tee'>, string> = {
  chino: 'M60 30 H140 M100 14 V62 M64 22 Q72 46 80 48 M136 22 Q128 46 120 48',
  relaxed: 'M54 30 H146 M100 14 V66 M60 22 Q70 48 80 50 M140 22 Q130 48 120 50',
  pleated: 'M60 30 H140 M100 14 V60 M78 16 L76 62 M122 16 L124 62 M64 22 Q72 46 80 48 M136 22 Q128 46 120 48',
};

/** The ribbed collar of a tee. */
export const COLLAR = 'M86 20 C92 36 108 36 114 20 L110 18 C105 29 95 29 90 18 Z';

/** How far the second ink is printed from the first, on the 200 by 200 drawing. */
export const OFFSET = { x: 2.5, y: 2 };

export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** The two circles of the mark, first ink and then second, for each kind of print. */
export const MARKS: Record<Exclude<Print, 'none'>, [Circle, Circle]> = {
  logo: [
    { x: 98, y: 72, r: 12 },
    { x: 103, y: 75, r: 12 },
  ],
  misprint: [
    { x: 90, y: 70, r: 15 },
    { x: 104, y: 80, r: 15 },
  ],
};

/** The one CSS colour each product colour paints with, used for both the garment drawing and a swatch. */
export const FILL: Record<Colour, string> = {
  Paper: 'var(--paper)',
  Ink: 'var(--ink)',
  Red: 'var(--spot-red)',
  Blue: 'var(--spot-blue)',
  Sand: 'var(--sand)',
};

/** The ink printed a little off, behind the garment. It is always the other spot ink. */
const SECOND_INK: Record<Colour, string> = {
  Paper: 'var(--spot-red)',
  Ink: 'var(--spot-blue)',
  Red: 'var(--spot-blue)',
  Blue: 'var(--spot-red)',
  Sand: 'var(--spot-blue)',
};

const DARK: Colour[] = ['Ink', 'Blue', 'Red'];

/** The custom properties that colour one garment, as the text of a style attribute. */
export function garmentStyle(colour: Colour): string {
  const dark = DARK.includes(colour);
  const detail = dark ? 'color-mix(in oklab, var(--paper) 55%, transparent)' : 'color-mix(in oklab, var(--ink) 35%, transparent)';
  const collar = colour === 'Ink' ? 'color-mix(in oklab, var(--ink) 60%, white)' : `color-mix(in oklab, ${FILL[colour]} 70%, black)`;
  return `--garment: ${FILL[colour]}; --second: ${SECOND_INK[colour]}; --detail: ${detail}; --collar: ${collar}`;
}

/** The two colours of a print on a garment, and how the second is laid over the first. */
export function markColours(print: Exclude<Print, 'none'>, colour: Colour): { first: string; second: string; blend: 'multiply' | 'normal' } {
  if (!DARK.includes(colour)) return { first: 'var(--spot-red)', second: 'var(--spot-blue)', blend: 'multiply' };
  if (print === 'logo') return { first: 'var(--paper)', second: 'var(--spot-red)', blend: 'normal' };
  return { first: 'var(--paper)', second: 'var(--ink)', blend: 'multiply' };
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * One garment drawing, written out as SVG text. Garment.astro uses it for the pages that are built
 * ahead of time, and the cart uses it in the browser for the small drawing beside each line, so the
 * two can never draw a garment differently. With a label the drawing describes itself to people who
 * cannot see it, and the product page can find it. Without one it is hidden from them, because the
 * words beside it already say what it is.
 */
export function garmentSvg(kind: GarmentKind, colour: Colour, print: Print, label?: string): string {
  const shape = SHAPES[kind];
  const parts = [
    `<path class="second" d="${shape}" transform="translate(${OFFSET.x} ${OFFSET.y})"></path>`,
    `<path class="body" d="${shape}"></path>`,
    kind === 'tee' ? `<path class="collar" d="${COLLAR}"></path>` : `<path class="detail" d="${DETAILS[kind]}"></path>`,
  ];
  if (print !== 'none') {
    const [first, second] = MARKS[print];
    const inks = markColours(print, colour);
    parts.push(
      `<circle data-mark="first" cx="${first.x}" cy="${first.y}" r="${first.r}" style="fill: ${inks.first}"></circle>`,
      `<circle data-mark="second" cx="${second.x}" cy="${second.y}" r="${second.r}" style="fill: ${inks.second}; mix-blend-mode: ${inks.blend}"></circle>`,
    );
  }
  const marker = label === undefined ? '' : 'data-garment ';
  const description = label === undefined ? 'aria-hidden="true"' : `role="img" aria-label="${escapeAttribute(label)}"`;
  return `<svg class="garment" ${marker}viewBox="0 0 200 200" ${description} style="${garmentStyle(colour)}">${parts.join('')}</svg>`;
}
