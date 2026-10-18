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
    expect(() =>
      parseConfig({ ...deployedBase, APP_ENV: 'staging', EVIDENCE_STORAGE_DRIVER: 'local' }),
    ).toThrow(/EVIDENCE_STORAGE_DRIVER/);
    expect(() =>
      parseConfig({
        ...deployedBase,
        APP_ENV: 'staging',
        EVIDENCE_STORAGE_ENDPOINT: 'http://objects.example.com',
      }),
    ).toThrow(/EVIDENCE_STORAGE_ENDPOINT/);
  });

  it('requires environment-isolated evidence buckets', () => {
    expect(() => parseConfig({ ...deployedBase, APP_ENV: 'production' })).toThrow(
      /EVIDENCE_STORAGE_BUCKET/,
    );
  });

  it('requires a real malware scanner in deployed environments', () => {
    expect(() =>
      parseConfig({ ...deployedBase, APP_ENV: 'staging', EVIDENCE_SCANNER_DRIVER: 'development' }),
    ).toThrow(/EVIDENCE_SCANNER_DRIVER/);
    expect(() =>
      parseConfig({ ...deployedBase, APP_ENV: 'staging', EVIDENCE_SCANNER_HOST: '' }),
    ).toThrow(/EVIDENCE_SCANNER_HOST/);
  });

  it.each([
    ['weak secret', { JWT_SECRET: 'short' }],
    ['placeholder secret', { JWT_SECRET: 'change_me_change_me_change_me_change_me' }],
    ['insecure origin', { WEB_URL: 'http://app.example.com' }],
    ['insecure cookie', { COOKIE_SECURE: 'false' }],
  ])('rejects production with %s', (_label, override) => {
    expect(() => parseConfig({ ...deployedBase, APP_ENV: 'production', ...override })).toThrow(
      /Invalid CocoaTrace configuration/,
    );
  });

  it('rejects demo mode in production', () => {
    expect(() =>
      parseConfig({ ...deployedBase, APP_ENV: 'production', DEMO_MODE: 'true' }),
    ).toThrow(/DEMO_MODE/);
  });

  it('requires deployed values to be explicit rather than using local defaults', () => {
    expect(() => parseConfig({ APP_ENV: 'production' })).toThrow(/DATABASE_URL/);
  });

  it('requires the OpenAI key and model as a pair', () => {
    expect(() => parseConfig({ APP_ENV: 'development', OPENAI_API_KEY: 'secret' })).toThrow(
      /OPENAI_API_KEY and OPENAI_MODEL/,
    );
  });

  it('keeps identity email delivery disabled by default', () => {
    const result = parseConfig({ APP_ENV: 'development' });
    expect(result.identityEmailEnabled).toBe(false);
    expect(result.emailDriver).toBe('development');
  });

  it('fails closed when deployed identity email is enabled without SMTP', () => {
    expect(() =>
      parseConfig({
        ...deployedBase,
        APP_ENV: 'staging',
        IDENTITY_EMAIL_ENABLED: 'true',
      }),
    ).toThrow(/EMAIL_DRIVER/);
  });

  it('requires complete authenticated SMTP configuration', () => {
    expect(() => parseConfig({ APP_ENV: 'development', EMAIL_DRIVER: 'smtp' })).toThrow(
      /EMAIL_FROM.*SMTP_HOST.*SMTP_USER.*SMTP_PASSWORD/,
    );
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
    expect(() => parseConfig({ ...smtpBase, SMTP_REQUIRE_TLS: 'false' })).toThrow(
      /SMTP_REQUIRE_TLS/,
    );
    expect(() => parseConfig({ ...smtpBase, SMTP_TLS_REJECT_UNAUTHORIZED: 'false' })).toThrow(
      /SMTP_TLS_REJECT_UNAUTHORIZED/,
    );
  });

  it('rejects malformed booleans and fee values', () => {
    expect(() => parseConfig({ COOKIE_SECURE: 'sometimes' })).toThrow(/COOKIE_SECURE/);
    expect(() => parseConfig({ PLATFORM_FEE_BPS: '1001' })).toThrow(/PLATFORM_FEE_BPS/);
  });

  it('cannot disable privileged MFA in deployed environments', () => {
    expect(parseConfig({ ...deployedBase, APP_ENV: 'staging' }).mfaEnforced).toBe(true);
    expect(() =>
      parseConfig({ ...deployedBase, APP_ENV: 'staging', MFA_ENFORCED: 'false' }),
    ).toThrow(/MFA_ENFORCED/);
    expect(() =>
      parseConfig({
        APP_ENV: 'development',
        MFA_ENFORCED: 'true',
        WEB_URL: 'http://remote.example',
      }),
    ).toThrow(/WEB_URL/);
  });
  it('requires a finite evidence storage deadline and preserves a safe default', () => {
    expect(parseConfig({ APP_ENV: 'test' }).evidenceStorageTimeoutMs).toBe(15000);
    expect(
      parseConfig({ APP_ENV: 'test', EVIDENCE_STORAGE_TIMEOUT_MS: '500' }).evidenceStorageTimeoutMs,
    ).toBe(500);
    for (const value of ['0', '499', '120001', 'Infinity', 'NaN'])
      expect(() => parseConfig({ APP_ENV: 'test', EVIDENCE_STORAGE_TIMEOUT_MS: value })).toThrow(
        /EVIDENCE_STORAGE_TIMEOUT_MS/,
      );
  });
  it('rejects unknown environment names instead of falling back', () => {
    expect(() => parseConfig({ APP_ENV: 'prodution' })).toThrow(/Invalid CocoaTrace APP_ENV/);
  });
});

 describe('operator alert opt-in configuration', () => {
  const id='11111111-1111-4111-8111-111111111111';
  const smtp={ EMAIL_DRIVER:'smtp',EMAIL_FROM:'alerts@example.test',SMTP_HOST:'localhost',SMTP_USER:'test-user',SMTP_PASSWORD:'test-password' };
  it('defaults to disabled with no selected operator',()=>{
    expect(parseConfig({APP_ENV:'development'})).toMatchObject({operationsAlertsEnabled:false,operationsAlertRecipientUserIds:[]});
  });
  it('requires registered IDs and SMTP and rejects duplicate or invalid IDs',()=>{
    expect(()=>parseConfig({APP_ENV:'development',OPERATIONS_ALERTS_ENABLED:'true'})).toThrow(/OPERATIONS_ALERT_RECIPIENT_USER_IDS/);
    expect(()=>parseConfig({APP_ENV:'development',...smtp,OPERATIONS_ALERTS_ENABLED:'true',OPERATIONS_ALERT_RECIPIENT_USER_IDS:'not-an-id'})).toThrow(/OPERATIONS_ALERT_RECIPIENT_USER_IDS/);
    expect(()=>parseConfig({APP_ENV:'development',...smtp,OPERATIONS_ALERTS_ENABLED:'true',OPERATIONS_ALERT_RECIPIENT_USER_IDS:`${id},${id}`})).toThrow(/unique/);
    expect(parseConfig({APP_ENV:'development',...smtp,OPERATIONS_ALERTS_ENABLED:'true',OPERATIONS_ALERT_RECIPIENT_USER_IDS:id})).toMatchObject({operationsAlertsEnabled:true,operationsAlertRecipientUserIds:[id]});
  });
  it('keeps synthetic demos disabled and bounds SMTP command timeouts',()=>{
    expect(()=>parseConfig({APP_ENV:'demo',...smtp,OPERATIONS_ALERTS_ENABLED:'true',OPERATIONS_ALERT_RECIPIENT_USER_IDS:id})).toThrow(/synthetic demos/);
    expect(()=>parseConfig({APP_ENV:'development',...smtp,OPERATIONS_ALERTS_ENABLED:'true',OPERATIONS_ALERT_RECIPIENT_USER_IDS:id,SMTP_CONNECTION_TIMEOUT_MS:'11000'})).toThrow(/SMTP_CONNECTION_TIMEOUT_MS/);
  });
  it('preserves the existing demo storage namespace for an explicit local non-synthetic capture setup',()=>{
    expect(parseConfig({APP_ENV:'demo',DEMO_MODE:'false',...smtp,OPERATIONS_ALERTS_ENABLED:'true',OPERATIONS_ALERT_RECIPIENT_USER_IDS:id}).environment).toBe('demo');
  });
  it('requires verified TLS for deployed operator alerts even without identity email enabled',()=>{
    expect(()=>parseConfig({...deployedBase,APP_ENV:'staging',...smtp,OPERATIONS_ALERTS_ENABLED:'true',OPERATIONS_ALERT_RECIPIENT_USER_IDS:id,SMTP_SECURE:'false',SMTP_REQUIRE_TLS:'false'})).toThrow(/SMTP_REQUIRE_TLS/);
    expect(()=>parseConfig({...deployedBase,APP_ENV:'staging',...smtp,OPERATIONS_ALERTS_ENABLED:'true',OPERATIONS_ALERT_RECIPIENT_USER_IDS:id,SMTP_TLS_REJECT_UNAUTHORIZED:'false'})).toThrow(/SMTP_TLS_REJECT_UNAUTHORIZED/);
  });
 });

describe('legacy fee compatibility fixture isolation', () => {
  it('enforces the new policy by default and permits legacy fixtures only in disposable test configuration', () => {
    expect(parseConfig({APP_ENV:'development'}).testLegacyFeePolicy).toBe(false);
    expect(parseConfig({APP_ENV:'test',DATABASE_URL:'postgresql://test:test@localhost/cocoatrace_test',TEST_LEGACY_FEE_POLICY:'true'}).testLegacyFeePolicy).toBe(true);
    expect(() => parseConfig({APP_ENV:'development',TEST_LEGACY_FEE_POLICY:'true'})).toThrow();
    expect(() => parseConfig({APP_ENV:'test',DATABASE_URL:'postgresql://test:test@localhost/business',TEST_LEGACY_FEE_POLICY:'true'})).toThrow();
    expect(() => parseConfig({...deployedBase,APP_ENV:'production',TEST_LEGACY_FEE_POLICY:'true'})).toThrow();
  });
});
