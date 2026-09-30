import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const digestPattern = /^[0-9a-f]{64}$/;

function hashFile(filePath) {
  // Git may materialize text files with CRLF on Windows. Hash the canonical LF
  // representation so one reviewed file has the same digest on every runner.
  const canonicalText = fs.readFileSync(filePath, 'utf8').replaceAll('\r\n', '\n');
  return crypto.createHash('sha256').update(canonicalText, 'utf8').digest('hex');
}

function relativeFiles(directory, root) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => path.relative(root, path.join(directory, entry.name)).replaceAll(path.sep, '/'))
    .sort();
}

export function verifyMigrationIntegrity(root = defaultRoot) {
  const manifestPath = path.join(root, 'api', 'migrations.manifest.json');
  const failures = [];
  if (!fs.existsSync(manifestPath)) return ['Missing migration integrity manifest: api/migrations.manifest.json'];

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return [`Invalid migration integrity manifest: ${error instanceof Error ? error.message : String(error)}`];
  }

  if (manifest.version !== 1 || !manifest.baseline || !Array.isArray(manifest.migrations)) {
    return ['Migration integrity manifest must use version 1 and define baseline and migrations'];
  }

  const protectedEntries = [manifest.baseline, ...manifest.migrations];
  const paths = new Set();
  for (const entry of protectedEntries) {
    if (!entry || typeof entry.path !== 'string' || typeof entry.sha256 !== 'string' || !digestPattern.test(entry.sha256)) {
      failures.push('Every manifest entry must contain a repository-relative path and lowercase SHA-256 digest');
      continue;
    }
    if (paths.has(entry.path)) failures.push(`Duplicate manifest path: ${entry.path}`);
    paths.add(entry.path);
    const absolutePath = path.resolve(root, entry.path);
    if (!absolutePath.startsWith(path.resolve(root) + path.sep)) {
      failures.push(`Manifest path escapes repository root: ${entry.path}`);
      continue;
    }
    if (!fs.existsSync(absolutePath)) {
      failures.push(`Protected migration file is missing or renamed: ${entry.path}`);
      continue;
    }
    const actual = hashFile(absolutePath);
    if (actual !== entry.sha256) failures.push(`Protected migration file was edited: ${entry.path} (expected ${entry.sha256}, got ${actual})`);
  }

  const expectedMigrations = manifest.migrations.map((entry) => entry.path).sort();
  const actualMigrations = relativeFiles(path.join(root, 'api', 'src', 'migrations'), root);
  for (const migrationPath of expectedMigrations) {
    if (!actualMigrations.includes(migrationPath)) failures.push(`Manifest migration is absent from the migration directory: ${migrationPath}`);
  }
  for (const migrationPath of actualMigrations) {
    if (!expectedMigrations.includes(migrationPath)) failures.push(`Migration is not registered in the integrity manifest: ${migrationPath}`);
  }

  const initialPath = path.join(root, 'api', 'src', 'migrations', '001_initial_schema.ts');
  if (fs.existsSync(initialPath) && !fs.readFileSync(initialPath, 'utf8').includes("../../../db/schema.sql")) {
    failures.push('001_initial_schema.ts no longer reads the protected db/schema.sql baseline');
  }
  if (manifest.baseline.path !== 'db/schema.sql') failures.push('The protected baseline must remain db/schema.sql');

  return [...new Set(failures)];
}

function parseRoot(argv) {
  const index = argv.indexOf('--root');
  if (index === -1) return defaultRoot;
  if (!argv[index + 1]) throw new Error('--root requires a repository directory');
  return path.resolve(argv[index + 1]);
}

if (path.resolve(process.argv[1] || '') === scriptPath) {
  try {
    const root = parseRoot(process.argv.slice(2));
    const failures = verifyMigrationIntegrity(root);
    if (failures.length) {
      console.error('Migration integrity check failed:');
      failures.forEach((failure) => console.error(` - ${failure}`));
      console.error('Do not rename or edit an applied migration. Restore it and add a new forward-only migration.');
      process.exitCode = 1;
    } else {
      console.log('Migration integrity check passed: frozen baseline and all registered migrations match.');
    }
  } catch (error) {
    console.error(`Migration integrity check failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
