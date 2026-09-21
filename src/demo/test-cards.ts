// This is a demo store, so it takes only well-known test card numbers. The card number is checked in
// the shopper's browser and goes no further. Only the brand, the last four digits and the answer
// (accepted or declined) are ever passed on or kept, so no card number reaches the server.

export type CardBrand = 'Visa' | 'Mastercard';

export interface TestCard {
  /** Digits only. */
  number: string;
  brand: CardBrand;
  /** `declined` is the card that always fails, so a declined payment can be tried. */
  result: 'accepted' | 'declined';
}

// These are the numbers Stripe publishes for testing. They pass the same checksum as real numbers.
export const DEFAULT_TEST_CARD: TestCard = { number: '4242424242424242', brand: 'Visa', result: 'accepted' };

export const TEST_CARDS: TestCard[] = [
  DEFAULT_TEST_CARD,
  { number: '5555555555554444', brand: 'Mastercard', result: 'accepted' },
  { number: '4000000000000002', brand: 'Visa', result: 'declined' },
];

const SECURITY_CODE_PATTERN = /^\d{3}$/;
const EXPIRY_PATTERN = /^(\d{1,2}) ?\/ ?(\d{2})$/;

export type CardField = 'number' | 'expiry' | 'securityCode';

export interface CardProblem {
  field: CardField;
  /** Plain words a shopper could read. */
  message: string;
}

// Each field arrives as `unknown`. Anything that is not text counts as nothing typed.
export interface CardInput {
  number?: unknown;
  expiry?: unknown;
  securityCode?: unknown;
}

/** All that is ever kept of a card. */
export interface KeptCard {
  brand: CardBrand;
  last4: string;
}

export type PaymentCheck =
  | { status: 'accepted'; card: KeptCard }
  | { status: 'declined'; card: KeptCard; message: string }
  | { status: 'invalid'; problems: CardProblem[] };

const NOT_A_TEST_CARD =
  'This is a demo store, so only test cards work. Please don\'t enter a real card number. Use the "Use test card" button.';
const DECLINED =
  'Your card was declined. This is the test card that always declines. Use the "Use test card" button to try one that works.';

const problem = (field: CardField, message: string): CardProblem => ({ field, message });
const isProblem = (checked: unknown): checked is CardProblem =>
  typeof checked === 'object' && checked !== null && 'field' in checked;

function typed(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

/** Groups the digits in fours, the way a card number is written. */
export function formatCardNumber(number: string): string {
  return number.replace(/(.{4})(?=.)/g, '$1 ');
}

/** The number of the month, counting from year 0, so two dates can be compared. Months are in UTC. */
function monthNumber(year: number, month: number): number {
  return year * 12 + month;
}

/** December, three years on. It is worked out from the date, so the button never fills a stale date. */
export function testCardExpiry(now: number): string {
  const year = new Date(now).getUTCFullYear() + 3;
  return `12/${String(year % 100).padStart(2, '0')}`;
}

/** What the "Use test card" button fills in. */
export function demoCard(now: number): { number: string; expiry: string; securityCode: string } {
  return { number: formatCardNumber(DEFAULT_TEST_CARD.number), expiry: testCardExpiry(now), securityCode: '123' };
}

function checkNumber(input: unknown): TestCard | CardProblem {
  const digits = typed(input).replace(/[ -]/g, '');
  if (digits === '') return problem('number', 'Enter the card number.');
  return TEST_CARDS.find((card) => card.number === digits) ?? problem('number', NOT_A_TEST_CARD);
}

/** Any month from the current one on is fine, because a card works to the end of its month. */
function checkExpiry(input: unknown, now: number): string | CardProblem {
  const text = typed(input);
  const match = EXPIRY_PATTERN.exec(text);
  const month = match ? Number(match[1]) : 0;
  if (!match || month < 1 || month > 12) return problem('expiry', 'Enter the expiry date as MM/YY.');

  const today = new Date(now);
  const thisMonth = monthNumber(today.getUTCFullYear(), today.getUTCMonth());
  if (monthNumber(2000 + Number(match[2]), month - 1) < thisMonth) {
    return problem('expiry', 'That card has expired. Enter a date in the future.');
  }
  return text;
}

function checkSecurityCode(input: unknown): string | CardProblem {
  const code = typed(input);
  return SECURITY_CODE_PATTERN.test(code) ? code : problem('securityCode', 'Enter the 3-digit security code.');
}

/**
 * Checks the payment form. `now` is the time in milliseconds, for the expiry date. The answer holds
 * the brand and last four digits of a good card, and never the whole number, the expiry date or the
 * security code. A number that is not one of the test cards is turned down with a friendly message,
 * whether or not it looks real. The decline card is only declined once the other fields are good.
 */
export function checkPayment(input: CardInput, now: number): PaymentCheck {
  const number = checkNumber(input.number);
  const checked = [number, checkExpiry(input.expiry, now), checkSecurityCode(input.securityCode)];

  const problems = checked.filter(isProblem);
  if (problems.length > 0 || isProblem(number)) return { status: 'invalid', problems };

  const card: KeptCard = { brand: number.brand, last4: number.number.slice(-4) };
  return number.result === 'declined' ? { status: 'declined', card, message: DECLINED } : { status: 'accepted', card };
}
