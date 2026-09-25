import { checkLead } from '../engine/checkout-form';
import { fill } from '../engine/fill';
import { demoLead } from '../demo/personas';
import { demoPersona } from './demo-persona';
import { submitLead } from './submit-lead';

/**
 * The lead popup's form: checking what was typed and showing the problems, the "Use demo data" and "Try
 * another person" buttons, and the message that shows the code. It is loaded on demand, by
 * lead-popup-ui.ts, the first time the popup is shown, so that the rest of the page does not carry it.
 * That script also passes on the visitor's presses, which is why everything here is a function it can
 * call, and nothing here has to have been listening from the start.
 *
 * What is typed is checked when the form is sent, not on every key. The same checks run again on the
 * server in v0.2c (`checkLead`, in src/engine, which the shop rules page describes). Once a problem is
 * showing, it goes away as soon as that field is put right.
 *
 * When the form is accepted it announces `lead-popup:submitted` on the document, carrying the checked
 * first name and email, whether the marketing box was ticked, and the code. It sends nothing itself.
 */

/** The sentences this script fills in, written into the popup as data by LeadPopup.astro. */
interface PopupWords {
  demoAnnounce: string;
  success: string;
  percent: string;
}

/** The form's fields, in the order they appear, which is the order problems are shown and focused in. */
const FIELDS = ['firstName', 'email'] as const;
type LeadField = (typeof FIELDS)[number];

function find<T extends Element>(root: ParentNode, selector: string): T {
  return root.querySelector<T>(selector)!;
}

const control = (dialog: HTMLDialogElement, field: LeadField) => find<HTMLInputElement>(dialog, `[data-lead-form] [name="${field}"]`);
const problemBox = (dialog: HTMLDialogElement, field: LeadField) => find<HTMLElement>(dialog, `[data-lead-error="${field}"]`);
const wordsOf = (dialog: HTMLDialogElement) => JSON.parse(dialog.dataset.words ?? '{}') as PopupWords;

function readValues(dialog: HTMLDialogElement): Record<LeadField, string> {
  return { firstName: control(dialog, 'firstName').value, email: control(dialog, 'email').value };
}

/**
 * Shows a problem under its field and ties it to the field, so that a screen reader reads it with the
 * field (`aria-describedby`) and knows the field is wrong (`aria-invalid`). The message is put in as
 * plain text, so whatever it holds is shown and never run.
 */
function showProblem(dialog: HTMLDialogElement, field: LeadField, message: string): void {
  const box = problemBox(dialog, field);
  box.textContent = message;
  box.hidden = false;
  control(dialog, field).setAttribute('aria-invalid', 'true');
  control(dialog, field).setAttribute('aria-describedby', box.id);
}

function clearProblem(dialog: HTMLDialogElement, field: LeadField): void {
  const box = problemBox(dialog, field);
  box.textContent = '';
  box.hidden = true;
  control(dialog, field).removeAttribute('aria-invalid');
  control(dialog, field).removeAttribute('aria-describedby');
}

/** The forms whose fields already clear a problem as it is put right, so the listener is added only once. */
const watched = new WeakSet<HTMLElement>();

/**
 * Once a problem is showing, takes it away as soon as its field passes. It does not show a new or a
 * changed message on the way, since the checks run when the form is sent and not on every key.
 */
function watchFields(dialog: HTMLDialogElement): void {
  const form = find<HTMLElement>(dialog, '[data-lead-form]');
  if (watched.has(form)) return;
  watched.add(form);
  form.addEventListener('input', (event) => {
    const field = (event.target as HTMLInputElement).name as LeadField;
    if (!FIELDS.includes(field) || problemBox(dialog, field).hidden) return;
    const result = checkLead(readValues(dialog));
    if (result.ok || !result.problems.some((problem) => problem.field === field)) clearProblem(dialog, field);
  });
}

/** Puts the form back as it was: empty, with no problems showing, and the form on screen instead of the code. */
function resetForm(dialog: HTMLDialogElement): void {
  find<HTMLFormElement>(dialog, '[data-lead-form]').reset();
  for (const field of FIELDS) clearProblem(dialog, field);
  find<HTMLElement>(dialog, '[data-lead-announce]').textContent = '';
  find<HTMLElement>(dialog, '[data-lead-success]').hidden = true;
  find<HTMLElement>(dialog, '[data-lead-ask]').hidden = false;
}

/**
 * Replaces the form with the message that shows the code, and moves the focus to it, since the button
 * that had it is no longer on screen. What was typed stays in the form until the popup is closed, and
 * then the form is put back empty, so the next time it opens it is fresh: a visitor who has taken the
 * code can try the popup again. A popup that is closed with a half-typed form keeps it, as a draft.
 */
function showCode(dialog: HTMLDialogElement, code: string): void {
  const words = wordsOf(dialog);
  find(dialog, '[data-lead-success-text]').textContent = fill(words.success, { code, percent: words.percent });
  find<HTMLElement>(dialog, '[data-lead-ask]').hidden = true;
  const message = find<HTMLElement>(dialog, '[data-lead-success]');
  message.hidden = false;
  message.focus();
  dialog.addEventListener('close', () => resetForm(dialog), { once: true });
}

/** True from the moment the form is sent until the answer comes, so a second press cannot send it twice. */
let sending = false;

/**
 * What "Show my code" does. The fields are checked, and if any is wrong the problems are shown and the
 * first wrong field gets the focus. Otherwise the lead is handed to `submitLead`, and when that says it was
 * accepted the code is shown and `lead-popup:submitted` is announced, in that order, so anything listening
 * sees the popup as the visitor does.
 */
export async function submitForm(dialog: HTMLDialogElement): Promise<void> {
  if (sending) return;

  const checked = checkLead(readValues(dialog));
  if (!checked.ok) {
    for (const field of FIELDS) {
      const problem = checked.problems.find((candidate) => candidate.field === field);
      if (problem) showProblem(dialog, field, problem.message);
      else clearProblem(dialog, field);
    }
    const first = FIELDS.find((field) => checked.problems.some((problem) => problem.field === field)) ?? FIELDS[0];
    control(dialog, first).focus();
    watchFields(dialog);
    return;
  }

  for (const field of FIELDS) clearProblem(dialog, field);
  const marketing = find<HTMLInputElement>(dialog, 'input[name="marketing"]').checked;
  const button = find<HTMLButtonElement>(dialog, '[data-lead-submit]');
  sending = true;
  button.disabled = true;
  let code: string;
  try {
    ({ code } = await submitLead({ ...checked.value, marketing }));
  } finally {
    sending = false;
    button.disabled = false;
  }
  showCode(dialog, code);
  document.dispatchEvent(new CustomEvent('lead-popup:submitted', { detail: { ...checked.value, marketing, code } }));
}

/** Sets a field the way typing would, so anything listening to the field (such as a problem being cleared) hears about it. */
function setField(dialog: HTMLDialogElement, field: LeadField, value: string): void {
  const input = control(dialog, field);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * What "Use demo data" (`another` false) and "Try another person" (`another` true) do: fill the two fields
 * with a fictional person, the same one all visit unless another is asked for, and say so to a screen
 * reader. The marketing box is never touched, so a demo button cannot give consent. "Try another person"
 * is shown from the first fill on, since there is nobody to change from before it.
 */
export function fillDemo(dialog: HTMLDialogElement, another: boolean): void {
  const person = demoLead(demoPersona(another));
  setField(dialog, 'firstName', person.firstName);
  setField(dialog, 'email', person.email);
  find<HTMLElement>(dialog, '[data-lead-new-person]').hidden = false;

  // A screen reader speaks a live region when its text changes, so the same sentence has to be taken out and put back.
  const announcement = find<HTMLElement>(dialog, '[data-lead-announce]');
  announcement.textContent = '';
  setTimeout(() => {
    announcement.textContent = wordsOf(dialog).demoAnnounce;
  }, 100);
}
