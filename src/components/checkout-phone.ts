import { buildPhone } from '../engine/phone';
import type { CountryCode } from '../store/destinations';

/**
 * The phone on the checkout's contact step is two controls, a list of country codes and the number box, and one string
 * is made of them: the number that is checked and sent (src/engine/phone.ts). This file only reads the two controls
 * and sets them. What is allowed, and what a typed number becomes, is decided in phone.ts, which is tested, so nothing
 * here knows a calling code or a home digit.
 */

const listIn = (form: ParentNode) => form.querySelector<HTMLSelectElement>('[name="phoneCountry"]')!;
const boxIn = (form: ParentNode) => form.querySelector<HTMLInputElement>('[name="phone"]')!;

/**
 * The phone as the two controls hold it now, in the form that is checked and sent. A number that came with a country
 * code the store does not ship to cannot be built, so what was typed comes back and the check says why.
 */
export function currentPhone(form: ParentNode): string {
  const typed = boxIn(form).value;
  const built = buildPhone(listIn(form).value as CountryCode, typed);
  return built.ok ? built.value : typed;
}

/** Whether the number box holds a number that brings its own country code, with a plus sign or 00 in front. */
export function bringsItsOwnCode(form: ParentNode): boolean {
  return /^\s*(\+|00)/.test(boxIn(form).value);
}

/**
 * Sets the two controls from a number: the list to the number's country and the box to what follows the code. A number
 * that came with its own code moves the list, and the country it moved to is given back. A number whose code the store
 * does not ship to sets nothing, so what was typed stays where the shopper can fix it.
 */
export function showPhone(form: ParentNode, country: CountryCode, text: string): CountryCode | undefined {
  const built = buildPhone(country, text);
  if (!built.ok) return undefined;
  const list = listIn(form);
  const moved = built.country !== list.value ? built.country : undefined;
  list.value = built.country;
  boxIn(form).value = built.number;
  return moved;
}

/** The country the list shows now, and what the number box holds, for showPhone to settle. */
export function settlePhone(form: ParentNode): CountryCode | undefined {
  return showPhone(form, listIn(form).value as CountryCode, boxIn(form).value);
}
