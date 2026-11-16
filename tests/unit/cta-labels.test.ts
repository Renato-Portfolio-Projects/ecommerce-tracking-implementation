import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CTA_LABELS } from '../../src/tracking/cta-labels';
import { tableUnderHeading } from '../helpers/markdown';

const doc = readFileSync(new URL('../../docs/tracking-plan.md', import.meta.url), 'utf8');
const labelRows = () => tableUnderHeading(doc, '## Call-to-action labels');
const withoutBackticks = (cell: string) => cell.replaceAll('`', '');

describe('CTA_LABELS', () => {
  it('has twenty labels, none of them twice', () => {
    expect(CTA_LABELS).toHaveLength(20);
    expect(new Set(CTA_LABELS).size).toBe(CTA_LABELS.length);
  });

  it('writes every label as an area, a dash and the item, the way the first three already were', () => {
    for (const label of CTA_LABELS) expect(label, label).toMatch(/^[A-Z][A-Za-z ]* - [A-Z][A-Za-z ]*$/);
  });

  it('keeps the three labels the lead popup and the footer already carried', () => {
    expect(CTA_LABELS).toEqual(expect.arrayContaining(['Lead Popup - Footer link', 'Lead Popup - Corner tab', 'Demo Data - Lead popup']));
  });
});

describe('docs/tracking-plan.md, call-to-action labels', () => {
  it('lists the same labels, in the same order, as the code', () => {
    expect(labelRows().map((row) => withoutBackticks(row[0]))).toEqual([...CTA_LABELS]);
  });

  it('says where each label is', () => {
    for (const [label, where] of labelRows()) expect(where.length, label).toBeGreaterThan(10);
  });
});
