import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readBudgets } from '../../scripts/lighthouse.mjs';

const brand = readFileSync(new URL('../../docs/brand.md', import.meta.url), 'utf8');

describe('readBudgets', () => {
  it('reads the real budgets table from docs/brand.md', () => {
    expect(readBudgets(brand)).toEqual({
      'Performance (mobile)': '95 or more',
      'Accessibility (mobile)': '100',
      'Best Practices (mobile)': '95 or more',
      'JavaScript on a page': '30 KB or less',
    });
  });

  it('reads a table built the same way, so the parsing does not depend on today\'s wording', () => {
    const made = [
      '## Speed and accessibility budgets',
      '',
      'Some words before the table.',
      '',
      '| Metric | Budget |',
      '|---|---|',
      '| One thing | 10 |',
      '| Another `thing` | 20 or more |',
    ].join('\n');
    expect(readBudgets(made)).toEqual({ 'One thing': '10', 'Another thing': '20 or more' });
  });

  it('refuses a page with no such heading, rather than silently reading nothing', () => {
    expect(() => readBudgets('# Nothing here')).toThrow('Heading not found');
  });
});
