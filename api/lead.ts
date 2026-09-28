import { liveLeadHandler } from '../src/server/live.js';

// Vercel runs this file as the function at /api/lead. It only hands the request over: everything the function does is
// in src/server/lead.ts, and what it needs from outside (the database, the mail look-up) is joined on in
// src/server/live.ts, where it can be tested without Vercel.
export default { fetch: liveLeadHandler(process.env) };
