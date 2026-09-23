// Which drawing each product uses. This is the store's own data. The drawings themselves are made by
// src/components/Garment.astro, and each colour of a product is the same drawing recoloured.

/** The outline: a tee, or one of three cuts of trousers. */
export type GarmentKind = 'tee' | 'chino' | 'relaxed' | 'pleated';

/** What is printed on it: nothing, the two-circle mark, or the same mark printed well off register. */
export type Print = 'none' | 'logo' | 'misprint';

export interface Art {
  kind: GarmentKind;
  print: Print;
}

/** The drawing for each product, by its SKU. */
export const ART: Record<string, Art> = {
  'SI-TEE-001': { kind: 'tee', print: 'none' },
  'SI-TEE-002': { kind: 'tee', print: 'logo' },
  'SI-TEE-003': { kind: 'tee', print: 'misprint' },
  'SI-PNT-001': { kind: 'chino', print: 'none' },
  'SI-PNT-002': { kind: 'relaxed', print: 'none' },
  'SI-PNT-003': { kind: 'pleated', print: 'none' },
};
