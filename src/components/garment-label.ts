import { fill } from '../engine/fill';
import type { Print } from '../store/art';
import type { Colour } from '../store/products';
import { WORDS } from '../store/words';

// This is apart from garments.ts on purpose. Every store page will carry the drawing code in its script, for
// the small drawing beside each cart line, and the words are a large part of the size of a script. So the
// words are kept in their own file, and only a page that has to describe a drawing takes them along.

/** The description of a drawing, for people who cannot see it. */
export function garmentLabel(product: string, colour: Colour, print: Print): string {
  const key = print === 'logo' ? 'garment.altLogo' : print === 'misprint' ? 'garment.altMisprint' : 'garment.alt';
  return fill(WORDS[key], { product, colour });
}
