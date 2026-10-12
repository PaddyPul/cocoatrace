import pino from 'pino';
import express from 'express';
import pinoHttp from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { loggerRedactionPaths, requestLogSerializer, useDevelopmentLogTransport } from './logger';

describe('logger redaction', () => {
  it('redacts authentication headers, cookies and common application secrets', () => {
    expect(loggerRedactionPaths).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
        'res.headers["set-cookie"]',
        'password',
        '*.password',
        'accessToken',
        '*.accessToken',
        'req.query.signature',
        'req.query.token',
        'openAiApiKey',
        'jwtSecret',
        'evidenceStorageSecretKey',
        'evidenceUploadSigningSecret',
      ]),
    );
  });

  it('does not write configured secrets to a structured log', () => {
    let output = '';
    const testLogger = pino(
      { redact: { paths: loggerRedactionPaths, censor: '[REDACTED]' } },
      {
        write: (line: string) => {
          output += line;
        },
      },
    );

    testLogger.info(
      {
        req: {
          headers: { authorization: 'Bearer private-token', cookie: 'ct_session=private-cookie' },
          body: { currentPassword: 'private-reauth-password' },
        },
        currentPassword: 'private-reauth-top-level',
        password: 'private-password',
        evidenceStorageSecretKey: 'private-storage-key',
      },
      'redaction check',
    );

    expect(output).not.toContain('private-token');
    expect(output).not.toContain('private-cookie');
    expect(output).not.toContain('private-password');
    expect(output).not.toContain('private-reauth-password');
    expect(output).not.toContain('private-reauth-top-level');
    expect(output).not.toContain('private-storage-key');
    expect(output).toContain('[REDACTED]');
  });

  it('omits bearer-capability query values from an actual pino-http request log', async () => {
    let output = '';
    const testLogger = pino(
      {
        redact: { paths: loggerRedactionPaths, censor: '[REDACTED]' },
      },
      {
        write: (line: string) => {
          output += line;
        },
      },
    );
    const app = express();
    app.use(pinoHttp({ logger: testLogger, serializers: { req: requestLogSerializer } }));
    app.put('/evidence/upload-intents/:id/content', (_req, res) => res.sendStatus(204));

    await request(app)
      .put(
        '/evidence/upload-intents/intent-id/content?expires=123&signature=private-upload-capability&token=private-query-token',
      )
      .set('Authorization', 'Bearer private-authorization')
      .set('Referer', 'https://app.example/verify-access?token=private-referrer-token');

    expect(output).not.toContain('private-upload-capability');
    expect(output).not.toContain('private-query-token');
    expect(output).not.toContain('private-authorization');
    expect(output).not.toContain('private-referrer-token');
    const entry = JSON.parse(output.trim()) as {
      req: { method: string; url: string; query?: unknown; headers?: unknown };
    };
    expect(entry.req).toMatchObject({
      method: 'PUT',
      url: '/evidence/upload-intents/intent-id/content',
    });
    expect(entry.req).not.toHaveProperty('query');
    expect(entry.req).not.toHaveProperty('headers');
    expect(entry.req.url).not.toContain('?');
  });

  it('redacts invitation bearer tokens from mixed-case and encoded request paths', async () => {
    let output = '';
    const testLogger = pino(
      { redact: { paths: loggerRedactionPaths, censor: '[REDACTED]' } },
      {
        write: (line: string) => {
          output += line;
        },
      },
    );
    const app = express();
    app.use(pinoHttp({ logger: testLogger, serializers: { req: requestLogSerializer } }));
    app.use((_req, res) => res.sendStatus(204));

    await request(app).get('/%61UTH/%69NVITATIONS/private-invite-token/accept?source=email');

    expect(output).not.toContain('private-invite-token');
    expect(output).not.toContain('%61UTH');
    expect(output).not.toContain('source=email');
    const entry = JSON.parse(output.trim()) as { req: { method: string; url: string } };
    expect(entry.req).toMatchObject({
      method: 'GET',
      url: '/auth/invitations/[REDACTED]',
    });
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
