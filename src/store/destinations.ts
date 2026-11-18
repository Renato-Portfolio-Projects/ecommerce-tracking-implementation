// The places Second Impression ships to, the demo tax rate for each, and how a phone number is
// written there. This is the store's own data. The tax lookup that uses it is in src/engine/tax.ts,
// and the phone rules that use it are in src/engine/phone.ts.

export type CountryCode = 'CA' | 'US' | 'GB' | 'FR' | 'DE' | 'IE' | 'IT' | 'NL' | 'ES';

/** How a phone number is written in a country. A number is checked by its calling code alone. */
export interface PhoneRule {
  /** The digits after the plus sign that name the country, such as "44". No code may start with another. */
  callingCode: string;
  /**
   * The digit dialled first for a call inside the country, such as the 0 in 07700 900123. It is left off once
   * the calling code is on, so +44 7700 900123 and not +44 07700 900123. Left out where there is none, as in
   * Italy, where the 0 of 06 is part of the number.
   */
  nationalPrefix?: string;
  /** How many digits a number has after the calling code, once the national prefix is left off. */
  digits: { fewest: number; most: number };
  /** A shape the digits must also have, for a country whose numbering plan has one. */
  shape?: RegExp;
}

export interface Country {
  code: CountryCode;
  name: string;
  /** Demo tax rate in percent. Canada has none here, because it is taxed by province. */
  taxPercent?: number;
  phone: PhoneRule;
}

// The phone rules were read on 2026-11-16 from Google's libphonenumber data (resources/PhoneNumberMetadata.xml,
// last changed upstream 2026-11-04). They check the shape and length of a number, not whether it exists. A real
// store uses the library itself, as the production guide says. Where Google allows more digits than an
// international number may have in all (15, counting the code), the most is what fits: Germany's is 13, not 15.

// Canada and the United States share one numbering plan: +1, a three-digit area code and a three-digit exchange
// that each start with 2 to 9, then four digits. Google's data accepts no number that breaks this.
const NORTH_AMERICA: PhoneRule = {
  callingCode: '1',
  nationalPrefix: '1',
  digits: { fewest: 10, most: 10 },
  shape: /^[2-9]\d{2}[2-9]\d{6}$/,
};

export interface Province {
  code: string;
  name: string;
  /** Demo tax rate in percent. */
  taxPercent: number;
}

// These are simplified demo rates, not tax advice. Tax is added on top of the price.
// The United States is 0% on purpose: there is no national sales tax, and a small foreign
// seller usually is not required to collect state sales tax until it passes a state's sales
// thresholds.
export const COUNTRIES: Country[] = [
  { code: 'CA', name: 'Canada', phone: NORTH_AMERICA },
  { code: 'US', name: 'United States', taxPercent: 0, phone: NORTH_AMERICA },
  {
    code: 'GB',
    name: 'United Kingdom',
    taxPercent: 20,
    phone: { callingCode: '44', nationalPrefix: '0', digits: { fewest: 9, most: 10 } },
  },
  {
    code: 'FR',
    name: 'France',
    taxPercent: 21,
    phone: { callingCode: '33', nationalPrefix: '0', digits: { fewest: 9, most: 9 } },
  },
  {
    code: 'DE',
    name: 'Germany',
    taxPercent: 21,
    phone: { callingCode: '49', nationalPrefix: '0', digits: { fewest: 5, most: 13 } },
  },
  {
    code: 'IE',
    name: 'Ireland',
    taxPercent: 21,
    phone: { callingCode: '353', nationalPrefix: '0', digits: { fewest: 7, most: 10 } },
  },
  {
    code: 'IT',
    name: 'Italy',
    taxPercent: 21,
    phone: { callingCode: '39', digits: { fewest: 6, most: 12 } },
  },
  {
    code: 'NL',
    name: 'Netherlands',
    taxPercent: 21,
    phone: { callingCode: '31', nationalPrefix: '0', digits: { fewest: 9, most: 9 } },
  },
  {
    code: 'ES',
    name: 'Spain',
    taxPercent: 21,
    phone: { callingCode: '34', digits: { fewest: 9, most: 9 } },
  },
];

export const PROVINCES: Province[] = [
  { code: 'AB', name: 'Alberta', taxPercent: 5 },
  { code: 'BC', name: 'British Columbia', taxPercent: 12 },
  { code: 'MB', name: 'Manitoba', taxPercent: 13 },
  { code: 'NB', name: 'New Brunswick', taxPercent: 13 },
  { code: 'NL', name: 'Newfoundland and Labrador', taxPercent: 13 },
  { code: 'NT', name: 'Northwest Territories', taxPercent: 13 },
  { code: 'NS', name: 'Nova Scotia', taxPercent: 13 },
  { code: 'NU', name: 'Nunavut', taxPercent: 13 },
  { code: 'ON', name: 'Ontario', taxPercent: 13 },
  { code: 'PE', name: 'Prince Edward Island', taxPercent: 13 },
  { code: 'QC', name: 'Québec', taxPercent: 14.975 },
  { code: 'SK', name: 'Saskatchewan', taxPercent: 13 },
  { code: 'YT', name: 'Yukon', taxPercent: 13 },
];
