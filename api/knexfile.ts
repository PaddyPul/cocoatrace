import type { Knex } from 'knex';
import path from 'path';
import { config as appConfig } from './src/config/env';

const connectionString = appConfig.databaseUrl;
const connection = appConfig.databaseSsl
  ? { connectionString, ssl: { rejectUnauthorized: appConfig.databaseSslRejectUnauthorized } }
  : connectionString;

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection,
    pool: { min: 0, max: appConfig.databasePoolMax },
    migrations: {
      directory: path.join(__dirname, 'src', 'migrations'),
      extension: 'ts',
    },
    seeds: {
      directory: path.join(__dirname, 'db', 'seeds'),
      extension: 'ts',
    },
  },
  production: {
    client: 'pg',
    connection,
    pool: { min: 0, max: appConfig.databasePoolMax },
    migrations: {
      // The migration table was originally created by the TypeScript runner,
      // so Knex records names such as 001_initial_schema.ts. The production
      // image also runs migrations through `tsx` and contains api/src; using
      // those same files keeps the on-disk names aligned with database history.
      directory: path.join(__dirname, 'src', 'migrations'),
      extension: 'ts',
    },
  },
};

export default config;
