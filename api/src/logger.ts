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
