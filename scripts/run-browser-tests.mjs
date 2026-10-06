import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const docker = process.platform === 'win32' ? 'docker.exe' : 'docker';
const project = 'cocoatrace-browser-tests';
const compose = ['compose', '-p', project, '-f', path.join(root, 'docker-compose.browser-tests.yml')];
const playwright = require.resolve('@playwright/test/cli');
const port = (name, fallback) => {
  const value = process.env[name] || fallback;
  if (!/^\d+$/.test(value) || Number(value) < 1024 || Number(value) > 65535) throw new Error(`${name} must be a valid non-privileged port`);
  return value;
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...options });
  if (result.error) throw new Error(`Could not launch ${command}. Install/start Docker Desktop and retry.`);
  return result.status ?? 1;
}

let started = false;
try {
  const webPort = port('COCOATRACE_BROWSER_WEB_PORT', '13000');
  const mailPort = port('COCOATRACE_BROWSER_MAIL_PORT', '18025');
  const dbPort = port('COCOATRACE_BROWSER_DB_PORT', '15435');
  fs.rmSync(path.join(root, 'browser-test-results'), { recursive: true, force: true });
  const installCode = run(process.execPath, [playwright, 'install', 'chromium']);
  if (installCode !== 0) throw new Error('Chromium installation failed; resolve the download error before retrying.');
  // Also clean up a partially failed Compose startup, not just a successful one.
  started = true;
  if (run(docker, [...compose, 'down', '--volumes', '--remove-orphans']) !== 0) throw new Error('Could not reset the dedicated browser test containers.');
  // Older Docker Desktop builds support --wait but not --wait-timeout. Keep
  // health-gated startup using the same compatible flag as the integration runner.
  const startCode = run(docker, [...compose, 'up', '-d', '--build', '--wait']);
  if (startCode !== 0) {
    process.exitCode = startCode;
    run(docker, [...compose, 'ps', '-a']);
    // Capture the web startup/probe failure before disposable cleanup removes
    // the container. These probes contain no session cookies or email tokens.
    run(docker, [...compose, 'logs', '--no-color', '--tail', '40', 'web']);
    const webId = spawnSync(docker, [...compose, 'ps', '-a', '-q', 'web'], { cwd: root, encoding: 'utf8' });
    if (webId.status === 0 && webId.stdout.trim()) {
      run(docker, ['inspect', '--format', '{{json .State.Health}}', webId.stdout.trim()]);
    }
  } else {
    const fixtureCode = run(docker, [...compose, 'exec', '-T', 'api', 'node', '--import', 'tsx', 'api/scripts/seed-browser-tests.ts']);
    process.exitCode = fixtureCode || run(process.execPath, [playwright, 'test'], {
      env: {
        ...process.env,
        COCOATRACE_BROWSER_RUN: 'true',
        COCOATRACE_BROWSER_BASE_URL: `http://localhost:${webPort}`,
        COCOATRACE_BROWSER_INBOX_URL: `http://127.0.0.1:${mailPort}`,
        COCOATRACE_BROWSER_DATABASE_URL: `postgresql://browser_test:browser_test@127.0.0.1:${dbPort}/cocoatrace_browser_test`,
      },
    });
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (started) {
    try {
      const cleanupCode = run(docker, [...compose, 'down', '--volumes', '--remove-orphans']);
      if (cleanupCode !== 0) process.exitCode = process.exitCode || cleanupCode;
    } catch {
      console.error('Could not clean up the dedicated browser test project. Check Docker Desktop.');
      process.exitCode = 1;
    }
  }
}
