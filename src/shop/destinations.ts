export type CountryCode = 'CA' | 'US' | 'GB' | 'FR' | 'DE' | 'IE' | 'IT' | 'NL' | 'ES';

export interface Country {
  code: CountryCode;
  name: string;
  /** Demo tax rate in percent. Canada has none here, because it is taxed by province. */
  taxPercent?: number;
}

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
  { code: 'CA', name: 'Canada' },
  { code: 'US', name: 'United States', taxPercent: 0 },
  { code: 'GB', name: 'United Kingdom', taxPercent: 20 },
  { code: 'FR', name: 'France', taxPercent: 21 },
  { code: 'DE', name: 'Germany', taxPercent: 21 },
  { code: 'IE', name: 'Ireland', taxPercent: 21 },
  { code: 'IT', name: 'Italy', taxPercent: 21 },
  { code: 'NL', name: 'Netherlands', taxPercent: 21 },
  { code: 'ES', name: 'Spain', taxPercent: 21 },
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

/**
 * The tax rate for a destination, in percent, or undefined when the store cannot ship there.
 * Canada needs a known province. Anywhere else, the province is ignored.
 */
export function taxPercentFor(country: string, province?: string): number | undefined {
  const match = COUNTRIES.find((candidate) => candidate.code === country);
  if (!match) return undefined;
  if (match.code === 'CA') {
    return PROVINCES.find((candidate) => candidate.code === province)?.taxPercent;
  }
  return match.taxPercent;
}
