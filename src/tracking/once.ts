/**
 * Lets something happen once, and not again until it is reset. The lead popup's main button counts as a
 * `select_promotion` only the first time it is pressed each time the popup is shown, so a visitor who presses it
 * again after a mistake in the form is not counted twice (see src/tracking/page-tracking.ts).
 */
export interface OnceGate {
  /** True the first time it is asked after a reset, and false every time after that. */
  take(): boolean;
  /** Lets the next `take` through again. */
  reset(): void;
}

export function createOnceGate(): OnceGate {
  let taken = false;
  return {
    take() {
      if (taken) return false;
      taken = true;
      return true;
    },
    reset() {
      taken = false;
    },
  };
}
