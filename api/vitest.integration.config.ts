import { defineConfig } from 'vitest/config';

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.integration.test.ts'],
    globalSetup: ['./test/integration/globalSetup.ts'],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 15_000,
    env: {
      ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
      JWT_SECRET: process.env.JWT_SECRET || 'integration-only-secret-at-least-32-characters',
      NODE_ENV: 'test',
      WEB_URL: 'http://localhost:3000',
      COOKIE_SECURE: 'false',
    },
  },
});
