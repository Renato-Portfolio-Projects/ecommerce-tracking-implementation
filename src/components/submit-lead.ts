import type { Lead } from '../engine/checkout-form';
import { welcomeOffer } from './welcome-offer';

/**
 * What the lead popup hands over when its form has passed the checks in the browser: the checked first name
 * and email, and whether the visitor ticked the marketing box.
 */
export interface LeadSubmission extends Lead {
  marketing: boolean;
}

/** What comes back once the lead is accepted: the code to show. */
export interface LeadAccepted {
  code: string;
}

/**
 * The one place that decides a lead has been accepted, and it is deliberately a stand-in. For now it accepts
 * every lead that passed the checks in the browser and returns the welcome code, and it saves nothing and
 * sends nothing: there is no server yet. In v0.2c this is the only function that changes. It will send the
 * lead to /api/lead, which checks it again and saves it, and it will return the code only when the server
 * says OK, so the popup shows the code, and `generate_lead` is sent, only for a lead that was really taken.
 * Everything that calls it already waits for the answer.
 */
export async function submitLead(_lead: LeadSubmission): Promise<LeadAccepted> {
  return { code: welcomeOffer().code };
}
