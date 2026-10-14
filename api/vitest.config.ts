import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Unit tests that import the audit helper also load the pool module. The
    // pool connects lazily, so a non-routable test URL is sufficient here.
    env: { OPERATIONS_ALERTS_ENABLED: 'false', OPERATIONS_ALERT_RECIPIENT_USER_IDS: '', DATABASE_URL: 'postgresql://cocoa:cocoa@127.0.0.1:1/cocoatrace_test' },
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
