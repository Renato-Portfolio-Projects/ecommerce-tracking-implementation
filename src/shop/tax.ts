import { COUNTRIES, PROVINCES } from '../store/destinations';

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
