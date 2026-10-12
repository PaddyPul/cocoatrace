import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import knex, { type Knex } from 'knex';
import { requireDisposableTestDatabase } from '../src/testing/databaseSafety';
import { runSafeMigrations } from '../src/database/migrationBootstrap';

export function requireEvidenceStressDatabase(environment: NodeJS.ProcessEnv): string {
  const connection = requireDisposableTestDatabase(environment.DATABASE_URL);
  const url = new URL(connection);
  if (
    environment.APP_ENV !== 'test' ||
    environment.EVIDENCE_STRESS_FIXTURES !== 'true' ||
    url.hostname !== '127.0.0.1' ||
    url.pathname !== '/bettertrade_evidence_stress_test' ||
    url.username !== 'stress_test' ||
    !url.port
  )
    throw Error('EVIDENCE_STRESS_DATABASE_REFUSED');
  return connection;
}
export function evidenceStressDatabaseConfig(environment: NodeJS.ProcessEnv): Knex.Config {
  return {
    client: 'pg',
    connection: requireEvidenceStressDatabase(environment),
    pool: { min: 0, max: 2 },
    migrations: { directory: path.resolve(__dirname, '../src/migrations'), extension: 'ts' },
  };
}
export async function createEvidenceStressFixtures() {
  const database = knex(evidenceStressDatabaseConfig(process.env));
  let phase = 'DATABASE';
  try {
    const existing = await database.raw(
      "SELECT COUNT(*)::int AS count FROM pg_tables WHERE schemaname='public'",
    );
    if (existing.rows[0].count !== 0) throw Error('EVIDENCE_STRESS_DATABASE_NOT_EMPTY');
    phase = 'MIGRATIONS';
    const directory = path.resolve(__dirname, '../src/migrations');
    await runSafeMigrations(database, {
      schemaSql: fs.readFileSync(path.resolve(__dirname, '../../db/schema.sql'), 'utf8'),
      migrationFiles: fs
        .readdirSync(directory)
        .filter((name) => name.endsWith('.ts'))
        .sort(),
      loadMigration: async (name) => require(path.join(directory, name)),
    });
    phase = 'ACTORS';
    const actors = [];
    for (let index = 0; index < 2; index += 1) {
      const [organization] = await database('organizations')
        .insert({
          name: `Synthetic stress organization ${index}`,
          type: 'exporter',
          jurisdiction: 'GH',
          verification_status: 'verified',
        })
        .returning('id');
      const email = `stress-${crypto.randomUUID()}@evidence.test`,
        password = `Stress-${crypto.randomBytes(24).toString('hex')}!`;
      const [user] = await database('users')
        .insert({
          organization_id: organization.id,
          email,
          password_hash: await bcrypt.hash(password, 4),
          name: 'Synthetic stress user',
        })
        .returning('id');
      const [role] = await database('roles')
        .insert({
          name: `evidence-stress-${index}`,
          permissions: ['farm.read', 'evidence.read', 'evidence.upload'],
        })
        .returning('id');
      await database('user_roles').insert({ user_id: user.id, role_id: role.id });
      const [farm] = await database('farms')
        .insert({
          farmer_organization_id: organization.id,
          name: `Synthetic stress farm ${index}`,
          country: 'GH',
          region: 'Synthetic',
          district: 'Synthetic',
        })
        .returning('id');
      actors.push({ email, password, farmId: farm.id });
    }
    return actors;
  } catch {
    throw new Error(`EVIDENCE_STRESS_FIXTURE_${phase}`);
  } finally {
    await database.destroy();
  }
}
