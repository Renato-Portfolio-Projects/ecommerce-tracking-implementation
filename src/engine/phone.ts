import { COUNTRIES, type CountryCode, type PhoneRule } from '../store/destinations.js';

// A phone number goes to the order as one string: a plus sign, the calling code, a space, then the number as the
// shopper typed it with the national prefix left off. So the calling code takes the place of that digit when the
// country has one: 07700 900123 becomes +44 7700 900123, and an Italian 06 1234 5678 becomes +39 06 1234 5678.
// These functions build that string from the country list and the number box, and check it. Only the shape and the
// length of a number are looked at, never whether it exists. The same code runs in the shopper's browser and on the
// server, so a hand-made request cannot skip it.

/**
 * `country` is the country the list should show, `value` is the number as it is sent, and `number` is what follows the
 * code in it: what the number box should show, which is not what was typed when the number came with its own code.
 */
export type PhoneBuild =
  | { ok: true; country: CountryCode; value: string; number: string }
  | { ok: false; reason: 'unknown-code' };

/**
 * `unknown-code`: there is no calling code from the list at the front. `wrong-number`: the code is one of ours, and
 * the rest breaks that country's rule, which is given by its calling code.
 */
export type PhoneCheck =
  | { ok: true; value: string }
  | { ok: false; reason: 'unknown-code' }
  | { ok: false; reason: 'wrong-number'; callingCode: string };

const RULES = new Map<string, PhoneRule>();
for (const country of COUNTRIES) {
  if (!RULES.has(country.phone.callingCode)) RULES.set(country.phone.callingCode, country.phone);
}
const LONGEST_CODE = Math.max(...[...RULES.keys()].map((code) => code.length));

/**
 * Reads a calling code off the front of text that follows a plus sign or a 00, and gives back its rule and what is
 * left. No code starts with another, so the first code the digits spell is the only one. Spaces between the digits
 * do not matter. Anything else before a code is complete means there is no code.
 */
function readCode(text: string): { rule: PhoneRule; rest: string } | undefined {
  let digits = '';
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char >= '0' && char <= '9') {
      digits += char;
      const rule = RULES.get(digits);
      if (rule !== undefined) return { rule, rest: text.slice(index + 1) };
      if (digits.length === LONGEST_CODE) return undefined;
    } else if (char !== ' ') {
      return undefined;
    }
  }
  return undefined;
}

/** A number with the spaces, dots and hyphens trimmed off its front, where a removed digit may have left some. */
function tidy(text: string): string {
  return text.trim().replace(/^[\s.-]+/, '');
}

/**
 * Takes the national prefix off the front of a number, when the first digit typed is that prefix. The rest stays as
 * typed. A prefix in brackets, as in (0) 7700 900123, goes with its brackets.
 */
function dropPrefix(text: string, prefix: string | undefined): string {
  const first = /\d/.exec(text);
  if (prefix === undefined || first === null || first[0] !== prefix) return tidy(text);
  const without = text.slice(0, first.index) + text.slice(first.index + 1);
  return tidy(without.replace(/\(\s*\)/, ''));
}

/** The number as it is sent. With nothing after the code it is the code alone, so a check can ask for the rest. */
function written(callingCode: string, number: string): string {
  return number === '' ? `+${callingCode}` : `+${callingCode} ${number}`;
}

/**
 * Builds the number that is sent from the country picked in the list and what was typed in the number box. An empty
 * box sends nothing, whatever the list says. A number that starts with a plus sign or 00 brings its own calling code:
 * the list moves to that country (staying put when it already has that code, which Canada and the United States
 * share), and the code is taken off the front. A code the store does not ship to is refused. The rest of the number
 * is not judged here, which is the check's job.
 */
export function buildPhone(country: CountryCode, typedNumber: string): PhoneBuild {
  const picked = COUNTRIES.find((candidate) => candidate.code === country);
  if (picked === undefined) return { ok: false, reason: 'unknown-code' };

  const typed = typedNumber.trim().replace(/\s+/g, ' ');
  if (typed === '') return { ok: true, country, value: '', number: '' };

  const withCode = typed.startsWith('+') ? typed.slice(1) : typed.startsWith('00') ? typed.slice(2) : undefined;
  if (withCode === undefined) {
    const number = dropPrefix(typed, picked.phone.nationalPrefix);
    return { ok: true, country, value: written(picked.phone.callingCode, number), number };
  }

  const read = readCode(withCode);
  if (read === undefined) return { ok: false, reason: 'unknown-code' };
  const { callingCode, nationalPrefix } = read.rule;
  const moved = [picked, ...COUNTRIES].find((candidate) => candidate.phone.callingCode === callingCode) ?? picked;
  const number = dropPrefix(read.rest, nationalPrefix);
  return { ok: true, country: moved.code, value: written(callingCode, number), number };
}

/** A number the check refused. */
export type PhoneFailure = Exclude<PhoneCheck, { ok: true }>;

const PICK_A_CODE = 'Pick a country code from the list, or leave the number empty.';

/**
 * What to tell a shopper whose number was refused. No code, or one that is not in the list, asks for one from the
 * list. Anything else names the country's code and says how many digits it takes, and that a home digit at the start
 * does not count, since the shopper may have typed one and it is dropped.
 */
export function phoneProblem(failure: PhoneFailure): string {
  if (failure.reason === 'unknown-code') return PICK_A_CODE;
  const rule = RULES.get(failure.callingCode);
  if (rule === undefined) return PICK_A_CODE;

  const { fewest, most } = rule.digits;
  const count = fewest === most ? `${most}` : most - fewest === 1 ? `${fewest} or ${most}` : `${fewest} to ${most}`;
  const home = rule.nationalPrefix === undefined ? '' : `, not counting a ${rule.nationalPrefix} at the start`;
  return `That phone number doesn't look right. For +${failure.callingCode}, use ${count} digits${home}, or leave it empty.`;
}

/**
 * Checks a number as it is sent, in the browser and again on the server. It must start with a plus sign and one of the
 * store's calling codes. After that it may hold digits, spaces, brackets, dots and hyphens, with the number of digits
 * that country allows. It must not start with the national prefix, which the code replaces, and a country with a
 * numbering plan of its own, such as Canada and the United States, must fit it. What comes back is the number with one
 * space after the code and the shopper's own spacing after that.
 */
export function checkPhoneNumber(phone: string): PhoneCheck {
  const typed = phone.trim().replace(/\s+/g, ' ');
  if (!typed.startsWith('+')) return { ok: false, reason: 'unknown-code' };
  const read = readCode(typed.slice(1));
  if (read === undefined) return { ok: false, reason: 'unknown-code' };

  const { callingCode, nationalPrefix, digits, shape } = read.rule;
  const number = tidy(read.rest);
  const only = number.replace(/\D/g, '');
  const wrong = { ok: false, reason: 'wrong-number', callingCode } as const;
  if (!/^[\d\s().-]*$/.test(number)) return wrong;
  if (only.length < digits.fewest || only.length > digits.most) return wrong;
  if (nationalPrefix !== undefined && only.startsWith(nationalPrefix)) return wrong;
  if (shape !== undefined && !shape.test(only)) return wrong;
  return { ok: true, value: written(callingCode, number) };
}
