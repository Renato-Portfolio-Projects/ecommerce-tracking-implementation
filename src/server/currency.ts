import { defaultCurrencyFor } from '../store/currencies.js';
import type { Environment } from './gate.js';
import { answer, guarded } from './http.js';

/** The header Vercel adds to a request, holding the two-letter country its connection appears to come from. */
export const COUNTRY_HEADER = 'x-vercel-ip-country';

/**
 * The function behind /api/currency: which currency a visitor should start in. It reads the country from
 * Vercel's header, has `defaultCurrencyFor` (src/store) choose the currency, and answers with the currency
 * alone. The country is used and dropped here: it is never sent on to the browser, and never stored, which is
 * what the rules say about it. A missing or unrecognisable country gives the fallback that function gives.
 */
export function currencyHandler(env: Environment): (request: Request) => Promise<Response> {
  return guarded(env, ['GET'], (request) => answer({ currency: defaultCurrencyFor(request.headers.get(COUNTRY_HEADER)) }));
}
