import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '../../src/store/destinations';
import { taxPercentFor } from '../../src/engine/tax';
import { checkAddress, checkContact, checkLead } from '../../src/engine/checkout-form';
import {
  PERSONAS,
  demoAddress,
  demoContact,
  demoLead,
  personaById,
  pickPersona,
  type Persona,
} from '../../src/demo/personas';

// The phone numbers each country sets aside for fiction, so a demo number can never ring a real person.
//   Canada and the United States: 555-0100 to 555-0199 in any area code (North American Numbering Plan).
//   United Kingdom: London 020 7946 0000 to 0999 (Ofcom's numbers for drama).
//   France: six blocks of 10,000 numbers, one for each of the first digits 1 to 6 (ARCEP's numbers for audiovisual works).
//   Germany: five city ranges of 1,000 numbers each (Bundesnetzagentur notice 148/2021).
const fictionPhone: Record<string, RegExp> = {
  CA: /^\+1 \d{3} 555 01\d{2}$/,
  US: /^\+1 \d{3} 555 01\d{2}$/,
  GB: /^\+44 20 7946 0\d{3}$/,
  FR: /^\+33 (?:1 99 00|2 61 91|3 53 01|4 65 71|5 36 49|6 39 98) \d{2} \d{2}$/,
  DE: /^\+49 (?:30 23125|69 90009|40 66969|221 4710|89 99998) \d{3}$/,
};

const byId = (id: string) => PERSONAS.find((persona) => persona.id === id)!;

describe('PERSONAS', () => {
  it('has eight fictional people', () => {
    expect(PERSONAS.map((persona) => `${persona.firstName} ${persona.lastName}`)).toEqual([
      'Maya Tremblay',
      'Liam Okafor',
      'Priya Sandhu',
      'Jordan Ellis',
      'Sam Rivera',
      'Eleanor Hughes',
      'Camille Laurent',
      'Jonas Weber',
    ]);
  });

  it('puts three in Canada, two in the United States and one each in the United Kingdom, France and Germany', () => {
    const counts: Record<string, number> = {};
    for (const persona of PERSONAS) counts[persona.country] = (counts[persona.country] ?? 0) + 1;
    expect(counts).toEqual({ CA: 3, US: 2, GB: 1, FR: 1, DE: 1 });
    for (const persona of PERSONAS) {
      expect(COUNTRIES.some((country) => country.code === persona.country), persona.id).toBe(true);
    }
  });

  it('puts the three Canadians in three provinces with three different tax rates', () => {
    const canadians = PERSONAS.filter((persona) => persona.country === 'CA');
    expect(canadians.map((persona) => persona.province)).toEqual(['QC', 'ON', 'BC']);
    const rates = canadians.map((persona) => taxPercentFor('CA', persona.province));
    expect(rates).toEqual([14.975, 13, 12]);
  });

  it('gives each person a short lowercase id, used once', () => {
    const ids = PERSONAS.map((persona) => persona.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+$/);
  });

  it('gives each person an email on example.com, which is reserved and never delivers', () => {
    for (const persona of PERSONAS) {
      expect(persona.email, persona.id).toBe(`${persona.firstName}.${persona.lastName}@example.com`.toLowerCase());
    }
  });

  it("gives each person a phone number in their country's reserved fiction range", () => {
    for (const persona of PERSONAS) {
      expect(persona.phone, persona.id).toMatch(fictionPhone[persona.country]);
    }
  });

  it('gives each person details that pass the checkout checks exactly as written', () => {
    for (const persona of PERSONAS) {
      const lead = demoLead(persona);
      const contact = demoContact(persona);
      const address = demoAddress(persona);
      expect(checkLead(lead), persona.id).toEqual({ ok: true, value: lead });
      expect(checkContact(contact), persona.id).toEqual({ ok: true, value: contact });
      expect(checkAddress(address), persona.id).toEqual({ ok: true, value: address });
    }
  });

  it('has no place for consent, so the demo button cannot tick a box', () => {
    const allowed = ['id', 'firstName', 'lastName', 'email', 'phone', 'address1', 'city', 'province', 'postalCode', 'country'];
    for (const persona of PERSONAS) {
      for (const key of Object.keys(persona)) expect(allowed, `${persona.id} ${key}`).toContain(key);
      expect(JSON.stringify(persona)).not.toMatch(/consent|marketing|newsletter|opt-?in|subscri/i);
    }
  });
});

describe('what each demo button fills', () => {
  const maya = byId('maya');

  it('fills the lead popup with a first name and an email', () => {
    expect(demoLead(maya)).toEqual({ firstName: 'Maya', email: 'maya.tremblay@example.com' });
  });

  it('fills the first checkout step with the same email, and a phone number', () => {
    expect(demoContact(maya)).toEqual({ email: 'maya.tremblay@example.com', phone: '+1 514 555 0142' });
  });

  it('fills the shipping address with the same name', () => {
    expect(demoAddress(maya)).toEqual({
      country: 'CA',
      firstName: 'Maya',
      lastName: 'Tremblay',
      address1: '47 Rue des Lilas',
      city: 'Montréal',
      province: 'QC',
      postalCode: 'H2J 3K4',
    });
  });

  it('shares one identity between the lead and the order, so the proof page can link them', () => {
    for (const persona of PERSONAS) {
      expect(demoLead(persona).email, persona.id).toBe(demoContact(persona).email);
      expect(demoLead(persona).firstName, persona.id).toBe(demoAddress(persona).firstName);
    }
  });

  it('leaves the province out for a person outside Canada', () => {
    expect('province' in demoAddress(byId('jordan'))).toBe(false);
    expect(demoAddress(byId('jonas'))).toEqual({
      country: 'DE',
      firstName: 'Jonas',
      lastName: 'Weber',
      address1: 'Birkenweg 9',
      city: 'Berlin',
      postalCode: '10115',
    });
  });

  it('hands out new objects, so changing what was filled cannot change the person', () => {
    const filled = demoAddress(maya);
    filled.city = 'Elsewhere';
    expect(demoAddress(maya).city).toBe('Montréal');
    expect(maya.city).toBe('Montréal');
  });
});

describe('personaById', () => {
  it('finds a person by id, and says nothing for anything else', () => {
    expect(personaById('eleanor')?.lastName).toBe('Hughes');
    expect(personaById('nobody')).toBeUndefined();
    expect(personaById('')).toBeUndefined();
    expect(personaById(undefined)).toBeUndefined();
    expect(personaById(null)).toBeUndefined();
    expect(personaById(3)).toBeUndefined();
    expect(personaById({ id: 'maya' })).toBeUndefined();
  });
});

describe('pickPersona', () => {
  // A small seeded generator, so the "random" picks are the same on every run.
  function seeded(seed: number) {
    let state = seed;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it('picks the first person for the lowest roll and the last for the highest, even one that is too high', () => {
    expect(pickPersona(() => 0)).toBe(PERSONAS[0]);
    expect(pickPersona(() => 0.999999)).toBe(PERSONAS[PERSONAS.length - 1]);
    expect(pickPersona(() => 1)).toBe(PERSONAS[PERSONAS.length - 1]);
  });

  it('can pick every person, about equally often', () => {
    const random = seeded(2026);
    const counts = new Map<string, number>();
    for (let i = 0; i < 2000; i += 1) {
      const persona = pickPersona(random);
      counts.set(persona.id, (counts.get(persona.id) ?? 0) + 1);
    }
    expect(counts.size).toBe(PERSONAS.length);
    for (const [id, count] of counts) {
      expect(count, id).toBeGreaterThan(150);
      expect(count, id).toBeLessThan(350);
    }
  });

  it('never gives back the person to leave out, so "new persona" always changes', () => {
    const random = seeded(8);
    for (const persona of PERSONAS) {
      for (let i = 0; i < 200; i += 1) {
        expect(pickPersona(random, persona.id).id, persona.id).not.toBe(persona.id);
      }
    }
    // The lowest and highest rolls still land on someone else.
    expect(pickPersona(() => 0, PERSONAS[0].id)).toBe(PERSONAS[1]);
    expect(pickPersona(() => 0.999999, PERSONAS[PERSONAS.length - 1].id)).toBe(PERSONAS[PERSONAS.length - 2]);
  });

  it('can still reach every other person when one is left out', () => {
    const random = seeded(4);
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) seen.add(pickPersona(random, 'maya').id);
    expect([...seen].sort()).toEqual(PERSONAS.map((persona) => persona.id).filter((id) => id !== 'maya').sort());
  });

  it('ignores an id that is not a person', () => {
    expect(pickPersona(() => 0, 'nobody')).toBe(PERSONAS[0]);
    expect(pickPersona(() => 0, '')).toBe(PERSONAS[0]);
  });

  it('gives a different person every time when asked again and again', () => {
    const random = seeded(31);
    let current: Persona = pickPersona(random);
    for (let i = 0; i < 500; i += 1) {
      const next = pickPersona(random, current.id);
      expect(next.id).not.toBe(current.id);
      current = next;
    }
  });
});
