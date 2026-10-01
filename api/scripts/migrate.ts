import knex from 'knex';
import config from '../knexfile';
import { config as appConfig } from '../src/config/env';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

async function migrate(): Promise<void> {
  execFileSync(process.execPath, [path.join(__dirname, 'check-migration-integrity.mjs')], { stdio: 'inherit' });
  const environment = appConfig.isProduction ? 'production' : 'development';
  const db = knex(config[environment]);

  try {
    console.log('Running Knex migrations...');
    const [batchNo, log] = await db.migrate.latest();
    if (log.length === 0) {
      console.log('✓ Already up to date');
    } else {
      console.log(`✓ Batch ${batchNo} applied:`);
      log.forEach((m: string) => console.log(`   - ${m}`));
    }
  } catch (err) {
    console.error('Migration failed:', (err as Error).message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

migrate();
