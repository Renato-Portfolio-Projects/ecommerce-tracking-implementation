import {
  LEAD_POPUP_KEY,
  leadPopupDue,
  leadReminderWanted,
  noteWhenEnded,
  noteWhenShown,
  parseLeadPopupNote,
  scrolledFarEnough,
  serializeLeadPopupNote,
  type LeadPopupNote,
} from '../engine/lead-popup';
import { LEAD_POPUP_DELAY_SECONDS } from '../store/policy';

/**
 * Decides when the lead popup opens and how it closes, and keeps the small corner reminder in step.
 * The popup is a native dialog (see LeadPopup.astro), so the browser already moves the focus into it,
 * keeps the page behind it out of reach, closes it on Escape and puts the focus back where it was.
 * Only the ways of opening and closing it are written here. The rules for when it is due, and for
 * whether the reminder belongs, are in src/engine/lead-popup.ts and are tested there. This script
 * only reads the clock, the scroll position and the browser's storage, and passes them to those rules.
 *
 * It announces what happens, on the document, and sends nothing anywhere:
 * - `lead-popup:shown`, with `source`: `auto` if the page opened it, `manual` if the visitor did;
 * - `lead-popup:closed`, with `reason`: how the visitor closed it.
 */

/** How the popup came to open. The page's own timing is `auto`, a click on the footer link or the corner tab is `manual`. */
export type LeadPopupSource = 'auto' | 'manual';

/** How the visitor closed the popup. `other` is a close that none of the four ways caused. */
export type LeadPopupCloseReason = 'close-button' | 'no-thanks' | 'escape' | 'backdrop' | 'other';

const DELAY_MS = LEAD_POPUP_DELAY_SECONDS * 1000;

/**
 * The note, when the browser will not keep one (storage blocked or full): it lasts for as long as this
 * page stays open, so the popup still does not open twice in one visit and the reminder still appears
 * once it has been closed. It is the same idea as the cart's `unsaved`.
 */
let remembered: LeadPopupNote | undefined;

function readNote(): LeadPopupNote | undefined {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LEAD_POPUP_KEY);
  } catch {
    raw = null;
  }
  return parseLeadPopupNote(raw, Date.now()) ?? remembered;
}

function writeNote(note: LeadPopupNote): void {
  remembered = note;
  try {
    localStorage.setItem(LEAD_POPUP_KEY, serializeLeadPopupNote(note));
  } catch {
    // Nothing can be kept. The note in memory covers this visit.
  }
}

function popup(): HTMLDialogElement | null {
  return document.querySelector<HTMLDialogElement>('[data-lead-popup]');
}

/** Shows the corner reminder if the note says one belongs, and hides it if not. */
function updateTab(): void {
  const tab = document.querySelector<HTMLElement>('[data-lead-open="tab"]');
  if (tab) tab.hidden = !leadReminderWanted(readNote());
}

/** Stops the page's own timing, if it is running. Set by `armAutoOpen`, and called when the popup is shown. */
let disarmAuto: (() => void) | undefined;

/**
 * Opens the popup and writes the note, whichever way it was opened, so that it never opens by itself
 * just after it was asked for. Nothing happens if it is already open.
 */
function show(source: LeadPopupSource): void {
  const dialog = popup();
  if (!dialog || dialog.open) return;
  disarmAuto?.();
  dialog.showModal();
  writeNote(noteWhenShown(Date.now()));
  document.dispatchEvent(new CustomEvent('lead-popup:shown', { detail: { source } }));
}

/** Why the popup is being closed, kept from the moment a close begins until the dialog's `close` event says it is done. */
let closeReason: LeadPopupCloseReason | undefined;

function closeWith(reason: LeadPopupCloseReason): void {
  const dialog = popup();
  if (!dialog?.open) return;
  closeReason = reason;
  dialog.close();
}

/** Runs whenever the dialog has closed, however it was closed: records how it ended and announces it. */
function whenClosed(): void {
  const reason = closeReason ?? 'other';
  closeReason = undefined;
  const note = readNote();
  if (note) writeNote(noteWhenEnded(note, 'closed'));
  updateTab();
  document.dispatchEvent(new CustomEvent('lead-popup:closed', { detail: { reason } }));
}

/**
 * Where a click landed, compared with the popup's own box. The dimmed page around the popup belongs to the
 * dialog, so a click on it has the dialog as its target, and so does a click on the dialog's own padding.
 * Only the position tells them apart.
 */
function isOutsideBox(dialog: HTMLDialogElement, event: MouseEvent): boolean {
  if (event.target !== dialog) return false;
  const box = dialog.getBoundingClientRect();
  return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
}

/** True while the form is on screen and the visitor has typed something in it. */
function somethingTyped(dialog: HTMLDialogElement): boolean {
  const ask = dialog.querySelector<HTMLElement>('[data-lead-ask]');
  if (!ask || ask.hidden) return false;
  return Array.from(ask.querySelectorAll<HTMLInputElement>('input:not([type="checkbox"])')).some((input) => input.value !== '');
}

/** Whether the press that began the current click landed on the dimmed page, so that dragging a text selection out of the box does not count. */
let pressedOutside = false;

function handlePress(event: MouseEvent): void {
  const dialog = popup();
  pressedOutside = !!dialog?.open && isOutsideBox(dialog, event);
}

/**
 * Does what the popup's buttons ask. One listener on the whole document handles all of them, in this order:
 * - the footer link and the corner tab open the popup by hand;
 * - the close button and "No thanks" close it, each saying which;
 * - a click on the dimmed page around the box closes it, unless the visitor has typed something, so a stray
 *   click cannot lose it. The other three ways still close it then, and Escape always does.
 */
function handleClick(event: MouseEvent): void {
  const clicked = event.target as Element;
  const dialog = popup();
  if (!dialog) return;

  if (clicked.closest('[data-lead-open]')) {
    show('manual');
    return;
  }
  const closer = clicked.closest<HTMLElement>('[data-lead-close]');
  if (closer && dialog.contains(closer)) {
    closeWith(closer.dataset.leadClose === 'no-thanks' ? 'no-thanks' : 'close-button');
    return;
  }
  if (dialog.open && pressedOutside && isOutsideBox(dialog, event) && !somethingTyped(dialog)) {
    closeWith('backdrop');
  }
}

/**
 * Opens the popup by itself, on the pages that ask for it, when the visitor has been there for five seconds
 * or has scrolled far enough, whichever comes first. Nothing starts if the popup is not due yet.
 *
 * The seconds count only while the tab is on screen, since a tab left in the background is not a visitor
 * who has been reading. When the moment comes it is checked again: the popup may have been shown in the
 * meantime, by hand or in another tab. If another dialog is open, such as the cart drawer, this opening is
 * skipped without being written down, so the popup stays due, and scrolling can still open it later.
 */
function armAutoOpen(): void {
  if (!leadPopupDue(readNote(), Date.now())) return;

  let remaining = DELAY_MS;
  let startedAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function stopClock(): void {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    remaining -= Date.now() - startedAt;
  }

  function startClock(): void {
    if (timer !== undefined || remaining <= 0) return;
    startedAt = Date.now();
    timer = setTimeout(() => {
      timer = undefined;
      remaining = 0;
      offer();
    }, remaining);
  }

  function whenVisibilityChanges(): void {
    if (document.visibilityState === 'visible') startClock();
    else stopClock();
  }

  function whenScrolled(): void {
    if (scrolledFarEnough(window.scrollY, window.innerHeight, document.documentElement.scrollHeight)) offer();
  }

  function disarm(): void {
    stopClock();
    document.removeEventListener('visibilitychange', whenVisibilityChanges);
    window.removeEventListener('scroll', whenScrolled);
    disarmAuto = undefined;
  }

  function offer(): void {
    if (!leadPopupDue(readNote(), Date.now())) {
      disarm();
      return;
    }
    if (document.querySelector('dialog[open]')) return;
    show('auto');
  }

  disarmAuto = disarm;
  document.addEventListener('visibilitychange', whenVisibilityChanges);
  window.addEventListener('scroll', whenScrolled, { passive: true });
  whenVisibilityChanges();
}

/**
 * Starts the popup: puts the corner reminder in step with the note, listens for the buttons, and, on the
 * pages that mark the popup to open by itself (only the home page), starts the timing.
 */
export function initLeadPopup(): void {
  const dialog = popup();
  if (!dialog) return;

  updateTab();
  document.addEventListener('pointerdown', handlePress);
  document.addEventListener('click', handleClick);
  // The browser sends `cancel` when Escape is pressed, just before it closes the dialog.
  dialog.addEventListener('cancel', () => {
    closeReason = 'escape';
  });
  dialog.addEventListener('close', whenClosed);

  if (dialog.hasAttribute('data-lead-auto')) armAutoOpen();
}
