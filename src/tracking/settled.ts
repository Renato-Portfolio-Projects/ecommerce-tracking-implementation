/**
 * Waits for a question that is being asked, but never for longer than a limit. It settles as soon as the question
 * is answered, or fails, or the limit is reached, and it never throws. A first-time visitor's starting currency is
 * asked for just after the page loads (default-currency.ts), and an announcement that carries a price waits for it
 * here, so that it is recorded in the currency the visitor ends up seeing. If nothing is being asked, because the
 * visitor has chosen a currency or one is already known, it settles at once.
 */
export function settledAfter(question: Promise<unknown> | undefined, giveUpAfterMs: number): Promise<void> {
  if (question === undefined) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, giveUpAfterMs);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    question.then(done, done);
  });
}
