import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repositoryRoot = path.resolve(__dirname, '..', '..', '..');
const checker = path.join(repositoryRoot, 'api', 'scripts', 'check-migration-integrity.mjs');
let fixtureRoot = '';

function copyFixture(): void {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cocoatrace-migrations-'));
  fs.mkdirSync(path.join(fixtureRoot, 'api', 'src'), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, 'db'), { recursive: true });
  fs.copyFileSync(
    path.join(repositoryRoot, 'api', 'migrations.manifest.json'),
    path.join(fixtureRoot, 'api', 'migrations.manifest.json'),
  );
  fs.cpSync(
    path.join(repositoryRoot, 'api', 'src', 'migrations'),
    path.join(fixtureRoot, 'api', 'src', 'migrations'),
    { recursive: true },
  );
  fs.copyFileSync(path.join(repositoryRoot, 'db', 'schema.sql'), path.join(fixtureRoot, 'db', 'schema.sql'));
}

function runCheck() {
  return spawnSync(process.execPath, [checker, '--root', fixtureRoot], { encoding: 'utf8' });
}

beforeEach(copyFixture);
afterEach(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

describe('migration integrity manifest', () => {
  it('accepts the frozen baseline and registered migration chain', () => {
    const result = runCheck();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Migration integrity check passed');
  });

  it('accepts Git-managed CRLF materialization on Windows', () => {
    const migrationPath = path.join(fixtureRoot, 'api', 'src', 'migrations', '009_supplier_paths_and_real_sourcing.ts');
    fs.writeFileSync(migrationPath, fs.readFileSync(migrationPath, 'utf8').replaceAll('\n', '\r\n'));
    const result = runCheck();
    expect(result.status, result.stderr).toBe(0);
  });

  it('rejects an edited historical migration or baseline', () => {
    fs.appendFileSync(path.join(fixtureRoot, 'api', 'src', 'migrations', '010_live_traceability_wiring.ts'), '\n// mutation\n');
    fs.appendFileSync(path.join(fixtureRoot, 'db', 'schema.sql'), '\n-- mutation\n');
    const result = runCheck();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Protected migration file was edited: api/src/migrations/010_live_traceability_wiring.ts');
    expect(result.stderr).toContain('Protected migration file was edited: db/schema.sql');
  });

  it('rejects a missing or renamed historical migration', () => {
    fs.renameSync(
      path.join(fixtureRoot, 'api', 'src', 'migrations', '011_explicit_network_permissions.ts'),
      path.join(fixtureRoot, 'api', 'src', 'migrations', '011_network_permissions.ts'),
    );
    const result = runCheck();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Protected migration file is missing or renamed: api/src/migrations/011_explicit_network_permissions.ts');
    expect(result.stderr).toContain('Migration is not registered in the integrity manifest: api/src/migrations/011_network_permissions.ts');
  });

  it('requires every new migration to be deliberately registered', () => {
    fs.writeFileSync(
      path.join(fixtureRoot, 'api', 'src', 'migrations', '016_example.ts'),
      'export async function up() {}\nexport async function down() {}\n',
    );
    const result = runCheck();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Migration is not registered in the integrity manifest: api/src/migrations/016_example.ts');
  });
});
