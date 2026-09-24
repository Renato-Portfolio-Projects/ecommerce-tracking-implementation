import { LEAD_POPUP_INTERVAL_DAYS } from '../store/policy';

/**
 * The lead popup's memory. All it keeps, in the browser, is when the popup was last shown and how
 * that ended: closed, or the code was shown. It holds no name, no email and nothing else about the
 * visitor. From that one note the popup can answer two questions: is it time to open by itself
 * again, and does the corner reminder belong on the page.
 *
 * Showing the popup writes the note, whether it opened by itself or the visitor opened it by hand,
 * so it never opens by itself just after it was asked for. There is deliberately no permanent
 * "claimed" flag: taking the code starts the same quiet period as closing the popup does, and the
 * visitor can always open the form again by hand. Like the list hand-off, the key and the reading
 * live here; the localStorage calls are made by the scripts that use them.
 */

const QUIET_PERIOD_MS = LEAD_POPUP_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
const NOTE_VERSION = 1;

/** Where the note is kept in localStorage. */
export const LEAD_POPUP_KEY = 'second-impression:lead-popup';

/** How the popup ended the last time it was shown. */
export type LeadPopupOutcome = 'closed' | 'claimed';

export interface LeadPopupNote {
  /** When the popup was last shown, in milliseconds since 1970, as Date.now() gives. */
  shownAt: number;
  /** Missing while the popup is still open, or if the visitor left the page with it open. */
  outcome?: LeadPopupOutcome;
}

/** The note to keep the moment the popup is shown. */
export function noteWhenShown(now: number): LeadPopupNote {
  return { shownAt: now };
}

/** The note to keep when the popup ends. The time it was shown is not changed. */
export function noteWhenEnded(note: LeadPopupNote, outcome: LeadPopupOutcome): LeadPopupNote {
  return { shownAt: note.shownAt, outcome };
}

/** The text to keep in the browser. */
export function serializeLeadPopupNote(note: LeadPopupNote): string {
  return JSON.stringify({
    version: NOTE_VERSION,
    shownAt: note.shownAt,
    ...(note.outcome === undefined ? {} : { outcome: note.outcome }),
  });
}

/**
 * Reads a saved note. Anything missing or damaged gives nothing instead of throwing, and nothing
 * means the popup has never been shown. So does a time in the future, which only a clock that was
 * changed could have written: it must not keep the popup quiet for years. An outcome that is not
 * one of the two known ones is ignored, but the time it was shown still counts.
 */
export function parseLeadPopupNote(raw: string | null | undefined, now: number): LeadPopupNote | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return undefined;

  const { version, shownAt, outcome } = data as Record<string, unknown>;
  if (version !== NOTE_VERSION) return undefined;
  if (typeof shownAt !== 'number' || !Number.isFinite(shownAt) || shownAt < 0 || shownAt > now) return undefined;

  return outcome === 'closed' || outcome === 'claimed' ? { shownAt, outcome } : { shownAt };
}

/**
 * Whether the popup may open by itself now: it never has, or the quiet period has passed. The
 * period is counted from the last time it was shown, and it is over at exactly seven days.
 */
export function leadPopupDue(note: LeadPopupNote | undefined, now: number): boolean {
  return note === undefined || now - note.shownAt >= QUIET_PERIOD_MS;
}

/**
 * Whether the small corner reminder belongs on the page: the popup has been shown and the visitor
 * did not take the code. Someone who took it, or who never saw the popup, gets no reminder. (The
 * link in the footer is always there, so a visitor who never saw the popup can still find it.)
 */
export function leadReminderWanted(note: LeadPopupNote | undefined): boolean {
  return note !== undefined && note.outcome !== 'claimed';
}
