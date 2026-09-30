/**
 * The order number shown to a shopper, and the GA4/Meta `transaction_id` once tracking exists: `SI-` and 8
 * characters from an alphabet with no 0, O, 1 or I, so a shopper reading it aloud, or typing it into a support
 * form, is never unsure which letter or digit was meant. It is not a database key: the token that gates
 * `/thank-you` is a separate, longer, unguessable value, made the same way a lead's own id is.
 */

const ORDER_NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ORDER_NUMBER_LENGTH = 8;

/** `random` gives a number in [0, 1), the same contract as `Math.random`, so a test can make it deterministic. */
export function makeOrderNumber(random: () => number = Math.random): string {
  let suffix = '';
  for (let i = 0; i < ORDER_NUMBER_LENGTH; i++) suffix += ORDER_NUMBER_ALPHABET[Math.floor(random() * ORDER_NUMBER_ALPHABET.length)];
  return `SI-${suffix}`;
}
