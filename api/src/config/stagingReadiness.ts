import type { AppConfig } from './env';

/** Repository preflight only: infrastructure reachability and restore evidence are separate gates. */
export function stagingReadinessFailures(config: AppConfig): string[] {
  const failures: string[] = [];
  if ([config.databaseUrl, config.jwtSecret, config.evidenceUploadSigningSecret, config.evidenceStorageAccessKey, config.evidenceStorageSecretKey, config.smtpHost, config.smtpUser, config.smtpPassword].some(value => value?.includes('REPLACE_'))) failures.push('Replace all staging template values before deployment');
  if (config.environment !== 'staging') failures.push('APP_ENV must be staging');
  if (!config.databaseSsl || !config.databaseSslRejectUnauthorized) failures.push('Database TLS and certificate verification must be enabled');
  try {
    const database = new URL(config.databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(database.protocol)) failures.push('DATABASE_URL must be a PostgreSQL URL');
    if (['disable', 'allow', 'prefer'].includes(database.searchParams.get('sslmode') || '')) failures.push('DATABASE_URL must not weaken the required TLS policy');
  } catch { failures.push('DATABASE_URL must be a valid PostgreSQL URL'); }
  if (!config.identityEmailEnabled || config.emailDriver !== 'smtp') failures.push('Real SMTP delivery must be enabled for registration, recovery and recall notifications');
  if (config.evidenceStorageAutoCreateBucket) failures.push('Provision the private staging bucket first; disable automatic bucket creation');
  if (config.jwtSecret === config.evidenceUploadSigningSecret) failures.push('Session and upload signing secrets must be different');
  if (!/^(?:[a-f0-9]{7,40}|v\d+\.\d+\.\d+(?:[-+.].+)?)$/.test(config.appVersion)) failures.push('APP_VERSION must identify a release version or Git commit');
  return failures;
}
