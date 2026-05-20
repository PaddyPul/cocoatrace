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
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    },
    migrations: {
      directory: path.join(__dirname, 'dist', 'migrations'),
      extension: 'js',
    },
  },
};

export default config;
