import { fill } from '../engine/fill';
import type { Print } from '../store/art';
import type { Colour } from '../store/products';
import { WORDS } from '../store/words';

// This is apart from garments.ts on purpose. Every store page carries the drawing code in its script, for
// the small drawing beside each cart line, and the words are a large part of the size of a script. So the
// page that has to describe a drawing as it changes colour is given the one sentence it needs, with blanks
// for the product and the colour, instead of carrying all the words.

/** The sentence that describes a drawing with this print, with blanks for {product} and {colour}. */
export function garmentLabelTemplate(print: Print): string {
  return WORDS[print === 'logo' ? 'garment.altLogo' : print === 'misprint' ? 'garment.altMisprint' : 'garment.alt'];
}

/** The description of a drawing, for people who cannot see it. */
export function garmentLabel(product: string, colour: Colour, print: Print): string {
  return fill(garmentLabelTemplate(print), { product, colour });
}
