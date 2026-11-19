import { describe, expect, it } from 'vitest';
import { ORDER_LISTS_KEY } from '../../src/tracking/order-lists';
import { PURCHASES_ANNOUNCED_KEY } from '../../src/tracking/purchase-marker';
import { OPEN, htmlFiles, readPage, scriptOf } from '../helpers/built';

// Each kind of page is sent the tracking code of the events it makes, and not the code of events that only other pages make. The
// checkout announces its steps and the codes shoppers apply, and the thank-you page announces the purchase; no other page makes
// either. Found by weighing the script of each kind of page: while the checkout's, the lead's and the purchase's builders sat in
// the file that every store page shares, each store page was sent 2.1 KB more script than before (1.2 KB once compressed).
//
// The words below are searched for in all the script a page loads, which is the files it names and every file they import in the
// ordinary way, since that is what a visitor is sent. Each is written once, in the code of the kind of page that needs it. (The
// discount codes are not among them: the cart that every page loads prices an order, so every page has always carried them.)

/** The payment type the checkout announces with add_payment_info, which only the code that builds that announcement writes. */
const PAYMENT_TYPE = 'Credit Card';
/** The two notes the purchase is built from: the lists the items were seen in, written when an order is placed, and the orders announced. */
const NOTES = [ORDER_LISTS_KEY, PURCHASES_ANNOUNCED_KEY];
const ALL_OF_THEM = [PAYMENT_TYPE, ...NOTES];

/** Which of the words the script has, in the order they were given. */
const carried = (script: string, words: string[]) => words.filter((word) => script.includes(word));
const scriptOfPage = (file: string) => scriptOf(OPEN, readPage(OPEN, file));

const withScript = htmlFiles(OPEN).filter((file) => readPage(OPEN, file).includes('<script type="module"'));
const ordinary = withScript.filter((file) => file !== 'checkout/index.html' && file !== 'thank-you/index.html');

describe('the tracking code each kind of page is sent', () => {
  it('leaves the checkout\'s payment type and the purchase\'s notes out of every page that makes neither', () => {
    expect(ordinary.length).toBeGreaterThan(10);
    for (const file of ordinary) expect(carried(scriptOfPage(file), ALL_OF_THEM), file).toEqual([]);
  });

  it('gives the checkout page its payment type and the lists it writes down, and not the note of orders announced', () => {
    expect(carried(scriptOfPage('checkout/index.html'), ALL_OF_THEM)).toEqual([PAYMENT_TYPE, ORDER_LISTS_KEY]);
  });

  it('gives the thank-you page both notes, and not the checkout\'s payment type', () => {
    expect(carried(scriptOfPage('thank-you/index.html'), ALL_OF_THEM)).toEqual(NOTES);
  });
});
