import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docker = process.platform === 'win32' ? 'docker.exe' : 'docker';
// Fixed isolated project with tmpfs PostgreSQL and no published ports. Never
// reuse the development/application Compose project or its persistent volumes.
const args = ['compose', '-p', 'cocoatrace-migration-tests', '-f', path.join(root, 'docker-compose.migration-tests.yml')];
function run(command) {
  const result = spawnSync(docker, [...args, ...command], { cwd: root, stdio: 'inherit' });
  if (result.error) throw new Error('Unable to run Docker. Install/start Docker Desktop and retry.', { cause: result.error });
  return result.status ?? 1;
}
let started = false;
try {
  started = true;
  if (run(['down', '--volumes', '--remove-orphans']) !== 0) throw new Error('Could not clean the isolated migration test project');
  if (run(['up', '-d', '--wait', '--wait-timeout', '90', 'postgres-migration-test']) !== 0) throw new Error('Disposable PostgreSQL failed startup');
  process.exitCode = run(['run', '--build', '--rm', 'migration-test']);
} catch (error) {
  console.error(error.message); process.exitCode = 1;
} finally {
  if (started) {
    try { if (run(['down', '--volumes', '--remove-orphans']) !== 0) process.exitCode = 1; }
    catch (error) { console.error(`Migration test cleanup failed: ${error.message}`); process.exitCode = 1; }
  }
}
