import { hashedUserData, type HashedUserData } from './hash.js';
import { pushEvent } from './push-event.js';

/**
 * Turns the lead popup's announcement that the server kept a lead into a `generate_lead`. The popup announces it only for a
 * lead the server really saved (a robot's filled trap field is shown the code and nothing is announced), and it carries what
 * the shopper typed, because the address has to be fingerprinted before anything reaches the dataLayer. Only the code the popup
 * issued, how the popup was opened and the address's fingerprint are announced: the first name, the address as typed and the
 * marketing tick never are.
 *
 * This file is loaded by the popup's form (src/components/lead-popup-form.ts), which is itself loaded the first time the popup is
 * shown, so that no other visit to a page carries it, or the code that makes the fingerprint.
 *
 * The fingerprint needs `crypto.subtle`, which the browser gives only to a secure page (HTTPS, or localhost), and it can fail for
 * other reasons too. Tracking must never lose a real lead to that, so a lead whose address could not be fingerprinted is
 * announced without `user_data`, and the fault is reported in the console, in words that do not repeat the address.
 */

/** What the popup announces when the server has kept a lead (`lead-popup:submitted`, in lead-popup-form.ts). */
export interface LeadDetail {
  firstName: string;
  email: string;
  marketing: boolean;
  code: string;
  source: string;
}

/** A lead as the dataLayer gets it: the code the popup issued, how the popup was opened, and the email's fingerprint when the page could make one. */
export type LeadAnnouncement = { coupon: string; source: string; user_data?: HashedUserData };

/**
 * The lead the popup announced. Only the code and how the popup was opened are taken from what the popup announces:
 * the first name, the email as typed and the marketing tick are not carried. The fingerprint is made by the caller,
 * which has to wait for the browser to make it, and is added when there is one.
 */
export function generateLeadParams(lead: { code: string; source: string }, userData?: HashedUserData): LeadAnnouncement {
  return {
    coupon: lead.code,
    source: lead.source,
    ...(userData === undefined ? {} : { user_data: userData }),
  };
}

/** Fingerprints the address and announces the lead, with the fingerprint when there is one. Never throws into the page. */
export async function announceLead(detail: LeadDetail): Promise<void> {
  let userData: HashedUserData | undefined;
  try {
    const hashed = await hashedUserData({ email: detail.email });
    if (Object.keys(hashed).length > 0) userData = hashed;
  } catch (error) {
    // Only the kind of fault is reported, never its message, which a browser could word with what was being hashed.
    const kind = error instanceof Error ? error.name : 'unknown';
    console.error(`generate_lead: the email could not be fingerprinted (${kind}), so the lead was announced without user_data.`);
  }
  pushEvent('generate_lead', generateLeadParams(detail, userData));
}

/** Listens, once, for the popup's announcement of a lead it has kept. */
export function initLeadTracking(): void {
  document.addEventListener('lead-popup:submitted', (event) => {
    const detail = (event as CustomEvent<LeadDetail | null>).detail;
    if (detail) void announceLead(detail);
  });
}
