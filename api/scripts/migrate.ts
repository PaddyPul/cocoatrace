import knex from 'knex';
import config from '../knexfile';
import { config as appConfig } from '../src/config/env';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { runSafeMigrations } from '../src/database/migrationBootstrap';

async function migrate(): Promise<void> {
  execFileSync(process.execPath, [path.join(__dirname, 'check-migration-integrity.mjs')], { stdio: 'inherit' });
  const environment = appConfig.isProduction ? 'production' : 'development';
  const db = knex(config[environment]);

  try {
    console.log('Running Knex migrations...');
    const directory = path.resolve(__dirname, '../src/migrations');
    const { bootstrapped, batch: batchNo, applied: log } = await runSafeMigrations(db, {
      schemaSql: fs.readFileSync(path.resolve(__dirname, '../../db/schema.sql'), 'utf8'),
      migrationFiles: fs.readdirSync(directory).filter((name) => name.endsWith('.ts')).sort(),
      loadMigration: async (name) => require(path.join(directory, name)),
    });
    if (bootstrapped) console.log('✓ Empty database initialized from the verified frozen schema through migration 010');
    if (log.length === 0) {
      console.log('✓ Already up to date');
    } else {
      console.log(`✓ Batch ${batchNo} applied:`);
      log.forEach((m: string) => console.log(`   - ${m}`));
    }
  } catch (err) {
    console.error('Migration failed:', (err as Error).message);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

migrate();
