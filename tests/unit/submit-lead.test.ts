import { describe, expect, it } from 'vitest';
import { submitLead } from '../../src/components/submit-lead';
import { welcomeCoupon } from '../../src/engine/coupons';

// submitLead is the stand-in that v0.2c replaces with a request to the server. These tests state what the popup
// relies on, so the replacement has to keep it: it is asked with a checked lead, and it answers with the code to show.
describe('submitLead, the stand-in for the server', () => {
  const lead = { firstName: 'Ana', email: 'ana@example.com', marketing: false };

  it('accepts a checked lead and answers with the welcome code', async () => {
    expect(await submitLead(lead)).toEqual({ code: welcomeCoupon()!.code });
  });

  it('answers the same whether or not the marketing box was ticked, since that is only recorded', async () => {
    expect(await submitLead({ ...lead, marketing: true })).toEqual(await submitLead(lead));
  });

  it('does not hand back what it was given, so nothing personal can leak into the message that shows the code', async () => {
    const answer = await submitLead(lead);
    expect(Object.keys(answer)).toEqual(['code']);
    expect(JSON.stringify(answer)).not.toContain('ana');
  });
});
