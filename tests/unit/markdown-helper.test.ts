import { describe, expect, it } from 'vitest';
import { tableUnderHeading } from '../helpers/markdown';

const sample = [
  '# Title',
  '',
  '## Other',
  '| a | b |',
  '|---|---|',
  '| wrong | table |',
  '',
  '## Wanted',
  '',
  'Some text.',
  '',
  '| Name | Value |',
  '|---|---|',
  '| one | 1 |',
  '| two | 2 |',
  '',
  'After the table.',
].join('\n');

describe('tableUnderHeading', () => {
  it('returns the data rows of the first table under the heading', () => {
    expect(tableUnderHeading(sample, '## Wanted')).toEqual([
      ['one', '1'],
      ['two', '2'],
    ]);
  });

  it('handles Windows line endings', () => {
    expect(tableUnderHeading(sample.replaceAll('\n', '\r\n'), '## Wanted')).toEqual([
      ['one', '1'],
      ['two', '2'],
    ]);
  });

  it('throws a clear error when the heading is missing', () => {
    expect(() => tableUnderHeading(sample, '## Missing')).toThrow('Heading not found: ## Missing');
  });
});
