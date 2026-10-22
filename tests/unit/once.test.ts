import { describe, expect, it } from 'vitest';
import { createOnceGate } from '../../src/tracking/once';

describe('createOnceGate', () => {
  it('lets the first try through and turns the rest away', () => {
    const gate = createOnceGate();
    expect(gate.take()).toBe(true);
    expect(gate.take()).toBe(false);
    expect(gate.take()).toBe(false);
  });

  it('lets one try through again after it is reset, and then turns the rest away again', () => {
    const gate = createOnceGate();
    gate.take();
    gate.reset();
    expect(gate.take()).toBe(true);
    expect(gate.take()).toBe(false);
  });

  it('is not harmed by a reset when nothing had been taken', () => {
    const gate = createOnceGate();
    gate.reset();
    expect(gate.take()).toBe(true);
    expect(gate.take()).toBe(false);
  });

  it('keeps one gate apart from another', () => {
    const first = createOnceGate();
    const second = createOnceGate();
    first.take();
    expect(second.take()).toBe(true);
    first.reset();
    expect(second.take()).toBe(false);
  });
});
