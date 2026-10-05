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
      APP_ENV: 'test',
      // Fee boundary fixtures use a deterministic 1% policy, independent of local app configuration.
      PLATFORM_FEE_BPS: '100',
      IDENTITY_EMAIL_ENABLED: 'false',
      EMAIL_DRIVER: 'development',
      WEB_URL: 'http://localhost:3000',
      COOKIE_SECURE: 'false',
      EVIDENCE_STORAGE_DRIVER: process.env.EVIDENCE_STORAGE_DRIVER || 'local',
      EVIDENCE_STORAGE_ENDPOINT: process.env.EVIDENCE_STORAGE_ENDPOINT || '',
      EVIDENCE_STORAGE_REGION: process.env.EVIDENCE_STORAGE_REGION || 'us-east-1',
      EVIDENCE_STORAGE_BUCKET: process.env.EVIDENCE_STORAGE_BUCKET || '',
      EVIDENCE_STORAGE_ACCESS_KEY: process.env.EVIDENCE_STORAGE_ACCESS_KEY || '',
      EVIDENCE_STORAGE_SECRET_KEY: process.env.EVIDENCE_STORAGE_SECRET_KEY || '',
      EVIDENCE_STORAGE_AUTO_CREATE_BUCKET: process.env.EVIDENCE_STORAGE_AUTO_CREATE_BUCKET || 'true',
      EVIDENCE_UPLOAD_SIGNING_SECRET: process.env.EVIDENCE_UPLOAD_SIGNING_SECRET || 'integration-evidence-signing-secret-32-chars',
      // Keep boundary-test limits deterministic across direct Vitest, CI and
      // the Docker harness. Several assertions intentionally exceed these
      // small limits without allocating production-sized test files.
      EVIDENCE_MAX_FILE_BYTES: process.env.EVIDENCE_MAX_FILE_BYTES || '512',
      EVIDENCE_ORGANIZATION_QUOTA_BYTES: process.env.EVIDENCE_ORGANIZATION_QUOTA_BYTES || '700',
      EVIDENCE_SCANNER_DRIVER: process.env.EVIDENCE_SCANNER_DRIVER || 'development',
      EVIDENCE_SCANNER_HOST: process.env.EVIDENCE_SCANNER_HOST || '',
      EVIDENCE_SCANNER_PORT: process.env.EVIDENCE_SCANNER_PORT || '3310',
      EVIDENCE_SCANNER_TIMEOUT_MS: process.env.EVIDENCE_SCANNER_TIMEOUT_MS || '15000',
      EVIDENCE_SCANNER_RETRIES: process.env.EVIDENCE_SCANNER_RETRIES || '0',
    },
  },
});
