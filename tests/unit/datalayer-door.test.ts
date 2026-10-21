import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The tracking plan says the site only announces facts to the dataLayer, and never calls fbq() or
// gtag() itself: Google Tag Manager decides what each platform receives. pushEvent is the one door
// to the dataLayer, because it is where an announcement is checked and where a clear-text email is
// stopped, so a second way in would be a way round those checks. These tests read the site's code
// and fail if anything but that one file touches the dataLayer, or if anything calls a platform.

const root = fileURLToPath(new URL('../../', import.meta.url));

// A file is added here only on purpose, in a change that says why. The page_type line that the
// layout pushes before the GTM snippet will be the first candidate.
const MAY_TOUCH_THE_DATALAYER = ['src/tracking/push-event.ts'];

// Reading or writing it by way of window, globalThis or self, or using it by its own name.
// A sentence that only mentions the dataLayer, such as "every dataLayer event", does not match.
const TOUCHES_THE_DATALAYER =
  /\b(?:window|globalThis|self)\s*\.\s*dataLayer\b|\bdataLayer\s*(?:\.|\?\?=|\|\|=|=(?!=))/;
const CALLS_A_PLATFORM = /\b(?:fbq|gtag)\s*\(/;

function codeFiles(folder: string): string[] {
  const found: string[] = [];
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      const full = join(directory, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|astro|js|mjs)$/.test(name)) found.push(relative(root, full).replaceAll('\\', '/'));
    }
  };
  walk(join(root, folder));
  return found;
}

const siteCode = [...codeFiles('src'), ...codeFiles('api')];

function filesMatching(pattern: RegExp): string[] {
  return siteCode.filter((file) => pattern.test(readFileSync(join(root, file), 'utf8')));
}

describe('the one door to the dataLayer', () => {
  it('is the only place in the site that touches the dataLayer', () => {
    expect(filesMatching(TOUCHES_THE_DATALAYER)).toStrictEqual(MAY_TOUCH_THE_DATALAYER);
  });

  it('calls neither fbq nor gtag anywhere in the site', () => {
    expect(filesMatching(CALLS_A_PLATFORM)).toStrictEqual([]);
  });

  it('can tell touching the dataLayer from mentioning it', () => {
    const touches = [
      'window.dataLayer.push({})',
      'window . dataLayer = []',
      'globalThis.dataLayer ??= []',
      'dataLayer.push(announcement)',
      'dataLayer = []',
    ];
    for (const code of touches) expect(TOUCHES_THE_DATALAYER.test(code), code).toBe(true);
    const mentions = [
      'Fires every tag from dataLayer events.',
      'GA4 uses the dataLayer name.',
      'Top-level dataLayer parameters this event must carry.',
      'if (dataLayer == null)',
    ];
    for (const text of mentions) expect(TOUCHES_THE_DATALAYER.test(text), text).toBe(false);
  });

  it('can tell a call to a platform from a mention of one', () => {
    for (const code of ["fbq('track', 'Lead')", 'gtag ( "event", "x" )']) {
      expect(CALLS_A_PLATFORM.test(code), code).toBe(true);
    }
    for (const text of ['It never calls fbq or gtag directly.', 'the gtag.js library']) {
      expect(CALLS_A_PLATFORM.test(text), text).toBe(false);
    }
  });
});
