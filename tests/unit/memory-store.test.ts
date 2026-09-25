import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../../src/server/memory-store';
import type { LeadRecord } from '../../src/server/store';

const RECORD: LeadRecord = { firstName: 'Maya', email: 'maya@example.com', marketing: false, source: 'auto', createdAt: '2026-09-25T12:30:00.000Z' };

function setup() {
  let clock = 1_000_000;
  return { store: createMemoryStore(() => clock), advance: (seconds: number) => (clock += seconds * 1000) };
}

describe('the counters of the store in memory', () => {
  it('start at 1 and count up', async () => {
    const { store } = setup();
    expect([await store.increment('rl:a', 60), await store.increment('rl:a', 60), await store.increment('rl:a', 60)]).toEqual([1, 2, 3]);
  });

  it('are kept apart by name', async () => {
    const { store } = setup();
    await store.increment('rl:a', 60);
    await store.increment('rl:a', 60);
    expect(await store.increment('rl:b', 60)).toBe(1);
  });

  it('are deleted when their time is up, and start again from 1', async () => {
    const { store, advance } = setup();
    await store.increment('rl:a', 60);
    await store.increment('rl:a', 60);
    advance(59);
    expect(store.keys()).toEqual(['rl:a']);
    advance(1);
    expect(store.keys()).toEqual([]);
    expect(await store.increment('rl:a', 60)).toBe(1);
  });

  it('start again from 1 once their time is up, even when nothing has looked at them in between', async () => {
    const { store, advance } = setup();
    await store.increment('rl:a', 60);
    await store.increment('rl:a', 60);
    advance(60);
    expect(await store.increment('rl:a', 60)).toBe(1);
    expect(await store.increment('rl:a', 60)).toBe(2);
  });

  it('have their time moved on by every addition, as the real store does', async () => {
    const { store, advance } = setup();
    await store.increment('rl:a', 60);
    advance(40);
    await store.increment('rl:a', 60);
    expect(store.secondsLeft('rl:a')).toBe(60);
    advance(40);
    expect(store.secondsLeft('rl:a')).toBe(20);
  });
});

describe('the leads of the store in memory', () => {
  it('are kept under their id, with the prefix the real store uses, and read back', async () => {
    const { store } = setup();
    await store.saveLead('abc', RECORD, 100);
    expect(await store.readLead('abc')).toEqual(RECORD);
    expect(store.keys()).toEqual(['lead:abc']);
    expect(await store.readLead('other')).toBeUndefined();
  });

  it('are deleted when their time is up', async () => {
    const { store, advance } = setup();
    await store.saveLead('abc', RECORD, 100);
    expect(store.secondsLeft('lead:abc')).toBe(100);
    advance(99);
    expect(await store.readLead('abc')).toEqual(RECORD);
    advance(1);
    expect(await store.readLead('abc')).toBeUndefined();
    expect(store.secondsLeft('lead:abc')).toBeUndefined();
    expect(store.keys()).toEqual([]);
  });

  it('cannot be changed by changing what was handed in or what was read out', async () => {
    const { store } = setup();
    const handed = { ...RECORD };
    await store.saveLead('abc', handed, 100);
    handed.firstName = 'Changed';
    const read = await store.readLead('abc');
    read!.email = 'changed@example.com';
    expect(await store.readLead('abc')).toEqual(RECORD);
  });

  it('are separate from the counters, though both are listed by name', async () => {
    const { store } = setup();
    await store.increment('rl:a', 60);
    await store.saveLead('abc', RECORD, 100);
    expect(store.keys().sort()).toEqual(['lead:abc', 'rl:a']);
    expect(store.secondsLeft('rl:a')).toBe(60);
    expect(store.secondsLeft('nothing')).toBeUndefined();
  });
});
