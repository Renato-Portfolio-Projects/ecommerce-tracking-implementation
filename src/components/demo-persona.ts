import { personaToUse, type Persona } from '../demo/personas';

/**
 * The fictional person the "Use demo data" buttons fill in, kept for the visit so that a lead and a later
 * order share one identity. Only the person's id is kept, in sessionStorage, which the browser forgets
 * when the tab is closed. Which person to use is decided by `personaToUse` in src/demo, which is tested;
 * this only reads and writes the browser's storage.
 */

export const PERSONA_STORAGE_KEY = 'second-impression:persona';

/** The person's id, when the browser will not keep one (storage blocked): it lasts for as long as this page stays open. */
let remembered: string | undefined;

function savedId(): string | undefined {
  try {
    return sessionStorage.getItem(PERSONA_STORAGE_KEY) ?? remembered;
  } catch {
    return remembered;
  }
}

/**
 * The person to fill in now, and the one to fill in from now on. The first call of a visit picks one at
 * random, later calls give the same person, and `another` picks a different one.
 */
export function demoPersona(another = false): Persona {
  const persona = personaToUse(savedId(), Math.random, another);
  remembered = persona.id;
  try {
    sessionStorage.setItem(PERSONA_STORAGE_KEY, persona.id);
  } catch {
    // Nothing can be kept. The id in memory covers this page.
  }
  return persona;
}
