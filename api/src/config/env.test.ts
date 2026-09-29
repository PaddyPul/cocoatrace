import { describe, expect, it } from 'vitest';
import { parseConfig } from './env';

const deployedBase = {
  DATABASE_URL: 'postgresql://user:password@database.internal:5432/cocoatrace',
  JWT_SECRET: 'a-production-grade-secret-with-32-characters',
  WEB_URL: 'https://app.cocoatrace.example',
  PUBLIC_WEB_URL: 'https://app.cocoatrace.example',
  COOKIE_SECURE: 'true',
  APP_VERSION: 'abc1234',
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

  it('rejects malformed booleans and fee values', () => {
    expect(() => parseConfig({ COOKIE_SECURE: 'sometimes' })).toThrow(/COOKIE_SECURE/);
    expect(() => parseConfig({ PLATFORM_FEE_BPS: '1001' })).toThrow(/PLATFORM_FEE_BPS/);
  });

  it('rejects unknown environment names instead of falling back', () => {
    expect(() => parseConfig({ APP_ENV: 'prodution' })).toThrow(/Invalid CocoaTrace APP_ENV/);
  });
});
