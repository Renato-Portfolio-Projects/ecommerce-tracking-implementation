import { addItem } from '../../components/cart-client';
import { garmentStyle, markColours } from '../../components/garments';
import type { ListContext } from '../../engine/catalog';
import { fill } from '../../engine/fill';
import { listHandoffKey, parseListContext } from '../../engine/list-handoff';
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
 *
 * Pressing Add to cart puts the chosen colour, size and quantity in the cart (through cart-client.ts,
 * which owns the saved cart), together with the list the shopper picked the product from, if the
 * home page left one for this page to read. Then it asks for the cart drawer to open by announcing
 * `cart:open`; the drawer opening with the item in it is the confirmation. If the cart refuses the
 * item, for example because the cart is full, nothing is added and the reason is written in the same
 * line that asks for a size.
 *
 * The description of the drawing is not built here from the words file, which would make this script
 * carry every word. The page hands over the one sentence it needs (`words.label`, from
 * `garmentLabelTemplate`), with blanks for the product and the colour.
 */
export function initProductPicker(
  root: HTMLElement,
  productName: string,
  print: Print,
  words: { label: string; chooseSize: string; sizeSoldOut: string },
): void {
  const colourInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="colour"]')];
  const sizeInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="size"]')];
  const garment = root.querySelector<SVGSVGElement>('[data-garment]');
  const firstMark = root.querySelector<SVGCircleElement>('[data-mark="first"]');
  const secondMark = root.querySelector<SVGCircleElement>('[data-mark="second"]');
  const addButton = root.querySelector<HTMLButtonElement>('[data-add-to-cart]');
  const status = root.querySelector<HTMLElement>('[data-size-status]');
  const quantityInput = root.querySelector<HTMLInputElement>('[data-quantity]');
  if (colourInputs.length === 0 || sizeInputs.length === 0 || !garment || !addButton || !status || !quantityInput) return;

  // Which list the shopper picked this product from (for example the Tees row on the home page), which
  // the home page's card link wrote for this page. It is read once and cleared, so a refresh of this
  // page, or a shared link, which no list led to, has none. A browser that blocks storage has none either.
  const sku = root.dataset.sku ?? '';
  let list: ListContext | undefined;
  try {
    list = parseListContext(sessionStorage.getItem(listHandoffKey(sku)));
    sessionStorage.removeItem(listHandoffKey(sku));
  } catch {
    list = undefined;
  }

  function applyColour(colour: Colour): void {
    garment!.setAttribute('style', garmentStyle(colour));
    garment!.setAttribute('aria-label', fill(words.label, { product: productName, colour }));
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

  addButton.addEventListener('click', () => {
    const colour = colourInputs.find((input) => input.checked)?.value;
    const size = sizeInputs.find((input) => input.checked)?.value;
    // The button is disabled until a size is chosen, so this is only a guard.
    if (!colour || !size) return;

    // The quantity is whatever the field holds. The cart's own rules decide if it is allowed: a whole
    // number from one to the limit for a line, or the add is refused. Adding more of a line that is
    // already in the cart is not refused; it stops at the limit, and the drawer says so.

    const result = addItem({ sku, colour, size, quantity: Number(quantityInput.value) }, list);
    if (!result.ok) {
      status!.textContent = result.problem.message;
      return;
    }
    document.dispatchEvent(new CustomEvent('cart:open'));
  });
}
