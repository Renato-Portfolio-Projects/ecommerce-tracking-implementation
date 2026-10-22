import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settledAfter } from '../../src/tracking/settled';

// A first-time visitor's starting currency is asked for just after the page loads. An announcement that carries
// a price waits for the answer so it is recorded in the currency the visitor ends up seeing, but never for
// longer than a limit, so a slow or failed answer cannot hold tracking back.

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** A question that is answered, or fails, when the test says so. */
function openQuestion() {
  let answer!: (value: unknown) => void;
  let fail!: (reason: unknown) => void;
  const question = new Promise<unknown>((resolve, reject) => {
    answer = resolve;
    fail = reject;
  });
  return { question, answer, fail };
}

/** Whether a promise has settled yet, without waiting for it. */
async function settledNow(promise: Promise<void>): Promise<boolean> {
  let settled = false;
  void promise.then(() => {
    settled = true;
  });
  await vi.advanceTimersByTimeAsync(0);
  return settled;
}

describe('settledAfter', () => {
  it('settles at once when nothing is being asked', async () => {
    expect(await settledNow(settledAfter(undefined, 1500))).toBe(true);
  });

  it('settles as soon as the question is answered, without waiting for the limit', async () => {
    const { question, answer } = openQuestion();
    const waiting = settledAfter(question, 1500);
    expect(await settledNow(waiting)).toBe(false);
    answer('USD');
    expect(await settledNow(waiting)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('settles when the question fails, and does not throw', async () => {
    const { question, fail } = openQuestion();
    const waiting = settledAfter(question, 1500);
    fail(new Error('the server could not be reached'));
    expect(await settledNow(waiting)).toBe(true);
  });

  it('settles when the limit is reached, and not before, if the question is never answered', async () => {
    const { question } = openQuestion();
    const waiting = settledAfter(question, 1500);
    await vi.advanceTimersByTimeAsync(1499);
    expect(await settledNow(waiting)).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await settledNow(waiting)).toBe(true);
  });

  it('settles at once for a question that was answered a while ago', async () => {
    expect(await settledNow(settledAfter(Promise.resolve('CAD'), 1500))).toBe(true);
  });
});
