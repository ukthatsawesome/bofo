import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Enables global test functions (describe, it, expect, etc.) without explicit imports
    globals: true,

    // Sets the test environment to Node.js (suitable for main-process/backend logic)
    environment: 'node',

    // Glob patterns to locate test files
    include: [
      'src/**/*.test.ts',
      'src/tests/**/*.test.ts',
    ],
  },
});