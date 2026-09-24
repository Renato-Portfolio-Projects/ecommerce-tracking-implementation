import { describe, expect, it } from 'vitest';
import {
  LEAD_POPUP_KEY,
  leadPopupDue,
  leadReminderWanted,
  noteWhenEnded,
  noteWhenShown,
  parseLeadPopupNote,
  serializeLeadPopupNote,
} from '../../src/engine/lead-popup';
import { LEAD_POPUP_INTERVAL_DAYS } from '../../src/store/policy';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const QUIET = LEAD_POPUP_INTERVAL_DAYS * DAY;
const NOW = Date.UTC(2026, 8, 24, 12, 0, 0);

describe('when the lead popup may open by itself', () => {
  it('may when it has never been shown', () => {
    expect(leadPopupDue(undefined, NOW)).toBe(true);
  });

  it('may not just after it was shown', () => {
    expect(leadPopupDue(noteWhenShown(NOW), NOW)).toBe(false);
    expect(leadPopupDue(noteWhenShown(NOW - DAY), NOW)).toBe(false);
  });

  it('may not until the quiet period is over, and may from exactly its end', () => {
    expect(leadPopupDue(noteWhenShown(NOW - QUIET + MINUTE), NOW)).toBe(false);
    expect(leadPopupDue(noteWhenShown(NOW - QUIET), NOW)).toBe(true);
    expect(leadPopupDue(noteWhenShown(NOW - QUIET - DAY), NOW)).toBe(true);
  });

  it('counts the quiet period from when it was shown, however it ended', () => {
    const shown = NOW - 3 * DAY;
    for (const outcome of ['closed', 'claimed'] as const) {
      const note = noteWhenEnded(noteWhenShown(shown), outcome);
      expect(leadPopupDue(note, NOW), outcome).toBe(false);
      expect(leadPopupDue(note, shown + QUIET), outcome).toBe(true);
    }
  });

  it('uses the number of days the store sets', () => {
    expect(QUIET).toBe(LEAD_POPUP_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
    expect(LEAD_POPUP_INTERVAL_DAYS).toBeGreaterThan(0);
  });
});

describe('the note about the last time the popup was shown', () => {
  it('records the time it was shown, with no outcome yet', () => {
    expect(noteWhenShown(NOW)).toEqual({ shownAt: NOW });
  });

  it('records how it ended without changing when it was shown, and leaves the earlier note as it was', () => {
    const shown = noteWhenShown(NOW);
    expect(noteWhenEnded(shown, 'closed')).toEqual({ shownAt: NOW, outcome: 'closed' });
    expect(noteWhenEnded(shown, 'claimed')).toEqual({ shownAt: NOW, outcome: 'claimed' });
    expect(shown).toEqual({ shownAt: NOW });
  });

  it('is saved and read back the same, open or ended either way', () => {
    const shown = noteWhenShown(NOW - DAY);
    for (const note of [shown, noteWhenEnded(shown, 'closed'), noteWhenEnded(shown, 'claimed')]) {
      expect(parseLeadPopupNote(serializeLeadPopupNote(note), NOW)).toEqual(note);
    }
  });

  it('holds only a version, a time and an outcome, and nothing about the visitor', () => {
    const saved = JSON.parse(serializeLeadPopupNote(noteWhenEnded(noteWhenShown(NOW), 'claimed')));
    expect(Object.keys(saved).sort()).toEqual(['outcome', 'shownAt', 'version']);
    expect(Object.keys(JSON.parse(serializeLeadPopupNote(noteWhenShown(NOW)))).sort()).toEqual(['shownAt', 'version']);
  });

  it('is kept under a key of its own', () => {
    expect(LEAD_POPUP_KEY).toBe('second-impression:lead-popup');
  });
});

describe('reading a saved note', () => {
  const good = { version: 1, shownAt: NOW - DAY };

  it('says the popup has never been shown when nothing is saved', () => {
    expect(parseLeadPopupNote(null, NOW)).toBeUndefined();
    expect(parseLeadPopupNote(undefined, NOW)).toBeUndefined();
    expect(parseLeadPopupNote('', NOW)).toBeUndefined();
  });

  it('says the same for anything damaged, without throwing', () => {
    for (const raw of ['{"version":1,"shownAt":', 'not json', '[]', 'null', '5', '"text"', '{}']) {
      expect(parseLeadPopupNote(raw, NOW), raw).toBeUndefined();
    }
  });

  it('says the same for a note of another version', () => {
    expect(parseLeadPopupNote(JSON.stringify({ ...good, version: 2 }), NOW)).toBeUndefined();
    expect(parseLeadPopupNote(JSON.stringify({ shownAt: good.shownAt }), NOW)).toBeUndefined();
  });

  it('says the same for a time that is not a sensible time', () => {
    for (const shownAt of ['yesterday', null, true, -1, NOW + 1, NOW + 30 * DAY]) {
      expect(parseLeadPopupNote(JSON.stringify({ ...good, shownAt }), NOW), String(shownAt)).toBeUndefined();
    }
    expect(parseLeadPopupNote('{"version":1,"shownAt":1e999}', NOW)).toBeUndefined();
  });

  it('does not let a clock that was put back keep the popup quiet for years', () => {
    const fromTheFuture = parseLeadPopupNote(JSON.stringify({ ...good, shownAt: NOW + 400 * DAY }), NOW);
    expect(leadPopupDue(fromTheFuture, NOW)).toBe(true);
  });

  it('accepts a time of now, and of the very start of the clock', () => {
    expect(parseLeadPopupNote(JSON.stringify({ ...good, shownAt: NOW }), NOW)).toEqual({ shownAt: NOW });
    expect(parseLeadPopupNote(JSON.stringify({ ...good, shownAt: 0 }), NOW)).toEqual({ shownAt: 0 });
  });

  it('ignores an outcome it does not know, but keeps the time the popup was shown', () => {
    for (const outcome of ['dismissed', 1, null, true, {}]) {
      const note = parseLeadPopupNote(JSON.stringify({ ...good, outcome }), NOW);
      expect(note, String(outcome)).toEqual({ shownAt: good.shownAt });
    }
  });

  it('carries nothing else that was saved with it', () => {
    const note = parseLeadPopupNote(JSON.stringify({ ...good, outcome: 'closed', email: 'a@example.com', firstName: 'Ana' }), NOW);
    expect(note).toEqual({ shownAt: good.shownAt, outcome: 'closed' });
  });
});

describe('when the corner reminder belongs on the page', () => {
  it('does not when the popup has never been shown', () => {
    expect(leadReminderWanted(undefined)).toBe(false);
  });

  it('does once it has been shown and the visitor has not taken the code, closed or still open', () => {
    const shown = noteWhenShown(NOW);
    expect(leadReminderWanted(shown)).toBe(true);
    expect(leadReminderWanted(noteWhenEnded(shown, 'closed'))).toBe(true);
  });

  it('does not once the code has been taken', () => {
    expect(leadReminderWanted(noteWhenEnded(noteWhenShown(NOW), 'claimed'))).toBe(false);
  });
});
