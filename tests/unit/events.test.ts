import { describe, expect, it } from 'vitest';
import { EVENTS, PLATFORMS, platformEventName } from '../../src/tracking/events';

function eventNamed(name: string) {
  const event = EVENTS.find((candidate) => candidate.name === name);
  if (!event) throw new Error(`No event named ${name}`);
  return event;
}

describe('EVENTS', () => {
  it('defines the 17 events from the design', () => {
    expect(EVENTS).toHaveLength(17);
    expect(new Set(EVENTS.map((event) => event.name)).size).toBe(17);
  });

  it('uses snake_case names', () => {
    for (const event of EVENTS) {
      expect(event.name).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });

  it('routes only the four key events through the server container', () => {
    const viaServer = EVENTS.filter((event) => event.viaServer)
      .map((event) => event.name)
      .sort();
    expect(viaServer).toEqual(['add_to_cart', 'begin_checkout', 'generate_lead', 'purchase']);
  });

  it('sends server-routed events to the Conversions API, and only those', () => {
    for (const event of EVENTS) {
      expect(event.destinations.includes('meta-capi')).toBe(event.viaServer);
    }
  });

  it('gives a pixel destination to exactly the events that have a Meta event name', () => {
    for (const event of EVENTS) {
      expect(event.destinations.includes('meta-pixel')).toBe(event.metaEvent !== undefined);
    }
  });

  it('maps the funnel events to the right Meta standard events', () => {
    expect(eventNamed('view_item').metaEvent).toBe('ViewContent');
    expect(eventNamed('add_to_cart').metaEvent).toBe('AddToCart');
    expect(eventNamed('begin_checkout').metaEvent).toBe('InitiateCheckout');
    expect(eventNamed('add_payment_info').metaEvent).toBe('AddPaymentInfo');
    expect(eventNamed('purchase').metaEvent).toBe('Purchase');
    expect(eventNamed('generate_lead').metaEvent).toBe('Lead');
  });

  it('keeps cta_click in GA4 only', () => {
    expect(eventNamed('cta_click').destinations).toEqual(['ga4']);
  });

  it('gives every browser event an event_id for deduplication and debugging', () => {
    for (const event of EVENTS.filter((candidate) => !candidate.stretch)) {
      expect(event.params).toContain('event_id');
    }
  });

  it('requires the order fields on purchase', () => {
    expect(eventNamed('purchase').params).toEqual(
      expect.arrayContaining(['transaction_id', 'currency', 'value', 'tax', 'shipping', 'items']),
    );
  });

  it('marks only refund as a stretch goal', () => {
    expect(EVENTS.filter((event) => event.stretch).map((event) => event.name)).toEqual(['refund']);
  });
});

describe('PLATFORMS', () => {
  it('lists Google and Meta for v1.0, and marks TikTok as later', () => {
    const live = PLATFORMS.filter((platform) => platform.status === 'v1.0').map((p) => p.id);
    const later = PLATFORMS.filter((platform) => platform.status === 'later').map((p) => p.id);
    expect(live).toEqual(['ga4', 'meta-pixel', 'meta-capi']);
    expect(later).toEqual(['tiktok-pixel', 'tiktok-events-api']);
  });

  it('says which platforms are called from the server', () => {
    const server = PLATFORMS.filter((platform) => platform.runsIn === 'server').map((p) => p.id);
    expect(server).toEqual(['meta-capi', 'tiktok-events-api']);
  });

  it('only sends events to platforms that are live in v1.0', () => {
    const live = new Set(
      PLATFORMS.filter((platform) => platform.status === 'v1.0').map((platform) => platform.id),
    );
    for (const event of EVENTS) {
      for (const destination of event.destinations) {
        expect(live.has(destination), `${event.name} -> ${destination}`).toBe(true);
      }
    }
  });
});

describe('platformEventName', () => {
  it('uses the dataLayer name for GA4', () => {
    expect(platformEventName(eventNamed('purchase'), 'ga4')).toBe('purchase');
    expect(platformEventName(eventNamed('cta_click'), 'ga4')).toBe('cta_click');
  });

  it('uses the Meta standard event name for the pixel and the Conversions API', () => {
    expect(platformEventName(eventNamed('purchase'), 'meta-pixel')).toBe('Purchase');
    expect(platformEventName(eventNamed('purchase'), 'meta-capi')).toBe('Purchase');
    expect(platformEventName(eventNamed('begin_checkout'), 'meta-pixel')).toBe('InitiateCheckout');
  });

  it('returns nothing for a platform the event is not sent to', () => {
    expect(platformEventName(eventNamed('view_item'), 'meta-capi')).toBeUndefined();
    expect(platformEventName(eventNamed('cta_click'), 'meta-pixel')).toBeUndefined();
    expect(platformEventName(eventNamed('purchase'), 'tiktok-pixel')).toBeUndefined();
  });
});
