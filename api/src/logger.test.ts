import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { loggerRedactionPaths, useDevelopmentLogTransport } from './logger';

describe('logger redaction', () => {
  it('redacts authentication headers, cookies and common application secrets', () => {
    expect(loggerRedactionPaths).toEqual(expect.arrayContaining([
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'res.headers["set-cookie"]',
      'password',
      '*.password',
      'accessToken',
      '*.accessToken',
      'openAiApiKey',
      'jwtSecret',
      'evidenceStorageSecretKey',
      'evidenceUploadSigningSecret',
    ]));
  });

  it('does not write configured secrets to a structured log', () => {
    let output = '';
    const testLogger = pino(
      { redact: { paths: loggerRedactionPaths, censor: '[REDACTED]' } },
      { write: (line: string) => { output += line; } },
    );

    testLogger.info({
      req: { headers: { authorization: 'Bearer private-token', cookie: 'ct_session=private-cookie' } },
      password: 'private-password',
      evidenceStorageSecretKey: 'private-storage-key',
    }, 'redaction check');

    expect(output).not.toContain('private-token');
    expect(output).not.toContain('private-cookie');
    expect(output).not.toContain('private-password');
    expect(output).not.toContain('private-storage-key');
    expect(output).toContain('[REDACTED]');
  });
});


describe('runtime logging profiles', () => {
  it('container demo, browser fixtures and deployed profiles do not require development tooling', () => {
    for (const environment of ['demo', 'test', 'staging', 'production']) {
      expect(useDevelopmentLogTransport(environment, 'production')).toBe(false);
      expect(useDevelopmentLogTransport(environment, 'test')).toBe(false);
    }
    expect(useDevelopmentLogTransport('development', 'production')).toBe(false);
    expect(useDevelopmentLogTransport('development', 'development')).toBe(true);
  });
});
