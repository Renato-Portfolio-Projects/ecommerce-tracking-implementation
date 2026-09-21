import type { CountryCode } from '../store/destinations';

export interface PostalCodeFormat {
  country: CountryCode;
  /** What people in that country call it, as it reads in a sentence. */
  name: string;
  /** The format in plain words. */
  format: string;
  /** A code in its standard form. */
  example: string;
  /** Matches a code in capitals, with single spaces, as typed. Only the shape is checked. */
  pattern: RegExp;
  /** Writes a code that matched, in capitals with no spaces or dashes, in its standard form. */
  standardForm: (compact: string) => string;
}

const asIs = (compact: string) => compact;
const spaceAfter = (count: number) => (compact: string) => `${compact.slice(0, count)} ${compact.slice(count)}`;

// The shapes follow the address data that Google publishes for its address forms. Only the shape of
// a code is checked. A code is not compared with the city or the province.
export const POSTAL_CODE_FORMATS: PostalCodeFormat[] = [
  {
    country: 'CA',
    name: 'postal code',
    format: 'Letter, digit, letter, a space, then digit, letter, digit',
    example: 'K1A 0B1',
    pattern: /^[ABCEGHJKLMNPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/,
    standardForm: spaceAfter(3),
  },
  {
    country: 'US',
    name: 'ZIP code',
    format: '5 digits, and optionally a dash and 4 more digits',
    example: '95014',
    pattern: /^\d{5}(?:[ -]\d{4})?$/,
    standardForm: (compact) => (compact.length > 5 ? `${compact.slice(0, 5)}-${compact.slice(5)}` : compact),
  },
  {
    country: 'GB',
    name: 'postcode',
    format: 'A code such as EC1A or M2, a space, then a digit and two letters',
    example: 'EC1A 1HQ',
    pattern: /^(?:GIR ?0AA|[A-Z]{1,2}\d[A-Z\d]? ?\d[ABD-HJLN-UW-Z]{2})$/,
    standardForm: (compact) => `${compact.slice(0, -3)} ${compact.slice(-3)}`,
  },
  {
    country: 'FR',
    name: 'postal code',
    format: '5 digits',
    example: '33380',
    pattern: /^\d{2} ?\d{3}$/,
    standardForm: asIs,
  },
  {
    country: 'DE',
    name: 'postal code',
    format: '5 digits',
    example: '26133',
    pattern: /^\d{5}$/,
    standardForm: asIs,
  },
  {
    country: 'IE',
    name: 'Eircode',
    format: 'A letter and two digits, a space, then 4 letters or digits',
    example: 'A65 F4E2',
    pattern: /^(?:[A-Z]\d{2}|D6W) ?[A-Z\d]{4}$/,
    standardForm: spaceAfter(3),
  },
  {
    country: 'IT',
    name: 'postal code',
    format: '5 digits',
    example: '00144',
    pattern: /^\d{5}$/,
    standardForm: asIs,
  },
  {
    country: 'NL',
    name: 'postal code',
    format: '4 digits, a space, then 2 letters',
    example: '1234 AB',
    pattern: /^[1-9]\d{3} ?(?:[A-RT-Z][A-Z]|S[BCE-RT-Z])$/,
    standardForm: spaceAfter(4),
  },
  {
    country: 'ES',
    name: 'postal code',
    format: '5 digits',
    example: '28039',
    pattern: /^\d{5}$/,
    standardForm: asIs,
  },
];

export type PostalCodeCheck = { ok: true; value: string } | { ok: false };

function formatFor(country: unknown): PostalCodeFormat | undefined {
  if (typeof country !== 'string') return undefined;
  return POSTAL_CODE_FORMATS.find((candidate) => candidate.country === country.trim().toUpperCase());
}

/** What to tell a shopper whose postal code is wrong: what that country calls it, and an example. */
export function postalCodeHelp(country: unknown): string {
  const format = formatFor(country);
  return format ? `Enter a valid ${format.name}, like ${format.example}.` : 'Enter a valid postal code.';
}

/**
 * Checks a typed postal code for a country. Capitals, spaces around the code and a missing or
 * doubled inner space do not matter, and the code that comes back is always in its standard form.
 * The result is `ok: false` when the country is not one the store ships to or the shape is wrong.
 */
export function checkPostalCode(country: unknown, typed: unknown): PostalCodeCheck {
  const format = formatFor(country);
  if (!format || typeof typed !== 'string') return { ok: false };

  const tidy = typed.trim().replace(/\s+/g, ' ').toUpperCase();
  if (!format.pattern.test(tidy)) return { ok: false };
  return { ok: true, value: format.standardForm(tidy.replace(/[ -]/g, '')) };
}
