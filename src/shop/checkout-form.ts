import { COUNTRIES, PROVINCES, type CountryCode } from './destinations';
import { checkPostalCode, postalCodeHelp } from './postal-codes';

// These checks look at the shape of what was typed and nothing else. Nothing is looked up, and a
// postal code is not compared with a city or a province. The same code runs in the shopper's browser,
// for quick and friendly messages, and on the server, so a hand-made request cannot skip it.

const NAME_LENGTH = 50;
const CITY_LENGTH = 60;
const ADDRESS_LENGTH = 80;
const EMAIL_LENGTH = 254;
const LOCAL_PART_LENGTH = 64;
const DOMAIN_PART_LENGTH = 63;
const PHONE_DIGITS = { fewest: 7, most: 15 };

// Letters and digits from any language, with their accents, then those, spaces, apostrophes, hyphens and periods.
const NAME_PATTERN = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '’.-]*$/u;
// Starts with a letter, a digit or a #, then those and a few marks that addresses use.
const STREET_PATTERN = /^[\p{L}\p{M}\p{N}#][\p{L}\p{M}\p{N} .,'’#/&-]*$/u;
// The part of an email before the @: letters and digits from any language, and the marks email allows.
// Dots may only sit between characters, never first, last or doubled.
const LOCAL_PART_PATTERN = /^[\p{L}\p{M}\p{N}!#$%&'*+/=?^_`{|}~-]+(?:\.[\p{L}\p{M}\p{N}!#$%&'*+/=?^_`{|}~-]+)*$/u;
// One dot-separated part of an email's domain: letters, digits and hyphens, not starting or ending with a hyphen.
const DOMAIN_PART_PATTERN = /^[\p{L}\p{M}\p{N}](?:[\p{L}\p{M}\p{N}-]*[\p{L}\p{M}\p{N}])?$/u;
// Endings that are set aside so they can never belong to anyone, and so can never receive mail.
const RESERVED_EMAIL_ENDINGS = ['test', 'example', 'invalid', 'localhost'];
const PHONE_PATTERN = /^\+?[\d\s().-]+$/;

export type FormField =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'country'
  | 'address1'
  | 'address2'
  | 'city'
  | 'province'
  | 'postalCode';

export interface FieldProblem {
  field: FormField;
  /** Plain words a shopper could read. */
  message: string;
}

export type FormCheck<T> = { ok: true; value: T } | { ok: false; problems: FieldProblem[] };

// Each field arrives as `unknown`, so the server can pass on whatever a request held. Anything that
// is not text counts as nothing typed.
export interface LeadInput {
  firstName?: unknown;
  email?: unknown;
}

export interface ContactInput {
  email?: unknown;
  phone?: unknown;
}

export interface AddressInput {
  country?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  address1?: unknown;
  address2?: unknown;
  city?: unknown;
  province?: unknown;
  postalCode?: unknown;
}

export interface Lead {
  firstName: string;
  email: string;
}

export interface Contact {
  email: string;
  /** Left out when the shopper did not give one. */
  phone?: string;
}

export interface Address {
  country: CountryCode;
  firstName: string;
  lastName: string;
  address1: string;
  /** Left out when empty. */
  address2?: string;
  city: string;
  /** Only for Canada, where the tax depends on it. */
  province?: string;
  /** In the country's standard form. */
  postalCode: string;
}

type Checked = string | undefined | FieldProblem;

const problem = (field: FormField, message: string): FieldProblem => ({ field, message });
const isProblem = (checked: unknown): checked is FieldProblem =>
  typeof checked === 'object' && checked !== null && 'field' in checked;

/** What was typed, with the ends trimmed and every run of spaces or line breaks made into one space. */
function typed(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

/**
 * Puts the result of each field together. Any problems come back in the order the fields were given.
 * Otherwise the values come back, without the optional ones that were left out.
 */
function gather<R extends Record<string, Checked>>(
  results: R,
): { ok: true; value: { [K in keyof R]: Exclude<R[K], FieldProblem> } } | { ok: false; problems: FieldProblem[] } {
  const problems = Object.values(results).filter(isProblem);
  if (problems.length > 0) return { ok: false, problems };
  const value = Object.fromEntries(Object.entries(results).filter(([, kept]) => kept !== undefined));
  return { ok: true, value: value as { [K in keyof R]: Exclude<R[K], FieldProblem> } };
}

/**
 * Whether text is shaped like an email address a person could really have. It follows the email
 * standard's own rules for the part before the @, allows letters from any language, and asks for a
 * domain of at least two parts that ends in two or more characters that are not all digits. Quoted
 * names, addresses in square brackets and single-word domains such as localhost are refused, because
 * nobody at a shop has one and a typo is far more likely.
 */
function looksLikeEmail(email: string): boolean {
  const at = email.indexOf('@');
  if (email.length > EMAIL_LENGTH || at < 1 || at !== email.lastIndexOf('@')) return false;

  const local = email.slice(0, at);
  const parts = email.slice(at + 1).split('.');
  if (local.length > LOCAL_PART_LENGTH || !LOCAL_PART_PATTERN.test(local)) return false;
  if (parts.length < 2) return false;
  if (!parts.every((part) => part.length <= DOMAIN_PART_LENGTH && DOMAIN_PART_PATTERN.test(part))) return false;

  const ending = parts[parts.length - 1].toLowerCase();
  return ending.length >= 2 && !/^\d+$/.test(ending) && !RESERVED_EMAIL_ENDINGS.includes(ending);
}

function checkName(field: 'firstName' | 'lastName', input: unknown): string | FieldProblem {
  const label = field === 'firstName' ? 'first' : 'last';
  const name = typed(input);
  if (name === '') return problem(field, `Enter your ${label} name.`);
  if (name.length > NAME_LENGTH || !NAME_PATTERN.test(name)) {
    return problem(
      field,
      `Your ${label} name can only use letters, numbers, spaces, apostrophes, hyphens and periods, up to ${NAME_LENGTH} characters.`,
    );
  }
  return name;
}

function checkEmail(input: unknown): string | FieldProblem {
  const email = typed(input);
  if (email === '') return problem('email', 'Enter your email address.');
  if (!looksLikeEmail(email)) {
    return problem('email', "That email address doesn't look right. It should look like name@example.com.");
  }
  return email;
}

function checkPhone(input: unknown): Checked {
  const phone = typed(input);
  if (phone === '') return undefined;
  const digits = phone.replace(/\D/g, '').length;
  if (!PHONE_PATTERN.test(phone) || digits < PHONE_DIGITS.fewest || digits > PHONE_DIGITS.most) {
    return problem(
      'phone',
      `That phone number doesn't look right. Use ${PHONE_DIGITS.fewest} to ${PHONE_DIGITS.most} digits, or leave it empty.`,
    );
  }
  return phone;
}

function checkCountry(input: unknown): CountryCode | FieldProblem {
  const code = typed(input).toUpperCase();
  const country = COUNTRIES.find((candidate) => candidate.code === code);
  return country ? country.code : problem('country', 'Choose a country we ship to.');
}

function checkStreetLine(field: 'address1' | 'address2', input: unknown): string | FieldProblem {
  const line = typed(input);
  if (line === '') return problem(field, 'Enter your street address.');
  return checkLineShape(field, line);
}

function checkSecondLine(input: unknown): Checked {
  const line = typed(input);
  return line === '' ? undefined : checkLineShape('address2', line);
}

function checkLineShape(field: 'address1' | 'address2', line: string): string | FieldProblem {
  if (line.length > ADDRESS_LENGTH || !STREET_PATTERN.test(line)) {
    const label = field === 'address1' ? 'street address' : 'second address line';
    return problem(
      field,
      `Check your ${label}. It can use letters, numbers and basic punctuation, up to ${ADDRESS_LENGTH} characters.`,
    );
  }
  return line;
}

function checkCity(input: unknown): string | FieldProblem {
  const city = typed(input);
  if (city === '') return problem('city', 'Enter your city.');
  if (city.length > CITY_LENGTH || !NAME_PATTERN.test(city)) {
    return problem(
      'city',
      `Check your city. It can only use letters, numbers, spaces, apostrophes, hyphens and periods, up to ${CITY_LENGTH} characters.`,
    );
  }
  return city;
}

/** Only Canada needs a province, because its tax depends on it. Elsewhere one is ignored. */
function checkProvince(country: CountryCode | FieldProblem, input: unknown): Checked {
  if (country !== 'CA') return undefined;
  const code = typed(input).toUpperCase();
  return PROVINCES.some((province) => province.code === code)
    ? code
    : problem('province', 'Choose your province or territory.');
}

/** A postal code cannot be checked until the country is known, so it is skipped without one. */
function checkPostal(country: CountryCode | FieldProblem, input: unknown): Checked {
  if (isProblem(country)) return undefined;
  const result = checkPostalCode(country, input);
  return result.ok ? result.value : problem('postalCode', postalCodeHelp(country));
}

/** The lead popup: a first name and an email. */
export function checkLead(input: LeadInput): FormCheck<Lead> {
  return gather({
    firstName: checkName('firstName', input.firstName),
    email: checkEmail(input.email),
  });
}

/** The first checkout step: an email and, if the shopper wants, a phone number. */
export function checkContact(input: ContactInput): FormCheck<Contact> {
  return gather({
    email: checkEmail(input.email),
    phone: checkPhone(input.phone),
  });
}

/** The shipping address. Problems come back in the order of the form, one for each field at most. */
export function checkAddress(input: AddressInput): FormCheck<Address> {
  const country = checkCountry(input.country);
  const checked = gather({
    country,
    firstName: checkName('firstName', input.firstName),
    lastName: checkName('lastName', input.lastName),
    address1: checkStreetLine('address1', input.address1),
    address2: checkSecondLine(input.address2),
    city: checkCity(input.city),
    province: checkProvince(country, input.province),
    postalCode: checkPostal(country, input.postalCode),
  });
  // The postal code is only skipped when the country is a problem, and then the result is not ok. So an
  // ok result always has one, which the type of `gather` cannot see.
  return checked as FormCheck<Address>;
}
