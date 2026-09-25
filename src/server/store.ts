/**
 * What the server keeps, and the three things it asks of a store to keep it. The real one is a Redis database
 * (Upstash), and the tests and the local server use the in-memory one in memory-store.ts. Everything in the store
 * expires by itself, so nothing needs cleaning up and no record outlives the promise made about it.
 */

/**
 * What is kept about one lead: what the visitor typed into the popup, the time, and where the popup was opened from.
 * Nothing else about them is kept, ever: no address on the network, no browser details, no country, no cookie.
 */
export interface LeadRecord {
  firstName: string;
  email: string;
  marketing: boolean;
  /** How the popup was opened: by itself (`auto`) or by the visitor, from the footer link or the tab (`manual`). */
  source: 'auto' | 'manual';
  /** When it was saved, as an ISO 8601 date and time in UTC, so it reads plainly in the database's own viewer. */
  createdAt: string;
}

export interface Store {
  /**
   * Adds one to the counter with this name and gives back the new count. The counter starts at 1, and it is deleted
   * by the store `lifetimeSeconds` after the last time it was added to.
   */
  increment(key: string, lifetimeSeconds: number): Promise<number>;
  /** Keeps a lead under this id, and the store deletes it `lifetimeSeconds` later. */
  saveLead(id: string, record: LeadRecord, lifetimeSeconds: number): Promise<void>;
  /** The lead kept under this id, or nothing if there is none, or it has expired. */
  readLead(id: string): Promise<LeadRecord | undefined>;
}
