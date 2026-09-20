import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EVENTS, PLATFORMS, platformEventName } from '../../src/tracking/events';
import { tableUnderHeading } from '../helpers/markdown';

const doc = readFileSync(new URL('../../docs/tracking-plan.md', import.meta.url), 'utf8');
const platformRows = tableUnderHeading(doc, '## Platforms');
const eventRows = tableUnderHeading(doc, '## Events');
const withoutBackticks = (cell: string) => cell.replaceAll('`', '');

describe('docs/tracking-plan.md', () => {
  it('lists the platforms the way the code does', () => {
    expect(
      platformRows.map(([id, name, vendor, runsIn, status]) => [
        withoutBackticks(id),
        name,
        vendor,
        runsIn,
        status,
      ]),
    ).toEqual(PLATFORMS.map((p) => [p.id, p.name, p.vendor, p.runsIn, p.status]));
  });

  it('lists the same events, in the same order, as the code', () => {
    expect(eventRows.map((row) => withoutBackticks(row[0]))).toEqual(
      EVENTS.map((event) => event.name),
    );
  });

  it('describes every event, and the name each platform receives, the way the code does', () => {
    EVENTS.forEach((event, index) => {
      const [, firesWhen, ga4, metaPixel, metaCapi, params] = eventRows[index];
      expect(firesWhen, event.name).toBe(event.firesWhen);
      expect(withoutBackticks(ga4), event.name).toBe(platformEventName(event, 'ga4') ?? '-');
      expect(withoutBackticks(metaPixel), event.name).toBe(
        platformEventName(event, 'meta-pixel') ?? '-',
      );
      expect(withoutBackticks(metaCapi), event.name).toBe(
        platformEventName(event, 'meta-capi') ?? '-',
      );
      expect(metaCapi !== '-', `${event.name} server routing`).toBe(event.viaServer);
      expect(withoutBackticks(params), event.name).toBe(event.params.join(', '));
    });
  });
});
