import type { CountryCode } from '../store/destinations';

/**
 * A fictional person for the "Use demo data" buttons, so no visitor has to type personal details.
 * There is deliberately no place for consent here. A demo button fills only these details, so it
 * cannot tick a consent box.
 */
export interface Persona {
  id: string;
  firstName: string;
  lastName: string;
  /** On example.com, which is reserved for examples and never delivers mail. */
  email: string;
  /** In the country's own set-aside range for fiction, so it can never ring a real person. */
  phone: string;
  address1: string;
  city: string;
  /** Only for Canada. */
  province?: string;
  postalCode: string;
  country: CountryCode;
}

// The streets are invented. The postal codes are in the right format for their country. The phone
// numbers are in each country's reserved fiction range: 555-0100 to 0199 for Canada and the United
// States, and the ranges Ofcom, ARCEP and the Bundesnetzagentur set aside for the United Kingdom,
// France and Germany. The three Canadians live in three provinces, so their orders show three tax rates.
export const PERSONAS: Persona[] = [
  {
    id: 'maya',
    firstName: 'Maya',
    lastName: 'Tremblay',
    email: 'maya.tremblay@example.com',
    phone: '+1 514 555 0142',
    address1: '47 Rue des Lilas',
    city: 'Montréal',
    province: 'QC',
    postalCode: 'H2J 3K4',
    country: 'CA',
  },
  {
    id: 'liam',
    firstName: 'Liam',
    lastName: 'Okafor',
    email: 'liam.okafor@example.com',
    phone: '+1 416 555 0117',
    address1: '310 Alder Street',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M6K 2P8',
    country: 'CA',
  },
  {
    id: 'priya',
    firstName: 'Priya',
    lastName: 'Sandhu',
    email: 'priya.sandhu@example.com',
    phone: '+1 604 555 0163',
    address1: '1509 Cedar Row',
    city: 'Vancouver',
    province: 'BC',
    postalCode: 'V5T 2B7',
    country: 'CA',
  },
  {
    id: 'jordan',
    firstName: 'Jordan',
    lastName: 'Ellis',
    email: 'jordan.ellis@example.com',
    phone: '+1 503 555 0128',
    address1: '905 Maple Court',
    city: 'Portland',
    postalCode: '97205',
    country: 'US',
  },
  {
    id: 'sam',
    firstName: 'Sam',
    lastName: 'Rivera',
    email: 'sam.rivera@example.com',
    phone: '+1 512 555 0184',
    address1: '2210 Bluebonnet Drive',
    city: 'Austin',
    postalCode: '78704',
    country: 'US',
  },
  {
    id: 'eleanor',
    firstName: 'Eleanor',
    lastName: 'Hughes',
    email: 'eleanor.hughes@example.com',
    phone: '+44 20 7946 0134',
    address1: '14 Larkfield Road',
    city: 'London',
    postalCode: 'SE15 4QT',
    country: 'GB',
  },
  {
    id: 'camille',
    firstName: 'Camille',
    lastName: 'Laurent',
    email: 'camille.laurent@example.com',
    phone: '+33 4 65 71 30 21',
    address1: '27 Rue des Tilleuls',
    city: 'Lyon',
    postalCode: '69003',
    country: 'FR',
  },
  {
    id: 'jonas',
    firstName: 'Jonas',
    lastName: 'Weber',
    email: 'jonas.weber@example.com',
    phone: '+49 30 23125 123',
    address1: 'Birkenweg 9',
    city: 'Berlin',
    postalCode: '10115',
    country: 'DE',
  },
];

/** Finds a person by id. It says nothing for an id that is not one of theirs, or is not text. */
export function personaById(id: unknown): Persona | undefined {
  return PERSONAS.find((persona) => persona.id === id);
}

/**
 * Picks a person. `random` gives a number from 0 up to, but not including, 1, such as `Math.random`.
 * When `exceptId` names a person, that person is left out, so asking for a new persona always changes it.
 */
export function pickPersona(random: () => number, exceptId?: string): Persona {
  const others = PERSONAS.filter((persona) => persona.id !== exceptId);
  return others[Math.min(Math.floor(random() * others.length), others.length - 1)];
}

/** What the lead popup's button fills. */
export function demoLead(persona: Persona): { firstName: string; email: string } {
  return { firstName: persona.firstName, email: persona.email };
}

/** What the button on the first checkout step fills. */
export function demoContact(persona: Persona): { email: string; phone: string } {
  return { email: persona.email, phone: persona.phone };
}

/** What the shipping address button fills. The province is left out for anywhere but Canada. */
export function demoAddress(persona: Persona): {
  country: CountryCode;
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  province?: string;
  postalCode: string;
} {
  const { country, firstName, lastName, address1, city, province, postalCode } = persona;
  return { country, firstName, lastName, address1, city, ...(province === undefined ? {} : { province }), postalCode };
}

/**
 * The person a demo button should fill in. A visit keeps one person, so that a lead and a later order
 * share one identity: the saved person is used again. When none is saved, or the saved id is not one of
 * theirs, a person is picked. When `another` is true a different person is picked, and it is never the
 * saved one. `savedId` is `unknown` because it comes out of the browser's storage.
 */
export function personaToUse(savedId: unknown, random: () => number, another = false): Persona {
  const saved = personaById(savedId);
  return saved !== undefined && !another ? saved : pickPersona(random, saved?.id);
}
