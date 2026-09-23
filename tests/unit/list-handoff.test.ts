import { describe, expect, it } from 'vitest';
import { listHandoffKey, parseListContext, serializeListContext } from '../../src/engine/list-handoff';

describe('list handoff', () => {
  it('round-trips a list context through serialize and parse', () => {
    const context = { listId: 'tees', listName: 'Tees', index: 2 };
    expect(parseListContext(serializeListContext(context))).toEqual(context);
  });

  it('gives a different key for each SKU', () => {
    expect(listHandoffKey('SI-TEE-001')).not.toBe(listHandoffKey('SI-TEE-002'));
  });

  it('has nothing for missing, empty or damaged data', () => {
    expect(parseListContext(null)).toBeUndefined();
    expect(parseListContext(undefined)).toBeUndefined();
    expect(parseListContext('')).toBeUndefined();
    expect(parseListContext('not json')).toBeUndefined();
  });

  it('has nothing for data missing a required field', () => {
    expect(parseListContext(JSON.stringify({ listId: 'tees', listName: 'Tees' }))).toBeUndefined();
  });

  it('has nothing for data with the wrong field types', () => {
    expect(parseListContext(JSON.stringify({ listId: 'tees', listName: 'Tees', index: '2' }))).toBeUndefined();
  });
});
