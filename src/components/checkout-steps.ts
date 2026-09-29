import { checkAddress, checkContact, type FieldProblem } from '../engine/checkout-form';
import { checkPayment, demoCard, formatCardNumber, type CardField } from '../demo/test-cards';
import { demoAddress, demoContact } from '../demo/personas';
import { COUNTRIES, PROVINCES } from '../store/destinations';
import { postalCodeLabel } from '../engine/postal-codes';
import { demoPersona } from './demo-persona';

/**
 * The three steps of the checkout page (contact, shipping address, payment), each a native <details> with its
 * own <form>. What is typed is checked when a step's form is sent, with the same checks the server will run
 * again (src/engine/checkout-form.ts, src/demo/test-cards.ts). A step that passes collapses to a one-line
 * summary and opens the next one; any step can still be reopened by hand, which is what makes them editable.
 *
 * The review, the coupon and "Place order" are not here yet: they arrive with the review step.
 */

const STEP_ORDER = ['contact', 'address', 'payment'] as const;
type Step = (typeof STEP_ORDER)[number];

/** Set once the order is placed (checkout-review.ts's own `checkout:order-placed` event), so none of the
 * three steps can be reopened afterwards: editing a step that belongs to a placed order does not make sense. */
let locked = false;

function find<T extends Element>(root: ParentNode, selector: string): T {
  return root.querySelector<T>(selector)!;
}

function details(step: Step): HTMLDetailsElement {
  return find(document, `[data-checkout-step="${step}"]`);
}

function form(step: Step): HTMLFormElement {
  return find(details(step), `[data-checkout-form="${step}"]`);
}

const problemBox = (root: ParentNode, field: string) => find<HTMLElement>(root, `[data-checkout-error="${field}"]`);
const control = (root: ParentNode, field: string) => find<HTMLInputElement | HTMLSelectElement>(root, `[name="${field}"]`);

function showProblem(root: ParentNode, field: string, message: string): void {
  const box = problemBox(root, field);
  box.textContent = message;
  box.hidden = false;
  const input = control(root, field);
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', box.id);
}

function clearProblem(root: ParentNode, field: string): void {
  const box = problemBox(root, field);
  box.textContent = '';
  box.hidden = true;
  const input = control(root, field);
  input.removeAttribute('aria-invalid');
  input.removeAttribute('aria-describedby');
}

/** Every field name a step's form could show a problem for, so a field that is now right has its old problem cleared. */
const STEP_FIELDS: Record<Step, readonly string[]> = {
  contact: ['email', 'phone'],
  address: ['country', 'firstName', 'lastName', 'address1', 'address2', 'city', 'province', 'postalCode'],
  payment: ['number', 'expiry', 'securityCode'],
};

function clearAllProblems(step: Step): void {
  for (const field of STEP_FIELDS[step]) clearProblem(form(step), field);
}

function showProblems(step: Step, problems: readonly (FieldProblem | { field: CardField; message: string })[]): void {
  clearAllProblems(step);
  for (const problem of problems) showProblem(form(step), problem.field, problem.message);
  const first = STEP_FIELDS[step].find((field) => problems.some((problem) => problem.field === field));
  if (first) control(form(step), first).focus();
}

/** Reads a step's own fields into a plain object, by name, exactly as the checks expect. */
function readFields(step: Step): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of STEP_FIELDS[step]) values[field] = (control(form(step), field) as HTMLInputElement).value;
  return values;
}

/** The one word this script needs, written into the page as data by checkout.astro, so this eagerly-loaded
 * script does not carry the whole words file (see the comment on the element it reads from). */
function demoAnnounceText(): string {
  const box = find<HTMLElement>(document, '[data-checkout-announce]');
  return (JSON.parse(box.dataset.words ?? '{}') as { demoAnnounce?: string }).demoAnnounce ?? '';
}

function announceDemoFilled(): void {
  const box = find<HTMLElement>(document, '[data-checkout-announce]');
  box.textContent = '';
  // A screen reader speaks a live region when its text changes, so the same sentence has to be taken out and put back.
  setTimeout(() => {
    box.textContent = demoAnnounceText();
  }, 100);
}

/**
 * Told whenever a step is completed or reopened, so the review (checkout-review.ts) can show or hide itself.
 * The two files know nothing else about each other: the review works out whether every step is done by
 * reading the page, the same way it is told to a shopper, rather than by asking this file directly.
 */
function announceStepsChanged(): void {
  document.dispatchEvent(new CustomEvent('checkout:step-changed'));
}

/** Collapses a completed step to a one-line summary, shows Edit, and opens the next step if there is one and it is not open already. */
function completeStep(step: Step, summary: string): void {
  const dialog = details(step);
  dialog.open = false;
  const value = find<HTMLElement>(dialog, '[data-checkout-summary]');
  value.textContent = summary;
  value.hidden = false;
  find<HTMLElement>(dialog, '[data-checkout-edit]').hidden = false;

  const next = STEP_ORDER[STEP_ORDER.indexOf(step) + 1];
  if (next) details(next).open = true;
  announceStepsChanged();
}

/** Reopening a step for editing hides its summary and Edit link again, so they are never shown at the same time as the form. */
function reopenStep(step: Step): void {
  const dialog = details(step);
  find<HTMLElement>(dialog, '[data-checkout-summary]').hidden = true;
  find<HTMLElement>(dialog, '[data-checkout-edit]').hidden = true;
  announceStepsChanged();
}

function countryName(code: string): string {
  return COUNTRIES.find((country) => country.code === code)?.name ?? code;
}

function provinceName(code: string): string {
  return PROVINCES.find((province) => province.code === code)?.name ?? code;
}

function submitContact(event: SubmitEvent): void {
  event.preventDefault();
  const checked = checkContact(readFields('contact'));
  if (!checked.ok) {
    showProblems('contact', checked.problems);
    return;
  }
  clearAllProblems('contact');
  completeStep('contact', checked.value.phone ? `${checked.value.email} · ${checked.value.phone}` : checked.value.email);
}

function submitAddress(event: SubmitEvent): void {
  event.preventDefault();
  const checked = checkAddress(readFields('address'));
  if (!checked.ok) {
    showProblems('address', checked.problems);
    return;
  }
  clearAllProblems('address');
  const v = checked.value;
  const lines = [
    `${v.firstName} ${v.lastName}`,
    [v.address1, v.address2].filter(Boolean).join(', '),
    [v.city, v.province ? provinceName(v.province) : undefined, v.postalCode].filter(Boolean).join(', '),
    countryName(v.country),
  ];
  completeStep('address', lines.join(', '));
}

function submitPayment(event: SubmitEvent): void {
  event.preventDefault();
  const declined = find<HTMLElement>(form('payment'), '[data-checkout-declined]');
  declined.hidden = true;
  const checked = checkPayment(readFields('payment'), Date.now());
  if (checked.status === 'invalid') {
    showProblems('payment', checked.problems);
    return;
  }
  clearAllProblems('payment');
  if (checked.status === 'declined') {
    declined.textContent = checked.message;
    declined.hidden = false;
    return;
  }
  completeStep('payment', `${checked.card.brand} ending ${checked.card.last4}`);
}

const SUBMIT_HANDLERS: Record<Step, (event: SubmitEvent) => void> = {
  contact: submitContact,
  address: submitAddress,
  payment: submitPayment,
};

/** Shows or hides the province field, and relabels the postal code field, for the address form's chosen country. */
function updateForCountry(): void {
  const country = (control(form('address'), 'country') as HTMLSelectElement).value;
  const provinceField = find<HTMLElement>(form('address'), '[data-checkout-province-field]');
  provinceField.hidden = country !== 'CA';
  find<HTMLLabelElement>(form('address'), '[data-checkout-postal-label]').textContent = postalCodeLabel(country);
}

/** Fills a step's fields the way typing would, so anything listening to them (such as a problem being cleared) hears about it. */
function setField(root: ParentNode, field: string, value: string): void {
  const input = control(root, field);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function fillContactDemo(another: boolean): void {
  const person = demoContact(demoPersona(another));
  setField(form('contact'), 'email', person.email);
  setField(form('contact'), 'phone', person.phone);
  find<HTMLElement>(details('contact'), '[data-checkout-new-person="contact"]').hidden = false;
  announceDemoFilled();
}

function fillAddressDemo(another: boolean): void {
  const person = demoAddress(demoPersona(another));
  setField(form('address'), 'country', person.country);
  updateForCountry();
  setField(form('address'), 'firstName', person.firstName);
  setField(form('address'), 'lastName', person.lastName);
  setField(form('address'), 'address1', person.address1);
  setField(form('address'), 'city', person.city);
  if (person.province) setField(form('address'), 'province', person.province);
  setField(form('address'), 'postalCode', person.postalCode);
  find<HTMLElement>(details('address'), '[data-checkout-new-person="address"]').hidden = false;
  announceDemoFilled();
}

function fillPaymentDemo(): void {
  const card = demoCard(Date.now());
  setField(form('payment'), 'number', card.number);
  setField(form('payment'), 'expiry', card.expiry);
  setField(form('payment'), 'securityCode', card.securityCode);
  announceDemoFilled();
}

/** A step's <summary> is what the browser toggles the <details> from; blocking its click once locked is
 * what stops the toggle before it happens, since the "toggle" event itself only fires after the state has
 * already changed. */
function lockAllSteps(): void {
  locked = true;
  for (const step of STEP_ORDER) find<HTMLElement>(details(step), '[data-checkout-edit]').hidden = true;
}

export function initCheckoutSteps(): void {
  for (const step of STEP_ORDER) form(step).addEventListener('submit', SUBMIT_HANDLERS[step]);

  for (const step of STEP_ORDER) {
    details(step).addEventListener('toggle', () => {
      if (details(step).open) reopenStep(step);
    });
    find<HTMLElement>(details(step), 'summary').addEventListener('click', (event) => {
      if (locked) event.preventDefault();
    });
  }

  document.addEventListener('checkout:order-placed', lockAllSteps);

  updateForCountry();
  control(form('address'), 'country').addEventListener('change', updateForCountry);

  find<HTMLElement>(details('contact'), '[data-checkout-demo="contact"]').addEventListener('click', () => fillContactDemo(false));
  find<HTMLElement>(details('contact'), '[data-checkout-new-person="contact"]').addEventListener('click', () => fillContactDemo(true));
  find<HTMLElement>(details('address'), '[data-checkout-demo="address"]').addEventListener('click', () => fillAddressDemo(false));
  find<HTMLElement>(details('address'), '[data-checkout-new-person="address"]').addEventListener('click', () => fillAddressDemo(true));
  find<HTMLElement>(details('payment'), '[data-checkout-demo="payment"]').addEventListener('click', fillPaymentDemo);

  // The card number is shown grouped in fours as it is typed, the same way the demo button fills it in.
  control(form('payment'), 'number').addEventListener('input', (event) => {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/[^\d]/g, '');
    input.value = formatCardNumber(digits);
  });
}
