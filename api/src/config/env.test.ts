import { describe, expect, it } from 'vitest';
import { parseConfig } from './env';

const deployedBase = {
  DATABASE_URL: 'postgresql://user:password@database.internal:5432/cocoatrace',
  JWT_SECRET: 'a-production-grade-secret-with-32-characters',
  WEB_URL: 'https://app.cocoatrace.example',
  PUBLIC_WEB_URL: 'https://app.cocoatrace.example',
  COOKIE_SECURE: 'true',
  APP_VERSION: 'abc1234',
  EVIDENCE_STORAGE_DRIVER: 's3',
  EVIDENCE_STORAGE_ENDPOINT: 'https://objects.example.com',
  EVIDENCE_STORAGE_BUCKET: 'cocoatrace-staging-evidence',
  EVIDENCE_STORAGE_ACCESS_KEY: 'staging-access-key',
  EVIDENCE_STORAGE_SECRET_KEY: 'staging-secret-key',
  EVIDENCE_STORAGE_SSE: 'AES256',
  EVIDENCE_UPLOAD_SIGNING_SECRET: 'a-separate-upload-secret-with-32-characters',
  EVIDENCE_SCANNER_DRIVER: 'clamav',
  EVIDENCE_SCANNER_HOST: 'scanner.internal',
};

describe('environment configuration', () => {
  it('provides safe local defaults for development', () => {
    const result = parseConfig({ APP_ENV: 'development' });
    expect(result.environment).toBe('development');
    expect(result.demoMode).toBe(false);
    expect(result.databaseUrl).toContain('localhost');
  });

  it('supports an explicit isolated demo environment', () => {
    const result = parseConfig({ APP_ENV: 'demo', DEMO_MODE: 'true' });
    expect(result.demoMode).toBe(true);
    expect(result.isProduction).toBe(false);
  });

  it('accepts a secure staging configuration', () => {
    const result = parseConfig({ ...deployedBase, APP_ENV: 'staging' });
    expect(result.isDeployed).toBe(true);
  });

  it('rejects deployed local evidence storage and insecure object storage', () => {
    expect(() => parseConfig({ ...deployedBase, APP_ENV: 'staging', EVIDENCE_STORAGE_DRIVER: 'local' })).toThrow(/EVIDENCE_STORAGE_DRIVER/);
    expect(() => parseConfig({ ...deployedBase, APP_ENV: 'staging', EVIDENCE_STORAGE_ENDPOINT: 'http://objects.example.com' })).toThrow(/EVIDENCE_STORAGE_ENDPOINT/);
  });

  it('requires environment-isolated evidence buckets', () => {
    expect(() => parseConfig({ ...deployedBase, APP_ENV: 'production' })).toThrow(/EVIDENCE_STORAGE_BUCKET/);
  });

  it('requires a real malware scanner in deployed environments', () => {
    expect(() => parseConfig({ ...deployedBase, APP_ENV: 'staging', EVIDENCE_SCANNER_DRIVER: 'development' })).toThrow(/EVIDENCE_SCANNER_DRIVER/);
    expect(() => parseConfig({ ...deployedBase, APP_ENV: 'staging', EVIDENCE_SCANNER_HOST: '' })).toThrow(/EVIDENCE_SCANNER_HOST/);
  });

  it.each([
    ['weak secret', { JWT_SECRET: 'short' }],
    ['placeholder secret', { JWT_SECRET: 'change_me_change_me_change_me_change_me' }],
    ['insecure origin', { WEB_URL: 'http://app.example.com' }],
    ['insecure cookie', { COOKIE_SECURE: 'false' }],
  ])('rejects production with %s', (_label, override) => {
    expect(() => parseConfig({ ...deployedBase, APP_ENV: 'production', ...override })).toThrow(/Invalid CocoaTrace configuration/);
  });

  it('rejects demo mode in production', () => {
    expect(() => parseConfig({ ...deployedBase, APP_ENV: 'production', DEMO_MODE: 'true' })).toThrow(/DEMO_MODE/);
  });

  it('requires deployed values to be explicit rather than using local defaults', () => {
    expect(() => parseConfig({ APP_ENV: 'production' })).toThrow(/DATABASE_URL/);
  });

  it('requires the OpenAI key and model as a pair', () => {
    expect(() => parseConfig({ APP_ENV: 'development', OPENAI_API_KEY: 'secret' })).toThrow(/OPENAI_API_KEY and OPENAI_MODEL/);
  });

  it('keeps identity email delivery disabled by default', () => {
    const result = parseConfig({ APP_ENV: 'development' });
    expect(result.identityEmailEnabled).toBe(false);
    expect(result.emailDriver).toBe('development');
  });

  it('fails closed when deployed identity email is enabled without SMTP', () => {
    expect(() => parseConfig({
      ...deployedBase,
      APP_ENV: 'staging',
      IDENTITY_EMAIL_ENABLED: 'true',
    })).toThrow(/EMAIL_DRIVER/);
  });

  it('requires complete authenticated SMTP configuration', () => {
    expect(() => parseConfig({ APP_ENV: 'development', EMAIL_DRIVER: 'smtp' })).toThrow(/EMAIL_FROM.*SMTP_HOST.*SMTP_USER.*SMTP_PASSWORD/);
  });

  it('accepts encrypted SMTP for deployed identity email', () => {
    const result = parseConfig({
      ...deployedBase,
      APP_ENV: 'staging',
      IDENTITY_EMAIL_ENABLED: 'true',
      EMAIL_DRIVER: 'smtp',
      EMAIL_FROM: 'identity@cocoatrace.example',
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'cocoatrace',
      SMTP_PASSWORD: 'smtp-provider-credential',
      SMTP_REQUIRE_TLS: 'true',
      SMTP_TLS_REJECT_UNAUTHORIZED: 'true',
    });
    expect(result.identityEmailEnabled).toBe(true);
    expect(result.emailDriver).toBe('smtp');
  });

  it('rejects unencrypted or certificate-unverified SMTP in deployed identity email', () => {
    const smtpBase = {
      ...deployedBase,
      APP_ENV: 'staging',
      IDENTITY_EMAIL_ENABLED: 'true',
      EMAIL_DRIVER: 'smtp',
      EMAIL_FROM: 'identity@cocoatrace.example',
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'cocoatrace',
      SMTP_PASSWORD: 'smtp-provider-credential',
    };
    expect(() => parseConfig({ ...smtpBase, SMTP_REQUIRE_TLS: 'false' })).toThrow(/SMTP_REQUIRE_TLS/);
    expect(() => parseConfig({ ...smtpBase, SMTP_TLS_REJECT_UNAUTHORIZED: 'false' })).toThrow(/SMTP_TLS_REJECT_UNAUTHORIZED/);
  });

  it('rejects malformed booleans and fee values', () => {
    expect(() => parseConfig({ COOKIE_SECURE: 'sometimes' })).toThrow(/COOKIE_SECURE/);
    expect(() => parseConfig({ PLATFORM_FEE_BPS: '1001' })).toThrow(/PLATFORM_FEE_BPS/);
  });

  it('rejects unknown environment names instead of falling back', () => {
    expect(() => parseConfig({ APP_ENV: 'prodution' })).toThrow(/Invalid CocoaTrace APP_ENV/);
  });
});
