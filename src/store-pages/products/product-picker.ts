import { garmentLabel } from '../../components/garment-label';
import { garmentStyle, markColours } from '../../components/garments';
import { fill } from '../../engine/fill';
import type { Print } from '../../store/art';
import type { Colour } from '../../store/products';

/**
 * Wires one product page's colour and size pickers. Colours are radio inputs, so choosing one is
 * already accessible and keyboard-operable for free; this only has to react to the choice.
 *
 * The garment drawing is one SVG whose colour comes from CSS custom properties (see
 * src/components/garments.ts), so recolouring it on a colour change is just writing a new `style`
 * attribute with the same `garmentStyle` function the page itself was built with. A print's two
 * ink circles are not custom properties, so they are recoloured directly.
 *
 * Sizes carry which colours they are sold out for as `data-sold-out-colours` JSON. Choosing a
 * colour disables the sizes sold out in it; if the shopper's chosen size was one of them, the
 * choice is cleared and `sizeSoldOut` explains why. Add to cart stays disabled until a size that
 * is not sold out is chosen.
 */
export function initProductPicker(
  root: ParentNode,
  productName: string,
  print: Print,
  words: { chooseSize: string; sizeSoldOut: string },
): void {
  const colourInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="colour"]')];
  const sizeInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="size"]')];
  const garment = root.querySelector<SVGSVGElement>('[data-garment]');
  const firstMark = root.querySelector<SVGCircleElement>('[data-mark="first"]');
  const secondMark = root.querySelector<SVGCircleElement>('[data-mark="second"]');
  const addButton = root.querySelector<HTMLButtonElement>('[data-add-to-cart]');
  const status = root.querySelector<HTMLElement>('[data-size-status]');
  if (colourInputs.length === 0 || sizeInputs.length === 0 || !garment || !addButton || !status) return;

  function applyColour(colour: Colour): void {
    garment!.setAttribute('style', garmentStyle(colour));
    garment!.setAttribute('aria-label', garmentLabel(productName, colour, print));
    if (print !== 'none' && firstMark && secondMark) {
      const marks = markColours(print, colour);
      firstMark.setAttribute('style', `fill: ${marks.first}`);
      secondMark.setAttribute('style', `fill: ${marks.second}; mix-blend-mode: ${marks.blend}`);
    }
  }

  /** Disables the sizes sold out in this colour. Returns whether the checked size was one of them. */
  function updateSizes(colour: Colour): boolean {
    let clearedCheckedSize = false;
    for (const input of sizeInputs) {
      const soldOutIn = JSON.parse(input.dataset.soldOutColours ?? '[]') as string[];
      const soldOut = soldOutIn.includes(colour);
      input.disabled = soldOut;
      if (soldOut && input.checked) {
        input.checked = false;
        clearedCheckedSize = true;
        status!.textContent = fill(words.sizeSoldOut, { size: input.value, colour });
      }
    }
    return clearedCheckedSize;
  }

  function updateAddButton(): void {
    addButton!.disabled = !sizeInputs.some((input) => input.checked);
  }

  colourInputs.forEach((input) =>
    input.addEventListener('change', () => {
      const colour = input.value as Colour;
      applyColour(colour);
      const cleared = updateSizes(colour);
      const stillHasASize = sizeInputs.some((size) => size.checked);
      if (!cleared && !stillHasASize) status!.textContent = words.chooseSize;
      updateAddButton();
    }),
  );

  sizeInputs.forEach((input) =>
    input.addEventListener('change', () => {
      status!.textContent = '';
      updateAddButton();
    }),
  );
}
