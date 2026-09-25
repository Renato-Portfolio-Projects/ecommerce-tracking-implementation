import { currencyHandler } from '../src/server/currency';

// Vercel runs this file as the function at /api/currency. It only hands the request over: everything the
// function does is in src/server/currency.ts, where it can be tested without Vercel.
export default { fetch: currencyHandler(process.env) };
