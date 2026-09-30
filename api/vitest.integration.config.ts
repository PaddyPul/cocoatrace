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
      EVIDENCE_STORAGE_DRIVER: process.env.EVIDENCE_STORAGE_DRIVER || 'local',
      EVIDENCE_STORAGE_ENDPOINT: process.env.EVIDENCE_STORAGE_ENDPOINT || '',
      EVIDENCE_STORAGE_REGION: process.env.EVIDENCE_STORAGE_REGION || 'us-east-1',
      EVIDENCE_STORAGE_BUCKET: process.env.EVIDENCE_STORAGE_BUCKET || '',
      EVIDENCE_STORAGE_ACCESS_KEY: process.env.EVIDENCE_STORAGE_ACCESS_KEY || '',
      EVIDENCE_STORAGE_SECRET_KEY: process.env.EVIDENCE_STORAGE_SECRET_KEY || '',
      EVIDENCE_STORAGE_AUTO_CREATE_BUCKET: process.env.EVIDENCE_STORAGE_AUTO_CREATE_BUCKET || 'true',
      EVIDENCE_UPLOAD_SIGNING_SECRET: process.env.EVIDENCE_UPLOAD_SIGNING_SECRET || 'integration-evidence-signing-secret-32-chars',
      EVIDENCE_MAX_FILE_BYTES: process.env.EVIDENCE_MAX_FILE_BYTES || '10485760',
      EVIDENCE_ORGANIZATION_QUOTA_BYTES: process.env.EVIDENCE_ORGANIZATION_QUOTA_BYTES || '1073741824',
    },
  },
});
