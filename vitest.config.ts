import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The random cart test takes a few seconds, so a slow or busy machine needs more time than the
    // default five. A test that hangs is still stopped after 30 seconds.
    testTimeout: 30_000,
  },
});
