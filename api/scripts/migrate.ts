import knex from 'knex';
import config from '../knexfile';

async function migrate(): Promise<void> {
  const environment = process.env.NODE_ENV || 'development';
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
