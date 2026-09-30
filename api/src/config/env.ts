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
  evidenceStorageDriver: 'local' | 's3';
  evidenceStorageLocalRoot: string;
  evidenceStorageEndpoint?: string;
  evidenceStorageRegion: string;
  evidenceStorageBucket?: string;
  evidenceStorageAccessKey?: string;
  evidenceStorageSecretKey?: string;
  evidenceStorageSse?: 'AES256';
  evidenceStorageAutoCreateBucket: boolean;
  evidenceUploadSigningSecret: string;
  evidenceMaxFileBytes: number;
  evidenceOrganizationQuotaBytes: number;
  evidenceScannerDriver: 'development' | 'clamav';
  evidenceScannerHost?: string;
  evidenceScannerPort: number;
  evidenceScannerTimeoutMs: number;
  evidenceScannerRetries: number;
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
    EVIDENCE_STORAGE_DRIVER: z.enum(['local', 's3']).default(
      environment === 'staging' || environment === 'production' ? 's3' : 'local',
    ),
    EVIDENCE_STORAGE_LOCAL_ROOT: z.string().trim().min(1).default('api/private-evidence'),
    EVIDENCE_STORAGE_ENDPOINT: optionalText,
    EVIDENCE_STORAGE_REGION: z.string().trim().min(1).default('us-east-1'),
    EVIDENCE_STORAGE_BUCKET: optionalText,
    EVIDENCE_STORAGE_ACCESS_KEY: optionalText,
    EVIDENCE_STORAGE_SECRET_KEY: optionalText,
    EVIDENCE_STORAGE_SSE: z.literal('AES256').optional(),
    EVIDENCE_STORAGE_AUTO_CREATE_BUCKET: booleanValue.default(!(environment === 'staging' || environment === 'production')),
    EVIDENCE_UPLOAD_SIGNING_SECRET: z.string().min(1).default(
      environment === 'staging' || environment === 'production' ? '' : 'cocoatrace_local_evidence_signing_secret',
    ),
    EVIDENCE_MAX_FILE_BYTES: z.coerce.number().int().min(1).max(100 * 1024 * 1024).default(10 * 1024 * 1024),
    EVIDENCE_ORGANIZATION_QUOTA_BYTES: z.coerce.number().int().min(1).default(1024 * 1024 * 1024),
    EVIDENCE_SCANNER_DRIVER: z.enum(['development', 'clamav']).default(
      environment === 'staging' || environment === 'production' ? 'clamav' : 'development',
    ),
    EVIDENCE_SCANNER_HOST: optionalText,
    EVIDENCE_SCANNER_PORT: z.coerce.number().int().min(1).max(65_535).default(3310),
    EVIDENCE_SCANNER_TIMEOUT_MS: z.coerce.number().int().min(500).max(120_000).default(15_000),
    EVIDENCE_SCANNER_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
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
    if (deployed && values.EVIDENCE_STORAGE_DRIVER !== 's3') {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['EVIDENCE_STORAGE_DRIVER'], message: 'must be s3 in staging and production' });
    }
    if (values.EVIDENCE_STORAGE_DRIVER === 's3') {
      for (const name of ['EVIDENCE_STORAGE_ENDPOINT', 'EVIDENCE_STORAGE_BUCKET', 'EVIDENCE_STORAGE_ACCESS_KEY', 'EVIDENCE_STORAGE_SECRET_KEY'] as const) {
        if (!values[name]) context.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: 'is required for s3 evidence storage' });
      }
      if (deployed && values.EVIDENCE_STORAGE_ENDPOINT && !values.EVIDENCE_STORAGE_ENDPOINT.startsWith('https://')) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['EVIDENCE_STORAGE_ENDPOINT'], message: 'must use HTTPS in staging and production' });
      }
      if (values.EVIDENCE_STORAGE_BUCKET && !values.EVIDENCE_STORAGE_BUCKET.includes(environment)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['EVIDENCE_STORAGE_BUCKET'], message: `must include the environment name "${environment}"` });
      }
      if (deployed && values.EVIDENCE_STORAGE_SSE !== 'AES256') {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['EVIDENCE_STORAGE_SSE'], message: 'must be AES256 in staging and production' });
      }
    }
    if (deployed && values.EVIDENCE_UPLOAD_SIGNING_SECRET.length < 32) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['EVIDENCE_UPLOAD_SIGNING_SECRET'], message: 'must contain at least 32 characters in staging and production' });
    }
    if (values.EVIDENCE_ORGANIZATION_QUOTA_BYTES < values.EVIDENCE_MAX_FILE_BYTES) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['EVIDENCE_ORGANIZATION_QUOTA_BYTES'], message: 'must be at least EVIDENCE_MAX_FILE_BYTES' });
    }
    if (deployed && values.EVIDENCE_SCANNER_DRIVER !== 'clamav') {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['EVIDENCE_SCANNER_DRIVER'], message: 'must be clamav in staging and production' });
    }
    if (values.EVIDENCE_SCANNER_DRIVER === 'clamav' && !values.EVIDENCE_SCANNER_HOST) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['EVIDENCE_SCANNER_HOST'], message: 'is required when EVIDENCE_SCANNER_DRIVER is clamav' });
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
    evidenceStorageDriver: values.EVIDENCE_STORAGE_DRIVER,
    evidenceStorageLocalRoot: values.EVIDENCE_STORAGE_LOCAL_ROOT,
    evidenceStorageEndpoint: values.EVIDENCE_STORAGE_ENDPOINT,
    evidenceStorageRegion: values.EVIDENCE_STORAGE_REGION,
    evidenceStorageBucket: values.EVIDENCE_STORAGE_BUCKET,
    evidenceStorageAccessKey: values.EVIDENCE_STORAGE_ACCESS_KEY,
    evidenceStorageSecretKey: values.EVIDENCE_STORAGE_SECRET_KEY,
    evidenceStorageSse: values.EVIDENCE_STORAGE_SSE,
    evidenceStorageAutoCreateBucket: values.EVIDENCE_STORAGE_AUTO_CREATE_BUCKET,
    evidenceUploadSigningSecret: values.EVIDENCE_UPLOAD_SIGNING_SECRET,
    evidenceMaxFileBytes: values.EVIDENCE_MAX_FILE_BYTES,
    evidenceOrganizationQuotaBytes: values.EVIDENCE_ORGANIZATION_QUOTA_BYTES,
    evidenceScannerDriver: values.EVIDENCE_SCANNER_DRIVER,
    evidenceScannerHost: values.EVIDENCE_SCANNER_HOST,
    evidenceScannerPort: values.EVIDENCE_SCANNER_PORT,
    evidenceScannerTimeoutMs: values.EVIDENCE_SCANNER_TIMEOUT_MS,
    evidenceScannerRetries: values.EVIDENCE_SCANNER_RETRIES,
  });
}

export const config = parseConfig(process.env);
