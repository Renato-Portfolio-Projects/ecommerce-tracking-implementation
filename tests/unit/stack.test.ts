import { describe, expect, it } from 'vitest';
import { STACK, validateStack, type StackEntry } from '../../src/data/stack';

const valid: StackEntry = {
  id: 'example-tool',
  name: 'Example tool',
  category: 'site',
  role: 'Does one thing',
  plan: 'Free',
  annualCostUsd: 0,
  dataTouched: 'none',
  consent: 'none',
  status: 'planned',
};

describe('validateStack', () => {
  it('accepts a well-formed entry', () => {
    expect(validateStack([valid])).toEqual([]);
  });

  it('rejects duplicate ids', () => {
    expect(validateStack([valid, valid])).toContain('example-tool: duplicate id');
  });

  it('rejects ids that are not kebab-case', () => {
    expect(validateStack([{ ...valid, id: 'Example_Tool' }])).toContain(
      'Example_Tool: id must be kebab-case',
    );
  });

  it('lets only the domain cost money', () => {
    expect(validateStack([{ ...valid, annualCostUsd: 5 }])).toContain(
      'example-tool: only the domain may cost money',
    );
    expect(validateStack([{ ...valid, id: 'namecheap', annualCostUsd: 15 }])).toEqual([]);
  });

  it('requires evidence before an entry can be marked verified', () => {
    expect(validateStack([{ ...valid, status: 'verified' }])).toContain(
      'example-tool: verified needs evidence',
    );
    expect(
      validateStack([{ ...valid, status: 'verified', evidence: 'commit abc1234' }]),
    ).toEqual([]);
  });

  it('requires a consent category when an entry touches data', () => {
    expect(validateStack([{ ...valid, dataTouched: 'anonymous', consent: 'none' }])).toContain(
      'example-tool: touches data but has no consent category',
    );
  });
});

describe('STACK', () => {
  it('passes validation', () => {
    expect(validateStack(STACK)).toEqual([]);
  });

  it('costs nothing except the domain', () => {
    const paying = STACK.filter((entry) => entry.annualCostUsd > 0).map((entry) => entry.id);
    expect(paying).toEqual(['namecheap']);
  });

  it('lists every tool the design names for v1.0', () => {
    const ids = STACK.map((entry) => entry.id);
    for (const required of [
      'astro',
      'vercel',
      'upstash-redis',
      'namecheap',
      'gtm-web',
      'gtm-server',
      'ga4',
      'meta-pixel',
      'meta-conversions-api',
      'consent-banner',
      'playwright',
      'github',
      'claude-code',
    ]) {
      expect(ids).toContain(required);
    }
  });
});
