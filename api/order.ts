import { liveOrderHandler } from '../src/server/live.js';

// Vercel runs this file as the function at /api/order. It only hands the request over: everything the function does
// is in src/server/order.ts, and what it needs from outside (the database) is joined on in src/server/live.ts,
// where it can be tested without Vercel.
export default { fetch: liveOrderHandler(process.env) };
