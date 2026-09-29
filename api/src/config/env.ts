import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const APP_ENVIRONMENTS = ['development', 'test', 'demo', 'staging', 'production'] as const;
export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

const booleanValue = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return value;
}, z.boolean());

const optionalText = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
);

function inferredEnvironment(source: NodeJS.ProcessEnv): AppEnvironment {
  const candidate = source.APP_ENV || source.NODE_ENV || 'development';
  if (!(APP_ENVIRONMENTS as readonly string[]).includes(candidate)) {
    throw new Error(`Invalid CocoaTrace APP_ENV: ${candidate}. Expected one of ${APP_ENVIRONMENTS.join(', ')}.`);
  }
  return candidate as AppEnvironment;
}

export type AppConfig = Readonly<{
  environment: AppEnvironment;
  isProduction: boolean;
  isDeployed: boolean;
  demoMode: boolean;
  port: number;
  webUrl: string;
  publicWebUrl: string;
  jwtSecret: string;
  cookieSecure: boolean;
  databaseUrl: string;
  databaseSsl: boolean;
  databaseSslRejectUnauthorized: boolean;
  databasePoolMax: number;
  logQueries: boolean;
  logLevel?: string;
  platformFeeBps: number;
  openAiApiKey?: string;
  openAiModel?: string;
  allowRemoteDemoReset: boolean;
  appVersion: string;
}>;

export function parseConfig(source: NodeJS.ProcessEnv): AppConfig {
  const environment = inferredEnvironment(source);
  const localDatabase = environment === 'test'
    ? 'postgresql://cocoa:cocoa_dev@localhost:15433/cocoatrace_test'
    : 'postgresql://cocoa:cocoa_dev@localhost:15433/cocoatrace';

  const schema = z.object({
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    WEB_URL: z.string().url().default('http://localhost:3000'),
    PUBLIC_WEB_URL: z.string().url().optional(),
    JWT_SECRET: z.string().min(1).default('cocoatrace_dev_secret_change_in_production'),
    COOKIE_SECURE: booleanValue.default(false),
    DATABASE_URL: z.string().url().default(localDatabase),
    DATABASE_SSL: booleanValue.default(false),
    DATABASE_SSL_REJECT_UNAUTHORIZED: booleanValue.default(true),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    LOG_QUERIES: booleanValue.default(false),
    LOG_LEVEL: optionalText,
    PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(1000).default(100),
    OPENAI_API_KEY: optionalText,
    OPENAI_MODEL: optionalText,
    APP_VERSION: z.string().trim().min(1).default('development'),
    DEMO_MODE: booleanValue.default(environment === 'demo'),
    COCOATRACE_ALLOW_REMOTE_DEMO_RESET: z.literal('I_UNDERSTAND').optional(),
  }).superRefine((values, context) => {
    const deployed = environment === 'staging' || environment === 'production';
    if (deployed) {
      for (const name of ['DATABASE_URL', 'JWT_SECRET', 'WEB_URL', 'PUBLIC_WEB_URL', 'APP_VERSION'] as const) {
        if (!source[name]) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: 'must be explicitly configured in staging and production' });
        }
      }
    }
    if (deployed && values.JWT_SECRET.length < 32) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_SECRET'], message: 'must contain at least 32 characters in staging and production' });
    }
    if (deployed && /dev_secret|change[_-]?me|password/i.test(values.JWT_SECRET)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_SECRET'], message: 'must not use a development or placeholder value' });
    }
    if (deployed && !values.WEB_URL.startsWith('https://')) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['WEB_URL'], message: 'must use HTTPS in staging and production' });
    }
    if (deployed && values.PUBLIC_WEB_URL && !values.PUBLIC_WEB_URL.startsWith('https://')) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['PUBLIC_WEB_URL'], message: 'must use HTTPS in staging and production' });
    }
    if (deployed && !values.COOKIE_SECURE) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['COOKIE_SECURE'], message: 'must be true in staging and production' });
    }
    if (environment === 'production' && values.DEMO_MODE) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['DEMO_MODE'], message: 'must be false in production' });
    }
    if (Boolean(values.OPENAI_API_KEY) !== Boolean(values.OPENAI_MODEL)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['OPENAI_API_KEY'], message: 'OPENAI_API_KEY and OPENAI_MODEL must be configured together' });
    }
  });

  const result = schema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join('.') || 'configuration'} ${issue.message}`).join('; ');
    throw new Error(`Invalid CocoaTrace configuration for ${environment}: ${details}`);
  }

  const values = result.data;
  return Object.freeze({
    environment,
    isProduction: environment === 'production',
    isDeployed: environment === 'staging' || environment === 'production',
    demoMode: values.DEMO_MODE,
    port: values.PORT,
    webUrl: values.WEB_URL.replace(/\/$/, ''),
    publicWebUrl: (values.PUBLIC_WEB_URL || values.WEB_URL).replace(/\/$/, ''),
    jwtSecret: values.JWT_SECRET,
    cookieSecure: values.COOKIE_SECURE,
    databaseUrl: values.DATABASE_URL,
    databaseSsl: values.DATABASE_SSL,
    databaseSslRejectUnauthorized: values.DATABASE_SSL_REJECT_UNAUTHORIZED,
    databasePoolMax: values.DATABASE_POOL_MAX,
    logQueries: values.LOG_QUERIES,
    logLevel: values.LOG_LEVEL,
    platformFeeBps: values.PLATFORM_FEE_BPS,
    openAiApiKey: values.OPENAI_API_KEY,
    openAiModel: values.OPENAI_MODEL,
    allowRemoteDemoReset: values.COCOATRACE_ALLOW_REMOTE_DEMO_RESET === 'I_UNDERSTAND',
    appVersion: values.APP_VERSION,
  });
}

export const config = parseConfig(process.env);
