import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../..');
const composeFile = path.join(repositoryRoot, 'docker-compose.integration.yml');
const port = process.env.COCOATRACE_TEST_DB_PORT || '15434';
const composeProject = process.env.COCOATRACE_TEST_COMPOSE_PROJECT || 'cocoatrace-integration-tests';
const testDatabaseUrl = `postgresql://cocoa_test:cocoa_test@127.0.0.1:${port}/cocoatrace_test`;
const docker = process.platform === 'win32' ? 'docker.exe' : 'docker';
const npmCli = process.env.npm_execpath;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: repositoryRoot, stdio: 'inherit', ...options });
  if (result.error) {
    throw new Error(`Unable to run ${command}. Install and start Docker Desktop, then retry.`, {
      cause: result.error,
    });
  }
  return result.status ?? 1;
}

const composeArgs = ['compose', '-p', composeProject, '-f', composeFile];
let composeStarted = false;

try {
  const startCode = run(docker, [...composeArgs, 'up', '-d', '--wait']);
  if (startCode !== 0) process.exitCode = startCode;
  else {
    composeStarted = true;
    if (!npmCli) throw new Error('npm_execpath is unavailable. Run this command through npm.');
    process.exitCode = run(process.execPath, [npmCli, 'run', 'test:integration', '--workspace=api'], {
      env: { ...process.env, TEST_DATABASE_URL: testDatabaseUrl },
    });
  }
} finally {
  if (composeStarted) run(docker, [...composeArgs, 'down', '--volumes']);
}
