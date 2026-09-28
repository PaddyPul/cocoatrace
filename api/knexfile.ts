import type { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://cocoa:cocoa_dev@localhost:15433/cocoatrace';

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: connectionString,
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
    connection: process.env.DB_USE_SSL === 'true'
      ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
      : process.env.DATABASE_URL,
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
