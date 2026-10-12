import pino from 'pino';
import { config } from './config/env';

export const loggerRedactionPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["proxy-authorization"]',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  'authorization',
  'cookie',
  'password',
  '*.password',
  'currentPassword',
  '*.currentPassword',
  'req.body.currentPassword',
  'req.query.signature',
  'req.query.token',
  'req.query.accessToken',
  'req.query.verificationToken',
  'accessToken',
  '*.accessToken',
  'openAiApiKey',
  '*.openAiApiKey',
  'token',
  '*.token',
  'jwtSecret',
  'evidenceStorageAccessKey',
  'evidenceStorageSecretKey',
  'evidenceUploadSigningSecret',
];

function safeRequestPath(url: string): string {
  const path = url.split('?', 1)[0];
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // A malformed escape cannot match a supported bearer-token route. Keep
    // the query-free path instead of risking a logging failure.
  }
  if (/^\/auth\/invitations\/[^/]+(?:\/|$)/i.test(decoded)) {
    return '/auth/invitations/[REDACTED]';
  }
  return path;
}

/**
 * pino-http's standard serializer includes both the raw URL and Express query
 * object. Signed upload capabilities and identity tokens must not therefore be
 * retained in request logs. The path remains useful for operations, while all
 * query values are deliberately omitted rather than maintained as an
 * error-prone secret allow/deny list.
 */
export function requestLogSerializer(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  const request = value as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  for (const key of ['id', 'method', 'remoteAddress', 'remotePort']) {
    if (typeof request[key] === 'string' || typeof request[key] === 'number') {
      safe[key] = request[key];
    }
  }
  if (typeof request.url === 'string') safe.url = safeRequestPath(request.url);
  return safe;
}

export function useDevelopmentLogTransport(environment: string, nodeEnvironment?: string): boolean {
  return environment === 'development' && nodeEnvironment !== 'production';
}

const transport = !useDevelopmentLogTransport(config.environment, process.env.NODE_ENV)
  ? undefined
  : {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss' },
    };

const logger = pino({
  level: config.logLevel || (config.isDeployed ? 'info' : 'debug'),
  transport,
  redact: {
    paths: loggerRedactionPaths,
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
